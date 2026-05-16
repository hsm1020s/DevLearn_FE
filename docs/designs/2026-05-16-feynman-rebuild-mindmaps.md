# 설계: 2026-05-16-feynman-rebuild-mindmaps

**생성:** 2026-05-16 14:06
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-16-feynman-rebuild-mindmaps
**브랜치:** task/2026-05-16-feynman-rebuild-mindmaps

## 목표
[1줄 요약] 파이프라인 완료 후 **마인드맵 + chapter_questions + answer_attempts 를 한 번에 wipe 한 뒤 마인드맵을 재합성**하는 "지식 재구축" 액션을 만든다. 합성 hook 연쇄로 chapter_questions 까지 자동 재생성 → 파인만 마스터리(`streamPreGen`) 경로가 정상 가동된다. UI 는 `FeynmanPipelineTab` 의 문서 행에 작은 새로고침 버튼 + 위험 동작 팝오버 confirm 으로 노출한다.

### 본 태스크가 해결하는 사용자 의도
- 이미 파이프라인을 통과한 옛 문서(예: "SQL 전문가 가이드") 가 `chapter_questions` 0건이라 파인만 채팅이 레거시 `streamOnDemand` 폴백을 타는 문제 — 진행 바/채점/마스터리 카드 전부 미동작.
- 앞으로 동일 상황이 다른 문서에서도 발생할 수 있으니 **운영 액션을 화면에 박아둔다**. CLI/DB 접속 없이 사용자가 직접 복구.

### 본 태스크가 다루지 않는 것 (의도적 스코프 축소)
- **PDF 재추출 / 청크 재임베딩** — 비용·시간 큼. 본 액션은 마인드맵+질문 레이어만 갈아엎고 `documents`/`chunks` 는 보존.
- **전 문서 일괄 재구축** — 운영자 batch tool 영역. 본 단계는 문서 1건 단위.
- **부분 챕터 재구축** — chapter 단위 wipe 는 SQL 가지수가 늘고 mindmap 합성도 chapter-list 입력이라 UI 가 복잡해짐. 1차로는 "문서 전체" 1가지.
- **재구축 진행률 실시간 표시** — 마인드맵 합성은 챕터별 비동기로 시간이 걸리지만, 기존 `mindmap/chapters/{docId}` 폴링과 `FeynmanPipelineTab` 의 3초 폴링이 이미 상태를 갱신하므로 별도 진행률 UI 추가 없이 재사용.

## 변경 범위

### BE (`/Users/moon/IdeaProjects/DevLearn_BE`)

**1. 신규 매퍼 SQL — `FeynmanMapper.xml` 보강**

기존 `deleteDoc` 흐름의 SQL(answer_attempts → chapter_questions → mindmaps) 을 그대로 재활용한다.
다만 `deleteDoc` 은 문서 전체를 삭제하는 흐름이라 `chunks`, `documents` row 까지 지운다 — 재구축에서는 그 두 단계가 빠져야 한다.
재사용 가능하게 분리:

```xml
<!-- 기존 -->
<delete id="deleteAnswerAttemptsByDoc">...</delete>
<delete id="deleteChapterQuestionsByDoc">...</delete>
<delete id="deleteMindmapsByDoc">...</delete>
```

이미 위 3개가 분리돼 있으면 **새 SQL 없이** Service 에서 그 3개만 호출. (체크 후 누락이면 alias 신설)

**2. 신규 Service 메소드 — `FeynmanService.rebuildKnowledge`**
- 파일: `feynman/service/FeynmanService.java`
- 시그니처:
  ```java
  /**
   * 마인드맵/질문/평가 이력을 wipe 한 뒤 마인드맵 합성을 비동기로 재시작한다.
   * 마인드맵 합성 완료 시 MindmapSynthesisService 의 lazy hook 이
   * QuestionSynthesisService.synthesizeAsync 를 자동 호출하므로 chapter_questions 도 자연 갱신된다.
   *
   * @return wipe 된 row 수 요약 {answerAttempts, chapterQuestions, mindmaps}
   */
  @Transactional
  public Map<String, Integer> rebuildKnowledge(String userId, String docId) { ... }
  ```
- 구현 흐름:
  1. `assertDocOwner(userId, docId)` — 권한 체크 (관리자 X — 본인 문서만).
  2. 문서 status 가 `completed` 인지 확인. 아니면 `IllegalStateException("재구축은 학습 가능 상태에서만 실행 가능합니다")`. 진행 중 파이프라인을 건드리면 BE 가 일관성 잃음.
  3. `feynmanMapper.deleteAnswerAttemptsByDoc(docId)` → `deleteChapterQuestionsByDoc` → `deleteMindmapsByDoc` 순. row 수 집계.
  4. toc 에서 전체 챕터 목록 추출(`feynmanMapper.findTopicsByDocId`) → `mindmapSynthesisService.generateSelectedAsync(userId, docId, allChapters)` 호출.
  5. row 수 + chapters 수 반환.

**3. 신규 컨트롤러 엔드포인트 — `FeynmanController`**
- 파일: `feynman/controller/FeynmanController.java`
- 추가:
  ```java
  @Operation(summary = "파인만 지식 재구축",
      description = "문서의 마인드맵/질문/답변 이력을 모두 지우고 마인드맵을 다시 합성합니다. 학습 이력이 사라집니다.")
  @PostMapping("/{docId}/rebuild-knowledge")
  public ApiResponse<Map<String, Object>> rebuildKnowledge(@PathVariable String docId) {
      String userId = SecurityUtil.getCurrentUserId();
      Map<String, Integer> counts = feynmanService.rebuildKnowledge(userId, docId);
      return ApiResponse.success(Map.of(
          "docId", docId,
          "deleted", counts,
          "message", "마인드맵 재합성이 시작되었습니다. 완료까지 수십 초~몇 분 소요됩니다."
      ));
  }
  ```
- URL prefix 는 컨트롤러의 `@RequestMapping` 그대로 (`/api/feynman`). 최종 경로: `POST /api/feynman/{docId}/rebuild-knowledge`.
- **권한**: 컨트롤러 메소드 단에서 `assertDocOwner` 가 Service 내부로 들어가 있으므로 별도 어노테이션 불필요. ADMIN/USER 모두 본인 문서에 대해 실행 가능. SecurityFilter 의 인증된 사용자만 통과.

### FE (`/Users/moon/DevLearn_FE`)

**4. API 클라이언트 — `feynmanApi.js`**
- 파일: `src/services/feynmanApi.js`
- 추가:
  ```js
  /**
   * 문서의 마인드맵/질문/답변 이력을 모두 지우고 마인드맵을 재합성한다.
   * 비동기 — 호출 즉시 200 반환, 합성 진행은 mindmap chapters API 폴링으로 추적.
   */
  export async function rebuildKnowledge(docId) {
    return apiClient.post(`/feynman/${docId}/rebuild-knowledge`).then(r => r.data?.data);
  }
  ```

**5. UI — `FeynmanPipelineTab` 문서 행에 액션 버튼**
- 파일: `src/components/feynman/FeynmanPipelineTab.jsx`
- 위치: 기존 행 우측 액션 그룹(현재 `PlayCircle` 재실행 / `Trash2` 삭제 옆)에 작은 `RefreshCw` 아이콘 버튼 추가.
- 활성 조건: `status === 'completed'` 인 문서만. 그 외에는 disabled + 툴팁 "학습 가능 상태에서만 실행 가능".
- 버튼 클릭 → **팝오버 confirm** 표시. (CLAUDE.md: 위험 동작은 모달 X, 팝오버 우선.) 팝오버 본문:
  ```
  📌 지식 재구축
  마인드맵 / 면접 질문 / 답변 이력을 모두 지우고
  마인드맵부터 다시 합성합니다.

  · 학습 이력(점수, 통과 기록)이 사라집니다.
  · 합성 완료까지 수십 초~몇 분 걸립니다.
  · 청크/임베딩/원문은 보존됩니다.

  [취소]  [재구축]
  ```
- "재구축" 클릭 → `rebuildKnowledge(docId)` → 성공 토스트("재구축 시작됨, 잠시 후 새로고침하면 진행 상태가 갱신됩니다") + 폴링은 기존 3초 주기가 이미 돌고 있으니 추가 작업 없음.
- 실패 시 `showError` 로 BE 메시지 표시 (`IllegalStateException` 의 한국어 메시지 그대로).

**6. 팝오버 컴포넌트 — 공용 확장**
- 기존에 삭제 confirm 으로 쓰는 팝오버가 있다면 재사용. 없으면 인라인 `<div className="absolute z-30 ...">` 한 덩어리.
- 디자인 토큰: `bg-bg-primary` / `border-border-light` / 위험 동작 강조는 `text-danger`.
- 외부 클릭 / Esc → 닫힘. 본 컴포넌트가 너무 비대해지면 `FeynmanPipelineTab` 같은 자리에서 이미 사용하는 패턴을 그대로 모사.

**7. 채팅 store 영향**
- 재구축 직후 사용자가 같은 챕터로 채팅 계속하면 `chapter_questions` 가 비어있는 시간 창(합성 중) 동안 `hasPreGen=false` 폴백 경로가 잠시 돈다 — 의도된 동작. 사용자에게는 "재합성 중이라 진행도 표시가 잠시 안 보일 수 있어요" 정도의 자연스러운 UX. 별도 가드 X.

## 구현 계획

### Step A — BE 매퍼 정합
1. `FeynmanMapper.xml` / `.java` 에 `deleteAnswerAttemptsByDoc`, `deleteChapterQuestionsByDoc`, `deleteMindmapsByDoc` SQL 이 이미 분리돼 있는지 확인. 없으면 `deleteDoc` 통합 SQL 에서 잘라서 신설(원본 동작은 그대로 — `deleteDoc` 은 새 3개를 순차 호출하는 형태로 리팩터, 부수효과 0).

### Step B — BE Service
2. `FeynmanService.rebuildKnowledge(userId, docId)` 구현 — 권한·상태 가드 + 3-step wipe + `mindmapSynthesisService.generateSelectedAsync` 호출.

### Step C — BE Controller
3. `POST /api/feynman/{docId}/rebuild-knowledge` 엔드포인트 + Swagger 어노테이션 + 에러 매핑.

### Step D — FE API + UI
4. `feynmanApi.js` 에 `rebuildKnowledge(docId)` 추가.
5. `FeynmanPipelineTab.jsx` 문서 행 액션 그룹에 `RefreshCw` 버튼 + 인라인 confirm 팝오버 + 토스트 핸들링.

### Step E — 검증
6. `./gradlew compileJava` + FE Vite HMR 통과 확인.
7. 실제 문서 1건(SQL 전문가 가이드 등 hasPreGen=false 인 것) 로 재구축 → 폴링 갱신 → 합성 끝난 뒤 파인만 채팅 진입 → `### 채점 결과` / `### 다음 질문 (m/N 노드 통과)` / 진행 바 정상 노출 확인.

## 단위 테스트 계획

증거: `.claude/state/evidence/2026-05-16-feynman-rebuild-mindmaps/unit/notes.md`

**시나리오 A — 정상 재구축(완료 상태 문서)**
- 사전: `chapter_questions` row 가 0 인 옛 문서 1건 (예: SQL 전문가 가이드, status=completed).
- `POST /api/feynman/{docId}/rebuild-knowledge` 호출 → 200 + `deleted: {answerAttempts:0, chapterQuestions:0, mindmaps:N}`.
- 합성 후 DB 에서 `SELECT count(*) FROM chapter_questions WHERE doc_id=...` > 0 확인.
- 파인만 채팅 진입 → "### 다음 질문" 헤더 + 정답세트 라벨 노출.

**시나리오 B — 학습 이력 있는 문서 재구축**
- 사전: 다른 문서에서 답변 attempts 가 누적된 상태.
- 재구축 호출 → `deleted.answerAttempts > 0` 확인. 채팅 진행도가 0/N 으로 리셋.

**시나리오 C — 비완료 상태 가드**
- status=`embedding` 등 진행 중 문서로 호출 → 400 + 한국어 메시지 "재구축은 학습 가능 상태에서만 실행 가능합니다".
- FE 버튼은 disabled 라 정상 흐름에서는 도달 불가 — 직접 curl 으로 검증.

**시나리오 D — 권한 가드**
- 다른 사용자 docId 로 호출 → 403 / 404 (assertDocOwner 결과).

**시나리오 E — FE 팝오버 confirm**
- 버튼 클릭 → 팝오버 노출 → "취소" 클릭 → 닫힘, 호출 없음.
- 팝오버 바깥 클릭 → 닫힘.
- "재구축" 클릭 → 호출 + 토스트 + 팝오버 닫힘.

**시나리오 F — 비완료 문서에서 버튼 disabled**
- 진행 중 / 오류 / 업로드 상태 문서 행에서 `RefreshCw` 버튼이 disabled 상태로 회색 처리.

## 회귀 테스트 계획

증거: `.claude/state/evidence/2026-05-16-feynman-rebuild-mindmaps/regression/notes.md`

**회귀 대상 1**: 기존 `deleteDoc` (문서 삭제) — Step A 에서 SQL 을 잘라낸 경우 `deleteDoc` 가 같은 순서로 호출하는지 확인. 실제 삭제 1건 시도해 chunks/mindmaps/questions 모두 사라지는지 검증.
**회귀 대상 2**: 기존 `POST /mindmap/generate/{docId}` — 본 변경은 동일 서비스 메소드를 호출만 추가. 기존 마인드맵 부분 생성 동작 그대로.
**회귀 대상 3**: 파인만 채팅(pre-gen 경로) — 본 변경이 hasPreGen 분기 자체는 손대지 않음. 합성 완료 후 정상 가동되는지만 확인.
**회귀 대상 4**: `FeynmanPipelineTab` 의 다른 행 액션(재실행/임베딩-only/삭제) — 새 버튼 추가가 기존 버튼 클릭 영역에 영향 없는지 클릭 테스트.
**회귀 대상 5**: 인증/사이드바/일반 채팅 — 본 태스크는 파인만 영역만 손댐, 다른 기능 무관.

## 위험 / 함정

- **마인드맵 합성은 비동기 + 챕터별로 시간 차** — 재구축 직후 짧은 시간 창에서 `hasPreGen=false` 폴백 경로가 다시 돈다. 사용자가 그때 채팅을 진입하면 진행도가 잠깐 안 보임. 자연스러운 동작이지만 토스트 메시지에 "수십 초~몇 분" 명시 필요.
- **answer_attempts wipe 의 비가역성** — 사용자가 의도치 않게 학습 점수를 날릴 수 있음. 팝오버 confirm 의 본문 강조 + 위험 색(텍스트는 danger 톤) + 버튼 라벨을 "재구축" (단순 확인이 아니라 위험 동작을 자각시키는 표현) 으로.
- **재구축 중복 호출** — 사용자가 버튼 두 번 누르면 wipe 가 한 번 더 돔(이미 비었으니 no-op). `generateSelectedAsync` 도 동일 챕터 재진입에 대해 멱등하지 않을 수 있음. FE 측에서 호출 직후 버튼 잠시 disabled (수 초) 정도로 가드.
- **mindmap 합성 hook 이 question 합성을 트리거하지 않는 경우** — 1단계 `feynman-questions-by-node` 의 hook 이 마인드맵 노드가 있을 때만 동작. 노드 0개로 합성이 끝나면 chapter_questions 도 0 → 여전히 폴백. 이건 본 태스크가 아닌 상위 시스템의 한계. UX 문구에서 "노드가 만들어지지 않은 챕터는 진행 바가 안 보일 수 있어요" 까지는 명시 안 함 — 일반적으로는 잘 동작.
- **deleteDoc 와 SQL 공유** — Step A 에서 SQL 을 자르다 실수하면 문서 삭제가 깨질 수 있음. 회귀 1 으로 검증.
- **운영 ADMIN 일괄 재구축 필요성** — 현재는 문서 1건씩. 만약 운영자가 다수 문서를 한 번에 처리해야 하면 후속 ADMIN-only batch 엔드포인트 (`/api/admin/feynman/rebuild-all`) 가 필요. 본 단계 범위 외.
