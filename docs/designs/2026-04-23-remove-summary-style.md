# 설계: 2026-04-23-remove-summary-style

**생성:** 2026-04-23
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-remove-summary-style
**브랜치:** task/2026-04-23-remove-summary-style

## 목표
자격증/학습 채팅의 스타일 칩 3종(일반/파인만/한줄요약) 중 **한줄요약(`summary`) 제거**.
파인만/일반 스타일은 그대로 유지. 백엔드는 style 정보를 저장·사용하지 않으므로 BE 변경 없음.

## 변경 범위

### 프론트엔드
1. **`src/registry/stylePrompts.js`** — `STYLE_PROMPT.summary` 프롬프트 문자열 제거. `STYLE_INFO.summary` 뱃지 메타데이터 제거. 파일 자체는 유지(feynman 등 다른 스타일이 있을 수 있음).
2. **`src/utils/constants.js`** — `CHAT_STYLES` 배열에서 `{ value: 'summary', ... }` 행만 제거.
3. **`src/hooks/useStreamingChat.js`** — 내부 `STYLE_PROMPT` 리터럴에서 `summary` 필드 제거. "일반/한줄요약 — 기존 흐름" 주석을 "일반 스타일 흐름"으로 단순화.
4. **`src/components/chat/ChatMessage.jsx`** — "요약 스타일"로 다음 턴 전환하는 단축 버튼(Scissors 아이콘) 블록 전체 제거. `lucide-react` import에서 `Scissors` 제거.
5. **`src/services/mock/chatMock.js`** — `buildStyledResponse` 내 `summary` 분기 제거, `detectStyle`에서 `'한 문장 요약'` 감지 제거.
6. (연쇄) **`src/components/study/StudyStyleChips.jsx`** — `CHAT_STYLES.map`으로 칩을 그리므로 상수 배열에서 빠지면 UI가 자동 반영. 별도 수정 없음.

### 문서
7. **`docs/designs/2026-04-21-study-workspace-tabs.md`** — 한줄요약 언급 제거.
8. **`docs/designs/2026-04-22-fix-feynman-style-prompt.md`** — 한줄요약 관련 구절 제거(파인만 문맥은 유지).
9. **`docs/WORK_LOG.md`** — 이번 변경 요약 추가.

### 백엔드
- **변경 없음.** `ChatRequest`/`FeynmanChatRequest` DTO, `messages` 테이블 스키마 모두 style 정보를 담지 않음. 기존 조사로 확인됨.

## 구현 계획
1. 먼저 `src/registry/stylePrompts.js`, `src/utils/constants.js`의 *정의 소스* 를 편집해 `summary` 참조를 제거. (여기 지우면 의존 파일에서 컴파일러/런타임이 미참조로 만듦.)
2. 실제 소비자인 `useStreamingChat.js`, `ChatMessage.jsx`, `chatMock.js`에서 `summary` 분기/UI 제거.
3. 문서 파일에서 관련 문장 삭제.
4. 검증:
   - `vite build` 성공 (dead import/undefined key 체크).
   - 워크트리 dev 서버를 포트 3100에서 띄워 headless Chrome으로 `#root` 렌더 확인.
   - `curl` 로 `StudyStyleChips.jsx`/`ChatMessage.jsx` 번들에서 `summary`/`Scissors` 문자열이 **더 이상 포함되지 않음**을 확인.
5. 사용자 Chrome 수동 검증(간단): 학습 탭 스타일 칩에 "한줄요약"이 보이지 않음 & 파인만/일반은 그대로.

## 단위 테스트 계획 (evidence/unit/notes.md)
자동:
1. `vite build` 성공.
2. Dev 서버 응답에서 `Scissors`, `summary` 심볼이 관련 번들에서 제거됨.
3. Headless Chrome `#root` DOM 정상 렌더.

수동 (사용자 빠른 확인):
4. 학습 채팅 스타일 칩 영역에 "한줄요약" / ✂️ 없음. "일반" / "파인만" 둘만 보임.
5. 어시스턴트 메시지 하단에 "요약 스타일" 버튼 없음.

## 회귀 테스트 계획 (evidence/regression/notes.md)
1. 파인만 모드 스타일 칩 선택·고정 토글 정상.
2. 일반 채팅 전송/스트리밍 정상.
3. 과거에 `style:'summary'`로 저장된 대화가 있어도 런타임 에러 없이 로드 (뱃지 누락은 허용).
4. 채팅 입력창 STT 마이크 버튼(어제 추가한 기능) 회귀 없음.
