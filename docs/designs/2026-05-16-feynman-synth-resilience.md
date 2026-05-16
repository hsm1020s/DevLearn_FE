# 설계: 2026-05-16-feynman-synth-resilience

**생성:** 2026-05-16 14:42
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-16-feynman-synth-resilience
**브랜치:** task/2026-05-16-feynman-synth-resilience

## 목표
[1줄 요약] 직전 두 태스크에서 만든 [지식 재구축] 액션이 OpenAI 429 rate-limit 한 번에 거의 모든 챕터 질문 합성을 실패시키고도 사용자에겐 "완료" 토스트가 뜨는 **거짓 완료(false-success)** 문제를 해결한다. (1) BE 합성기에 429-aware 재시도/백오프 + 챕터별 직렬 처리, (2) FE 진행률을 **마인드맵 + 챕터 질문 두 단계**로 확장해 둘 다 100% 일 때만 완료로 보고, (3) 실패한 챕터가 있으면 토스트가 거짓 말하지 않게 한다.

### 본 태스크가 해결하는 사용자 의도
- "재구축 완료라고 떴는데 채팅은 폴백 경로" 라는 가장 큰 신뢰 문제.
- 한 번 더 누를지 vs 30분 기다릴지 결정할 수 있는 명확한 신호.

### 본 태스크가 다루지 않는 것 (의도적 스코프 축소)
- **모델 자동 fallback**(gpt-4o → gpt-4o-mini) — 비용/품질 트레이드오프가 운영 정책 결정이라 본 단계에서 X.
- **합성 큐 전체 재설계**(Redis/Quartz 등) — `@Async` ThreadPool 로 충분, 본 단계는 동시성 제어만.
- **사용자별 RPM/TPM 추적** — OpenAI 한도는 조직 전역이라 사용자별 분리 의미 적음.
- **재시도 진행 디테일 UI 노출** — "x번째 재시도 중" 등은 노이즈. UI 는 m/N 만.

## 변경 범위

### BE (`/Users/moon/IdeaProjects/DevLearn_BE`)

**1. `QuestionSynthesisService.callJsonLlm` — 429-aware 재시도/백오프**
- 현재: `for (attempt 1..2)` 즉시 재시도, 백오프 없음.
- 변경: 최대 **5회** 재시도. 에러 메시지에서 OpenAI 의 `try again in 9.778s` 패턴을 정규식 추출 → 그 초만큼 sleep. 패턴 없으면 exponential backoff (`min(2^attempt, 60)s`). 비-429 에러(파싱/네트워크) 는 즉시 1회만 재시도 후 폴백.
- 패턴 인식 정규식:
  ```java
  static final Pattern RETRY_AFTER = Pattern.compile("try again in ([0-9.]+)s");
  static final Pattern RATE_LIMIT  = Pattern.compile("429|rate.?limit|too many requests", CASE_INSENSITIVE);
  ```
- 시도 사이 sleep 은 `Thread.sleep` (이미 `@Async` 컨텍스트, 직렬 처리라 worker 한 개만 점유).
- 마지막 시도까지 실패 시 기존처럼 null. 호출자는 그대로(해당 노드 skip 후 다음).

**2. `MindmapSynthesisService.generateSelectedAsync` — 챕터별 직렬화**
- 현재: 모든 챕터를 `CompletableFuture` 로 병렬 launch → 한 문서가 챕터 10개면 10개 LLM 호출 동시.
- 변경: `application.yml` 의 `feynman.synth.concurrency` (기본 1) 로 동시성 제한. `Semaphore` + `try/finally release`.
- 직렬 처리(기본 1) 가 적합한 이유: 한 챕터 ~30초 × 10챕터 = ~5분. rate-limit 회피 이득이 훨씬 큼.
- `rebuildChapterFromMindmapAsync` 도 같은 Semaphore 공유.

**3. 신규 진행률 엔드포인트 — `GET /api/feynman/{docId}/rebuild-progress`**
- 응답:
  ```json
  {
    "totalChapters": 12,
    "mindmapsReady": 12,
    "questionsReady": 9,
    "complete": false
  }
  ```
- 계산:
  - `totalChapters` = toc 의 챕터 수.
  - `mindmapsReady` = `SELECT COUNT(*) FROM mindmaps WHERE doc_id=? AND deleted_at IS NULL`.
  - `questionsReady` = `SELECT COUNT(DISTINCT chapter) FROM chapter_questions WHERE doc_id=?`.
  - `complete = (mindmapsReady == total) && (questionsReady == total)`.

**4. 신규 매퍼 SQL**
- `ChapterQuestionMapper.xml` 에 `countDistinctChaptersByDoc`.
- `MindmapMapper.xml` 에 `countByDocId` (deleted_at IS NULL 조건).

**5. `FeynmanService.getRebuildProgress` + `FeynmanController` 엔드포인트**
- assertDocOwner 후 SQL 2개 + toc 기반 totalChapters 조회. POJO 또는 Map 반환.

### FE (`/Users/moon/DevLearn_FE`)

**6. `services/feynmanApi.js`**
- `fetchRebuildProgress(docId)` 신규 export.

**7. `useRebuildProgress` 훅 개편**
- 현재: `fetchChapterStatuses(docId)` 폴링, 마인드맵만 추적.
- 변경:
  - `fetchRebuildProgress(docId)` 로 교체.
  - 엔트리 구조 확장:
    ```ts
    type RebuildEntry = {
      docId; startedAt;
      totalChapters; mindmapsReady; questionsReady;
      phase: 'wiping' | 'generating' | 'finalizing' | 'done';
    };
    ```
  - `phase` 산정:
    - totalChapters===0 → `wiping`
    - mindmapsReady < total → `generating`
    - mindmapsReady === total && questionsReady < total → `finalizing`
    - complete === true → `done`
  - `complete === true` 즉시 done 처리 (5초 grace 제거).
  - 30분 stale 도달 시 done 대신 **실패 토스트** 발화: "[재구축 미완료] 일부 챕터 합성이 실패했습니다 (rate-limit 가능성). 잠시 후 [지식 재구축] 을 다시 눌러주세요."

**8. `RebuildProgressInline` 두 단계 표시**
- `generating`: "마인드맵 재합성 중 — m/N 챕터" + 바 (mindmapsReady/total).
- `finalizing`: "면접 질문 합성 중 — m/N 챕터" + 바 (questionsReady/total).

**9. `FeynmanPipelineTab` 버튼 라벨**
- `finalizing` 일 때 `면접 질문 합성 중... (m/N)` 으로 표시 — 거짓말 안 하도록.

### 설정
- `application.yml`:
  ```yaml
  feynman:
    synth:
      concurrency: ${SYNTH_CONCURRENCY:1}
      max-retries: ${SYNTH_MAX_RETRIES:5}
      retry-base-seconds: ${SYNTH_RETRY_BASE:2}
  ```

## 구현 계획

### Step A — BE 재시도/백오프
1. `QuestionSynthesisService.callJsonLlm` 의 attempt loop 재작성. 429 패턴 인식 + `Thread.sleep` 백오프. `@Value` 주입.

### Step B — BE 동시성 제한
2. `MindmapSynthesisService` 의 챕터별 future launch 를 `Semaphore(concurrency)` 로 감쌈. 직렬 기본값.

### Step C — BE 진행률 매퍼/서비스/엔드포인트
3. 매퍼 SQL 2개 추가.
4. `FeynmanService.getRebuildProgress` 구현.
5. `FeynmanController` 에 `GET /{docId}/rebuild-progress`.

### Step D — FE API + 훅
6. `feynmanApi.js` 에 `fetchRebuildProgress`.
7. `useRebuildProgress` 의 폴링 함수/엔트리 구조 갱신.

### Step E — FE 인디케이터/버튼
8. `RebuildProgressInline` phase 별 분기 갱신.
9. `FeynmanPipelineTab` 버튼 라벨 분기 갱신.

### Step F — 검증
10. `./gradlew compileJava` + Vite HMR. 실제 동작: [지식 재구축] 다시 클릭 → 직렬 처리 + 백오프로 정상 합성 확인.

## 단위 테스트 계획

증거: `.claude/state/evidence/2026-05-16-feynman-synth-resilience/unit/notes.md`

**시나리오 A — 429 백오프 후 성공**
- 합성 1회차 429 + "try again in 9.778s" → 약 10초 sleep → 2회차 호출 성공 → JSON 반환.
- 로그에 백오프 라인 확인.

**시나리오 B — 5회 모두 실패 시 graceful fallback**
- null 반환 → 노드 skip → 다른 노드/챕터 계속 진행.
- FE 화면에서 questionsReady < total 로 표시되어 완료 토스트 안 뜸.

**시나리오 C — 직렬 처리 검증**
- 챕터 10개에 대해 동시 1개만 LLM 호출 도는지 로그 시간으로 확인.

**시나리오 D — 진행률 엔드포인트**
- 상태별 mindmapsReady/questionsReady/complete 값이 의도대로.

**시나리오 E — FE 두 단계 표시**
- 마인드맵 진행 중 / 마인드맵 100% 질문 진행 중 / 둘 다 100% 각 phase 별 텍스트와 버튼 라벨이 정확히 분기.

**시나리오 F — 30분 타임아웃 실패 토스트**
- 30분 경과해도 complete=false → 엔트리 정리 + 실패 토스트.

## 회귀 테스트 계획

증거: `.claude/state/evidence/2026-05-16-feynman-synth-resilience/regression/notes.md`

- **회귀 1 — 파이프라인 합성(`dispatchQuestionSynthesis`)**: 같은 `callJsonLlm` 사용. 백오프로 시간은 늘지만 실패율 감소.
- **회귀 2 — 마인드맵 수동 생성(`POST /mindmap/generate/{docId}`)**: 동시성 제한 적용. 챕터가 동시에 끝나지 않고 순차 완성. 완료 시점은 비슷.
- **회귀 3 — 직전 태스크 인디케이터**: 다른 엔드포인트로 교체됨. 직전 코드 호환성은 필요 없음(막 만든 코드).
- **회귀 4 — 일반 채팅 / 마인드맵 캔버스 / 인증**: 변경 없음.

## 위험 / 함정

- **`Thread.sleep` 이 worker 점유** — 직렬(concurrency=1) 이므로 1 thread 만 점유. OK.
- **30000 TPM 한도가 너무 작음** — 모델 변경(gpt-4o-mini) 이 근본 해결. 본 단계는 회피만, 정책은 별도 task.
- **`failed` BE 시그널 부재** — stale 30분 도달이 유일 실패 인식. 30분은 길다. 후속에 `lastSynthError` 인-메모리 마커 추가 고려.
- **마인드맵/질문 합성이 같은 thread pool 공유** — 별도 풀 분리는 본 스코프 외.
- **`questionsReady` 가 "챕터별 1건 이상" 기준** — 챕터 안 일부 노드 미커버 시에도 ready=1. 정밀도 부족하지만 본 UI 충분(부족 노출은 채팅에서 자연).
