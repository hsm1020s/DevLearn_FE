# 설계: 2026-05-15-feynman-synth-cloud-llm

**생성:** 2026-05-15 13:45
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-15-feynman-synth-cloud-llm
**브랜치:** task/2026-05-15-feynman-synth-cloud-llm

## 목표
파인만 챕터별 사전 질문 자동 합성(`QuestionSynthesisService`)의 기본 LLM 을 로컬 Ollama(`gpt-oss-20b`) → 클라우드(`gpt-5.4-mini`) 로 전환한다. Ollama 가 켜져있지 않은 환경에서도 파이프라인 완료 시 `chapter_questions` 가 정상 채워져 파인만 학습 pre-gen 경로가 활성화되도록 한다.

### 해결하는 문제
- `dispatchQuestionSynthesis` 가 파이프라인 완료 직후 자동 호출되지만, 로컬 Ollama 가 꺼져 있으면 `Connection refused (localhost:11434)` 로 모든 챕터 Pass1 합성이 실패 → `chapter_questions` 가 비어있음 → `streamPreGen` 경로가 영원히 활성화 안 됨 → 직전 단계(`feynman-evaluator-extract`) 가 만들어둔 평가기가 실사용자에게 의미 없게 됨.

### 본 태스크가 다루지 않는 것 (의도적 스코프 축소)
- `FeynmanService.DEFAULT_LLM` (streamOnDemand fallback). 사용자가 보통 화면에서 LLM 을 명시 선택하므로 fallback 발화 빈도 낮음.
- `AnswerGraderService.DEFAULT_LLM` (`grade()` 호환 어댑터 진입 시 fallback). 신규 `evaluate()` 는 이미 사용자 LLM 을 따르므로 실사용 영향 거의 0.
- `StudyService.DEFAULT_LLM`.
- 위 셋은 본 태스크의 슬러그(`synth-cloud-llm`) 와 무관하므로 묶지 않는다.

## 변경 범위

### BE (`/Users/moon/IdeaProjects/DevLearn_BE`)

**1. `QuestionSynthesisService` LLM 주입 방식 변경**
- 파일: `src/main/java/com/moon/devlearn/feynman/service/QuestionSynthesisService.java`
- 현재: `private static final String DEFAULT_LLM = "gpt-oss-20b";` (라인 48)
- 변경: 마인드맵 합성과 동일한 패턴 채택
  - `@Value("${llm.synth.model:gpt-5.4-mini}")` 로 주입
  - 기존 Lombok `@RequiredArgsConstructor` 와 충돌이 있으면 명시 생성자 도입(MindmapSynthesisService 가 이미 같은 형태로 작성돼 있어 패턴 참고).
- `callAndParse(...)` 안의 `DEFAULT_LLM` 참조 2곳(`resolveModelId` + `llmClient.call`) 을 새 필드명으로 교체.
- 기존 상수는 삭제.

**2. `application.yml` 에 `llm.synth.model` 키 신규**
- 파일: `src/main/resources/application.yml`
- 위치: 기존 `llm.mindmap.model` 블록 옆에 동일 패턴으로 추가
  ```yaml
  llm:
    ...
    synth:
      model: ${SYNTH_MODEL:gpt-5.4-mini}
  ```
- 환경변수 `SYNTH_MODEL` 로 운영 시 override 가능.

### FE
변경 없음. 본 태스크는 BE 내부 디폴트 모델 교체만 다룬다.

## 구현 계획

1. `application.yml` 에 `llm.synth.model` 키 추가 (마인드맵 블록 옆).
2. `QuestionSynthesisService` 에서 `DEFAULT_LLM` 상수 제거, `@Value` 주입 필드 추가, `callAndParse` 내부 2곳 교체.
3. `./gradlew compileJava` 로 컴파일 확인.
4. BE 재시작 안내(사용자 측, IDE).
5. 검증 — 다음 절 참고.

## 단위 테스트 계획

**시나리오 A — synth LLM 설정 로드**
- BE 재시작 후 작은 PDF 한 건 업로드 → 풀 파이프라인 완료 → `chapter_questions` row 생성 확인. (Ollama 가 꺼진 상태에서도 성공해야 통과)

**시나리오 B — Pass1/Pass2 결과 로그**
- BE 로그에 `[Synth] Pass1` 단계가 OpenAI 호출로 성공하는지(`Connection refused` 아닌 정상 응답 로그).

**시나리오 C — pre-gen 경로 활성화**
- chapter_questions 가 채워진 챕터에 파인만 학습 진입 시 streamPreGen 이 발동(이전 태스크 평가기 흐름 작동)되어 답변 평가가 정상 수행되는지.

증거 경로: `.claude/state/evidence/2026-05-15-feynman-synth-cloud-llm/unit/notes.md`

## 회귀 테스트 계획

**회귀 대상 1**: 마인드맵 자동생성(`MindmapSynthesisService`) — 본 변경과 별개 LLM 키를 쓰지만 같은 OpenAI 인프라 의존. 본 변경 후에도 정상 동작 확인.
**회귀 대상 2**: streamOnDemand 채팅 — DEFAULT_LLM 무관(사용자 선택 LLM). 영향 없어야 함.
**회귀 대상 3**: 평가기(`feynman.evaluator`, 이전 태스크) — 사용자 선택 LLM 그대로 사용.

증거 경로: `.claude/state/evidence/2026-05-15-feynman-synth-cloud-llm/regression/notes.md`

## 위험 / 함정

- **OpenAI 호출 비용**: synth 는 문서 챕터 수 × Pass1+Pass2 호출이라 큰 문서(70챕터) 의 경우 토큰 비용이 적지 않다. 단, `gpt-5.4-mini` 자체가 저렴한 모델이고 마인드맵 합성도 같은 모델로 이미 같은 비용 영역에서 동작 중.
- **OpenAI API 키 미설정 환경**: `application.yml` 의 `llm.openai.api-key` 가 비어있으면 호출 실패. 다만 마인드맵 합성과 동일 조건이라 마인드맵이 도는 환경이면 합성도 도는 게 정상.
- **운영 환경 override**: `SYNTH_MODEL` 환경변수로 override 가능. 본 태스크는 dev 디폴트 변경에 한정.
- **검증 데이터 트리거**: 가장 확실한 검증은 새 PDF 업로드 → 풀 파이프라인. 비용·시간이 부담이면 작은 PDF 사용.
