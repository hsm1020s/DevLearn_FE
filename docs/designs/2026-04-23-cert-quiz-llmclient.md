# 설계: 2026-04-23-cert-quiz-llmclient

**생성:** 2026-04-23 13:11
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-cert-quiz-llmclient
**브랜치:** task/2026-04-23-cert-quiz-llmclient

## 목표
자격증 퀴즈 생성이 OpenAI 직결(RestTemplate) 코드로 돌아가고 있어 `OPENAI_API_KEY` 가
비어 있으면 스텁 문제가 나온다. 파인만/일반 채팅처럼 공용 `LlmClient` 를 사용해
사용자가 선택한 LLM(기본은 로컬 `gpt-oss-20b`)으로 문제를 생성하도록 교체한다.

## 변경 범위

### 백엔드
1. **`StudyService`**
   - `openaiApiKey` / `openaiModel` / `OPENAI_API_URL` / `RestTemplate` 관련 필드·코드 제거.
   - `LlmClient` 주입(`chat.service.LlmClient`).
   - `callLlmForQuiz(prompt, llm)` 으로 시그니처 변경. 내부에서
     `llmClient.call(List.of(new ChatMessage("user", prompt)), llm)` 호출.
   - `generateQuiz` 에서 `request.getLlm()` 이 비어 있으면 `DEFAULT_LLM = "gpt-oss-20b"`
     (파인만과 동일) fallback.
   - LLM 호출 실패(`BusinessException` 등) 시 기존과 동일하게 스텁 폴백 — try/catch 로
     방어.
   - 불필요해진 `org.springframework.http.*` / `RestTemplate` / `RestClientException` /
     `HttpEntity` / `HttpHeaders` / `HttpMethod` / `MediaType` / `ResponseEntity` import 정리.
2. **`QuizGenerateRequest`**
   - `llm` String 필드 추가(옵션). 기본값은 서비스 레벨에서 처리.

### 프론트
3. **`QuizSettings.jsx`**
   - `useAppStore.selectedLLM` 구독 추가.
   - `generateQuiz(...)` 호출 시 `llm: selectedLLM` 필드 포함.
4. **`studyApi.generateQuiz`** / mock — params 그대로 통과하므로 변경 없음.

### 테스트
5. **`StudyServiceTest.generateQuiz_stubMode_generatesStubQuestions`**
   - `@Mock LlmClient llmClient` 추가.
   - `llmClient.call(any(), any())` 가 null 반환(=LLM 실패 시뮬레이션) → 스텁 폴백 경로.
   - `ReflectionTestUtils.setField(..., "openaiApiKey", "")` 제거.
6. **`StudyControllerTest`** — DTO 생성자 인자 +1 (llm). null 허용.

## 구현 계획
1. `QuizGenerateRequest.llm` 필드 추가.
2. `StudyService` LlmClient 연동 — 기존 OpenAI 직결 로직 삭제.
3. 프론트 `QuizSettings` 에서 `selectedLLM` 실어 보내기.
4. 백엔드 컴파일 + 테스트 컴파일 확인. 서비스 테스트 로직 업데이트.
5. 프론트 빌드 + headless 렌더 확인.

## 단위 테스트 계획
자동:
1. BE: `./gradlew compileJava compileTestJava --rerun-tasks` 성공.
2. BE: `StudyService` 에서 `RestTemplate`/`OPENAI_API_URL` grep 0건.
3. FE: `vite build` 성공, QuizSettings 번들에 `selectedLLM`/`llm` 필드 포함.
4. FE: headless Chrome 첫 화면 렌더 정상.

수동:
5. 사이드바 LLM 드롭다운을 로컬(`gpt-oss-20b`)로 두고 자격증 퀴즈 생성 → "[스텁]"
   아닌 실제 문제가 출제됨.

## 회귀 테스트 계획
1. 파인만 대화형 학습 / 파이프라인 / 업로드 정상.
2. 자격증 퀴즈 풀이·채점·통계 정상.
3. 사용자별 문서 격리(지난 태스크) 유지.
