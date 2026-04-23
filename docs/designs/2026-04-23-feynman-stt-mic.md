# 설계: 2026-04-23-feynman-stt-mic

**생성:** 2026-04-23 11:13
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-feynman-stt-mic
**브랜치:** task/2026-04-23-feynman-stt-mic

## 목표
Chrome 기준 브라우저 내장 Web Speech API(`webkitSpeechRecognition`)로 채팅 입력창에
마이크 토글 버튼을 추가해, 사용자의 음성을 텍스트로 변환해 textarea에 넣는다. 파인만
학습 모드를 포함해 공통 ChatInput을 쓰는 모든 채팅(파인만·자격증 학습·일반 채팅)에서
동일하게 동작한다.

핵심 정책 (사용자 확정):
- **범위:** 공통 `ChatInput` 에 기본 ON. 코드 단순성 우선.
- **자동 전송 X:** STT 결과가 textarea에 들어가기만 하고, 사용자가 Enter/전송 버튼을
  눌러야 실제 전송. 오인식 수정 여지 확보.
- **자동 종료 X:** `continuous=true`로 침묵이 길어도 끊기지 않는다. 사용자가 마이크
  버튼을 한 번 더 눌러야 중지. 권한 거부/네트워크 에러 같은 비정상 종료는 예외.
- **미지원 브라우저:** Safari 등 `window.SpeechRecognition`이 없는 환경은 버튼 자체를
  렌더링하지 않는다(기존 UI 불변).
- **마이크 차단 정책 해제:** `index.html`의 `Permissions-Policy`에서 `microphone=()` →
  `microphone=(self)` 로 변경 (same-origin 허용).

## 변경 범위
- **신규:** `src/hooks/useSpeechRecognition.js`
  - `window.SpeechRecognition || window.webkitSpeechRecognition` 래퍼 훅.
  - `supported`, `listening`, `start()`, `stop()` 노출 + `onTranscript(text, {isFinal})`
    콜백.
  - 내부 상태: recognition 인스턴스 ref, final 누적 버퍼 ref, 콜백 ref(리바인드 방지).
  - 에러: `not-allowed`/`service-not-allowed` → "마이크 권한이 필요합니다" 토스트,
    `no-speech`/`aborted`는 무시, 그 외 에러는 범용 메시지 토스트.
  - 언마운트 시 `.stop()` + 핸들러 null 처리.
- **수정:** `src/components/chat/ChatInput.jsx`
  - 공통 입력창. 녹음 시작 시점 textarea 값을 `speechBaseRef`에 저장, 인식 결과는
    `base + transcript` 형태로 textarea/valueRef/isEmpty를 동기화.
  - 전송 버튼 왼쪽에 Mic/MicOff 토글 버튼 (lucide-react).
    - 비녹음: 회색 배경, Mic 아이콘.
    - 녹음중: danger 배경 + `animate-pulse`, MicOff 아이콘, placeholder "음성 인식 중...".
  - 스트리밍 중(답변 생성 중)에는 마이크 버튼 disabled.
  - 미지원 브라우저에선 버튼 자체 미렌더.
- **수정:** `index.html`
  - `Permissions-Policy`의 `microphone=()` → `microphone=(self)`.
- **불변:** 전송 흐름(`onSend`, `useStreamingChat`, 백엔드 DTO) 전부 손대지 않는다.
  음성 → 텍스트 변환 후 기존 파이프라인을 그대로 탄다.

## 구현 계획
1. `useSpeechRecognition` 훅 작성
   - lang=`ko-KR`, continuous=true, interimResults=true 기본.
   - `event.resultIndex`부터 `event.results`를 순회해 `isFinal`이면 finalBuffer에 append,
     아니면 interim에 축적 후 매번 `onTranscript(finalBuffer + interim)` 호출.
   - onend에선 listening=false로만 전환(자동 재시작 X — 사용자 토글 정책).
2. `ChatInput` 수정
   - 훅 호출 → `supported=false`면 버튼 null 렌더.
   - `handleMicToggle`: listening이면 `stop()`, 아니면 현재 textarea 값을 `speechBaseRef`에 백업하고 `start()`.
   - `handleTranscript`: `speechBaseRef + " " + transcript` 합성 후 DOM value/valueRef/isEmpty/높이 업데이트.
   - 녹음 중 placeholder 토글, 스트리밍 중 disabled.
3. `index.html` Permissions-Policy 1줄 수정.
4. 검증:
   - `vite build` 성공 여부 (syntax/import 오류 체크).
   - 워크트리 vite를 **포트 3100**에서 띄워 사용자의 3000 서버와 충돌 회피.
   - HTTP로 `/src/components/chat/ChatInput.jsx` 응답에 Mic/MicOff/useSpeechRecognition
     심볼 포함 확인.
   - headless Chrome으로 첫 화면 DOM 렌더(예: `#root` 내 하위 요소 존재) 확인.
   - 실제 마이크 입력은 사용자 수동 검증 (브라우저 + 마이크 필요).

## 단위 테스트 계획
evidence/unit/notes.md 에 기록:

자동:
1. `vite build` 성공.
2. Dev 서버(3100)에서 ChatInput/useSpeechRecognition 번들 응답에 필수 심볼 포함.
3. headless Chrome으로 접속 시 `#root` DOM이 React 렌더 결과로 채워짐.

수동(사용자 검증 필요):
4. 파인만 학습 채팅에서 마이크 버튼(전송 왼쪽)이 노출.
5. 버튼 클릭 → 권한 허용 → 한국어 발화 → textarea 실시간 삽입.
6. 침묵 길어도 끊기지 않음 (자동 종료 없음).
7. 사용자가 마이크 재클릭 시 중지, 자동 전송 X.
8. Enter로 전송 시 기존 스트리밍 동작 정상.
9. 권한 거부 시 토스트.
10. 스트리밍 중 마이크 disabled.

## 회귀 테스트 계획
evidence/regression/notes.md 에 기록:
1. 일반 채팅(ChatContainer)에서 텍스트 전송 정상.
2. 마인드맵 열람/확장 정상.
3. 문서(PDF) 업로드 정상.
4. 자격증 모드 탭 전환 정상.
5. EmptyChatView(빈 상태)의 입력창에도 마이크가 노출되며 예시 질문 버튼 정상.

## 이전 시도와의 차이 / 실패 방지
- 2026-04-22 동일 슬러그로 한 번 시도 → "첫 화면이 안 뜸" 문제 발생 후 롤백.
- 당시 원인: STT 코드가 아니라 워크트리 vite가 **사용자 포트** 와 충돌,
  해결 과정에서 사용자 dev 서버를 임의 kill해 컨텍스트가 꼬임.
- 이번 재시도에선:
  - 사용자의 3000 포트는 **절대 건드리지 않는다**.
  - 내 워크트리 vite는 `--port 3100`으로 고정.
  - `node_modules`는 `ln -s` 심링크로 primary 참조.
