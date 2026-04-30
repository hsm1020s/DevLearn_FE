# 설계: 2026-04-30-error-toast-from-backend

**생성:** 2026-04-30 20:50
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-30-error-toast-from-backend
**브랜치:** task/2026-04-30-error-toast-from-backend

## 문제
- 현재 에러 토스트는 호출 시점의 정적 라벨("퀴즈 생성에 실패했습니다", "통계를 불러오지 못했습니다" 등)만 노출.
- 백엔드 `ApiResponse`는 `{success:false, message:"…", errorCode:"…"}` 구조로 실제 원인 메시지를 응답하지만, FE 에러 토스트는 이걸 항상 무시한다.
- `errorHandler.showError(err, fallbackMessage)`의 `fallbackMessage`는 이름과 달리 PRIMARY 인자로 동작 (truthy면 항상 우선) → 백엔드 메시지가 영영 안 보임.
- 5xx도 일괄 "서버 오류가 발생했습니다" 폴백 → 백엔드가 명시한 사유(`message`)를 모두 가린다.
- 결과: 사용자가 "왜 안 되는지" 모름. 디버깅도 불가.

## 목표
- 에러 토스트가 백엔드 응답의 `message` + `errorCode`를 사용자에게 직접 노출.
- 호출부에서 넘긴 컨텍스트 라벨("퀴즈 생성 실패")은 **제목**으로, 백엔드 메시지는 **본문**으로 분리 표시.
- 클라이언트 사이드 검증 메시지(error 객체 없음)는 그대로 단일 라인 노출.
- 호출부 시그니처는 그대로 유지(거대한 마이그레이션 없이 효과 즉시 발생).

## 백엔드 응답 형태 (참고)
```json
{
  "success": false,
  "data": null,
  "message": "선택한 문서가 처리되지 않아 출제할 수 없습니다",
  "errorCode": "DOC_NOT_PROCESSED"
}
```
- `message`: 사용자 노출 메시지 (한국어)
- `errorCode`: 디버깅·필터링용 식별자

GlobalExceptionHandler가 5xx에서도 `INTERNAL_ERROR` 코드와 메시지를 채워 보낸다. 즉 모든 실패 응답에 `message`가 존재.

## 변경 범위

### 1) `src/utils/errorHandler.js` — 추출/표시 로직 재작성
- `extractBackendMessage(error)` 헬퍼 추가
  - `ERR_NETWORK` → "네트워크 연결을 확인해주세요"
  - `ECONNABORTED` → "요청 시간이 초과되었습니다"
  - 그 외: `error.response?.data?.message` > `error.userMessage` > `error.message` > null
- `extractErrorCode(error)` 헬퍼 추가 — `error.response?.data?.errorCode`
- `showError(error, contextLabel)` 시그니처 유지, 의미 변경:
  - error + contextLabel 모두 있음 → `{ title: contextLabel, body: backendMsg, code: errorCode }` 구조 토스트
  - error만 있음 → `{ body: backendMsg, code: errorCode }`
  - error 없고 contextLabel만 있음 → `{ body: contextLabel }`
  - 둘 다 없음 → 기본 메시지 폴백

### 2) `src/components/common/Toast.jsx` — 구조화 메시지 렌더 지원
- `addToast(message, type)` — `message`가 객체이면 `{title, body, code}` 분해 렌더, 문자열이면 기존처럼 단일 라인.
- ToastItem 렌더:
  - title 있으면 굵게 한 줄
  - body는 다음 줄 일반 톤
  - code 있으면 우측 또는 본문 끝에 작은 회색 칩(`text-[10px]`)으로 노출
- 타이머는 그대로 3초. 단, 에러 토스트는 본문이 길어질 수 있으므로 5초로 늘린다(에러만, success/info는 3초 유지).

### 3) `src/services/api.js` — 응답 인터셉터 보강
- 현재 `error.response?.data?.message || error.message` 추출 로직 그대로 두되, `userMessage` 외에 `userErrorCode`도 함께 첨부 (errorHandler가 한 곳에서 추출하면 충분하므로 옵션. 일단 errorHandler에서 직접 `error.response?.data`를 보는 방식으로 통일.)

### 4) 호출부
- 시그니처/인자 그대로. 효과 자동 적용. 변경 없음.
- 단 `showError(null, '메시지')` 패턴은 여전히 단일 본문 노출(클라이언트 검증).

## 구현 계획
1. `errorHandler.js` 재작성 (extract* 헬퍼 + showError 분기)
2. `Toast.jsx` 구조화 message 렌더 + 에러 5초 타이머
3. dev 서버에서 실제 에러 시나리오 재현 — 토큰 만료 / 서버 4xx / 5xx 시 토스트가 백엔드 메시지/코드 노출 확인
4. 검증 후 커밋·병합·푸시

## 단위 테스트 계획
- 빌드 성공 (vite build, 에러 0)
- BE가 명시적으로 거절하는 시나리오 1개 이상에서 토스트가 백엔드 메시지(예: "선택한 문서가 처리되지 않아…")를 본문으로 노출
- 컨텍스트 라벨(예: "퀴즈 생성 실패")이 제목으로, 백엔드 메시지가 본문으로 분리 표시
- errorCode가 있을 경우 작은 식별 칩으로 노출
- `ERR_NETWORK` 시 네트워크 메시지가 본문으로 노출
- 클라이언트 검증 `showError(null, 'PDF만 업로드')` 단일 본문 노출
- 성공 토스트 / 정보 토스트 변동 없음

## 회귀 테스트 계획
- 일반 채팅 / 공부 모드 / 업무학습 / 마인드맵 진입 정상
- 정상 흐름(에러 없음)에서 토스트 미발생
- 401 → 토큰 갱신 흐름 정상 ("세션이 만료되었습니다…" 토스트 1회)
- 새로고침 후 persist 데이터 보존
