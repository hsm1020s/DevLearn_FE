# 설계: 2026-04-27-llm-pipeline-monitor

**생성:** 2026-04-27 13:30
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-27-llm-pipeline-monitor
**브랜치:** task/2026-04-27-llm-pipeline-monitor

## 목표
로컬 LLM(Ollama 기반 `gpt-oss-20b`, `nomic-embed-text` 등)이 **현재 어떤 호출자**로부터 **무슨 작업**을 받아 **어떤 입력을 가지고** **얼마나 진행됐는지**를 한 페이지에서 실시간으로 볼 수 있게 한다.

권한 없이 접근 가능한 `/llm-activity` 페이지를 새로 만들어서:
- 진행 중인 호출(In‑Flight) 카드 — 호출자(source) · 모델 · 작업(action) · 타깃(docId/chapter/conversationId 등) · 시작 시각 · 경과 시간 · 입력 토큰/문자 수
- 최근 완료/실패 로그 (최근 N건, ring buffer)
- 누적 통계 (소스별 호출 수 · 평균 지연 · 실패율)

호출 경로는 두 갈래:
- **Java 측 LlmClient** — 채팅, 파인만(검증/스트림/채점/질문합성), 스터디 퀴즈, 마인드맵 합성
- **Python 파이프라인** (`run_pipeline.py` → extractor / toc_extractor / group_chapters / embedder) — Ollama HTTP를 직접 호출, stdout을 Java가 읽고 있음

## 변경 범위

### Backend (Java)
- **신규** `chat/service/llm/LlmActivityRegistry.java` — 인메모리 레지스트리 (ConcurrentHashMap + Deque ring buffer). 이벤트 메서드: `started/finished/failed`, 조회 메서드: `snapshot()`.
- **신규** `chat/service/llm/LlmActivityContext.java` — `ThreadLocal<Deque<ActivityFrame>>` 기반 try-with-resources 컨텍스트. 호출자가 source/action/target을 `scope()` 로 푸시, OllamaProvider가 시작 시 peek해서 Registry에 등록.
- **수정** `chat/service/llm/OllamaProvider.java` — `call`/`stream` 시작/종료/실패 시 Registry에 이벤트 송신. context가 없으면 `source=unknown` 으로 그래도 기록.
- **수정** 호출자 6곳에 `try (var s = LlmActivityContext.scope(source, action, target)) { ... }` 래핑
  - `chat/service/ChatService.java` (call, stream)
  - `feynman/service/FeynmanService.java` (verifyExplanation, streamFeynmanChat 폴백)
  - `feynman/service/AnswerGraderService.java` (grade)
  - `feynman/service/QuestionSynthesisService.java` (synthesize)
  - `mindmap/service/MindmapSynthesisService.java` (generate)
  - `study/service/StudyService.java` (generateQuiz)
- **수정** `feynman/service/FeynmanService.java` Python 파이프라인 reader 루프 (현재 268라인 부근) — stdout 라인이 `[LLM-EVT] {json}` 으로 시작하면 JSON 파싱 후 Registry에 직접 푸시. 그 외는 기존대로 `log.info`.
- **신규** `monitor/controller/LlmActivityController.java` — `GET /api/public/llm-activity` (permitAll). 응답: `{ inflight: [...], recent: [...], stats: {...}, serverTimeMs }`.
- **수정** `config/SecurityConfig.java` — `/api/public/**` 화이트리스트 추가.

### Python 파이프라인
- **신규 헬퍼** `scripts/feynman_pipeline/llm_event.py` — `emit(jobId, source, action, target, model, phase, extra)` → 한 줄 JSON을 `[LLM-EVT]` 프리픽스로 stdout에 쓰는 함수. `time.monotonic()` 기반 jobId 자동 생성.
- **수정** `embedder.py` — 각 청크 임베딩 호출 직전/직후에 `emit("started"/"finished")`, target에 `docId/chapter/seq` 동봉. 모델은 `nomic-embed-text`.
- **수정** `group_chapters.py`, `toc_extractor.py` — LLM 호출 (있다면) 동일 패턴으로 래핑. 없으면 단계 진입/이탈만 알리는 `phase=stage` 이벤트 1쌍.
- 표준 Python `print(..., flush=True)` 만 사용 — stdout이 이미 Java reader로 흐름.

### Frontend
- **신규 라우트** `/llm-activity` (App.jsx 라우터에 등록, 인증 가드 우회)
- **신규** `src/pages/LlmActivityPage.jsx` — 2초 폴링, 카드/통계/최근 로그 3섹션
- **신규** `src/services/monitorApi.js` — `fetchLlmActivity()` (axios baseURL 동일, **Authorization 헤더 미부착**: 별도 axios 인스턴스 또는 `fetch` 사용)
- 사이드바 / 헤더에 작은 "🔍 모니터" 링크 (선택)

### 보안 메모
공개 엔드포인트지만 응답에는 **파일명·사용자 이메일·실제 프롬프트 내용은 포함하지 않는다.** docId/conversationId/chapter는 식별자만, 입력은 길이(문자수·메시지수)만 노출. 후속에서 `/api/admin/llm-activity` 로 풀-디테일 버전을 따로 둘 수 있음.

## 구현 계획

1. **BE 레지스트리/컨텍스트** — `LlmActivityRegistry`, `LlmActivityContext` 두 클래스 + 단위 동작 확인(스프링 컨텍스트 없이 main).
2. **OllamaProvider 계측** — `call`/`stream` 시작/끝/예외에서 Registry 호출. context 없을 때 fallback.
3. **호출자 컨텍스트 래핑** — 6곳에 `LlmActivityContext.scope(...)` 추가.
4. **공개 엔드포인트 + Security** — `/api/public/llm-activity` + permitAll.
5. **Python 이벤트** — `llm_event.py` + `embedder.py` 부터 적용. Java reader에서 `[LLM-EVT]` 파싱 → Registry.
6. **FE 페이지** — `/llm-activity` 라우트 + 폴링 컴포넌트. CSS 변수 사용, 카드/뱃지 톤 맞추기.
7. **수동 검증** — 파인만 파이프라인 1회 실행 + 채팅 1회 + 마인드맵 1회 돌려 활동이 페이지에 뜨는지 확인.

## 단위 테스트 계획

- BE 컴파일 + 부팅 (`./gradlew bootRun` 헬스 OK)
- Ollama 직접 호출 1건 → `/api/public/llm-activity` 응답에 inflight → 종료 후 recent 이동
- 파이프라인 1회 실행 → embedder의 chunk 이벤트가 페이지에 흐르는 것 확인
- 권한 없는(로그아웃 상태) 브라우저에서 `/llm-activity` 진입 가능 확인
- FE: `npm run build` 성공
- 결과는 `.claude/state/evidence/2026-04-27-llm-pipeline-monitor/unit/notes.md`

## 회귀 테스트 계획

- 일반 채팅 스트리밍 정상 동작 (계측이 응답 깨지 않는지)
- 마인드맵 자동 생성 정상 (MindmapSynthesisService)
- 문서 업로드/파이프라인 정상 종료 (status=completed)
- 인증 가드: `/llm-activity` 외 기존 보호 라우트는 여전히 비로그인 시 막힘
- 결과는 `.claude/state/evidence/2026-04-27-llm-pipeline-monitor/regression/notes.md`
