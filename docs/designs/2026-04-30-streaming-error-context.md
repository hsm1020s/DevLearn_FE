# 설계: 2026-04-30-streaming-error-context

**생성:** 2026-04-30 21:00
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-30-streaming-error-context
**브랜치:** task/2026-04-30-streaming-error-context

## 목표
채팅 스트리밍(SSE) 경로에서도 에러 토스트가 백엔드 `errorCode` + 컨텍스트 라벨(어떤 동작이 실패했는지)을 사용자에게 보여주도록 한다. axios 경로는 직전 태스크에서 처리됐고, 이번엔 SSE만 잡아 동일 수준으로 끌어올린다.

## 문제
- 사용자가 채팅 시도 → 토스트에 "대화를 찾을 수 없습니다"만 보이고 **어떤 동작**에서 **어떤 에러코드**로 실패했는지 안 보임.
- 직전 태스크에서 axios 경로(통계/퀴즈 등)는 백엔드 message + errorCode가 토스트에 노출되도록 정비했지만, SSE 채팅(`chatApi.streamMessage`, `feynmanApi.streamFeynmanChat`)은 fetch 직접 사용이라:
  - 에러 응답 본문 파싱 시 `message`만 추출하고 `errorCode`는 버림
  - throw하는 Error 객체에 `userMessage`만 첨부, `errorCode` 없음
  - errorHandler가 axios 형식만 검사 → SSE 에러는 코드 칩 미노출
- `useStreamingChat`의 5개 catch 모두 `showError(err)` (제목 없음) → 무엇이 실패했는지 사용자 모름.

## 네트워크 응답 확인 (실측)
```bash
$ curl -i -X POST http://localhost:8080/api/chat/stream -H "Content-Type: application/json"
HTTP/1.1 401
Content-Type: application/json;charset=UTF-8
{"success":false,"data":null,"message":"인증이 필요합니다","errorCode":"UNAUTHORIZED"}
```
- BE는 `ApiResponse` 표준대로 `message` + `errorCode`를 정상적으로 내려줌.
- 즉 BE는 추가 변경 불필요 — FE가 이를 onClick 그대로 전달해 토스트에 노출하기만 하면 됨.

## 변경 범위 (FE 만)

### 1) SSE API의 에러 throw에 `errorCode` 첨부
- `src/services/chatApi.js streamMessage` (line 97-108):
  ```js
  // 변경 전
  let message = `요청 실패 (${response.status})`;
  try { const body = await response.json(); if (body?.message) message = body.message; } catch {}
  const err = new Error(message);
  err.userMessage = message;
  err.status = response.status;
  throw err;
  ```
  ```js
  // 변경 후 — errorCode 함께 추출/첨부
  let message = `요청 실패 (${response.status})`;
  let errorCode = null;
  try {
    const body = await response.json();
    if (body?.message) message = body.message;
    if (body?.errorCode) errorCode = body.errorCode;
  } catch {}
  const err = new Error(message);
  err.userMessage = message;
  err.errorCode = errorCode;
  err.status = response.status;
  throw err;
  ```
- 401 갱신 실패 분기: `err.errorCode = 'UNAUTHORIZED'` 부여.
- `src/services/feynmanApi.js streamFeynmanChat`도 동일 패턴 적용.

### 2) errorHandler가 SSE 에러의 errorCode를 인식
- `src/utils/errorHandler.js extractErrorCode`:
  ```js
  // 변경 후 — axios 경로 + 직접 첨부 경로 둘 다 탐색
  return error.response?.data?.errorCode || error.errorCode || null;
  ```
- `extractBackendMessage` 우선순위는 그대로 (response.data.message > userMessage > message).

### 3) `useStreamingChat`의 5개 catch에 컨텍스트 라벨 부여
- 일반 메시지 스트림 실패 → `showError(err, 'AI 응답 받기 실패')`
- 일반 재시도 실패(409 후) → `showError(retryErr, 'AI 응답 재시도 실패')`
- 파인만 init 실패 → `showError(err, '파인만 학습 시작 실패')`
- 파인만 일반 스트림 실패 → `showError(err, '파인만 응답 받기 실패')`
- 파인만 재시도 실패 → `showError(retryErr, '파인만 재시도 실패')`

## 변경하지 않는 것
- BE: 응답 형태/메시지/코드는 이미 표준에 맞음. 추가 변경 없음.
- 토스트 렌더 로직 / 자동 제거 시간 — 직전 태스크에서 마무리됨.
- 호출부의 다른 모든 `showError(...)` — 변경 불필요(자동 적용).

## 구현 계획
1. `chatApi.streamMessage` errorCode 첨부
2. `feynmanApi.streamFeynmanChat` 동일 적용
3. `errorHandler.extractErrorCode` 폴백 추가
4. `useStreamingChat` 5개 catch 컨텍스트 라벨 부여
5. 빌드 + dev 서버 띄워 BE에 일부러 잘못된 conversationId/토큰을 보내 토스트 확인

## 단위 테스트 계획
- 빌드 성공
- 비로그인 상태(401)에서 메시지 전송 → 토스트 제목 "AI 응답 받기 실패", 본문 "인증이 필요합니다", 코드 "UNAUTHORIZED"
- 잘못된 conversationId(404)에서 메시지 전송 → 제목 "AI 응답 받기 실패", 본문 "대화를 찾을 수 없습니다", 코드 "NOT_FOUND"
- 파인만 챕터 선택 후 init 실패 → 제목 "파인만 학습 시작 실패"
- axios 경로(통계/퀴즈) 토스트는 변동 없음 (회귀 없음)

## 회귀 테스트 계획
- 정상 채팅 / 정상 파인만 흐름에서 토스트 미발생
- 401 → refresh 성공 시 정상 동작
- 모드 전환 후 채팅 / 마인드맵 정상
- 새로고침 후 persist 데이터 보존
