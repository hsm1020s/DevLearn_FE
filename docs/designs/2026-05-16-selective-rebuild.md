# 설계: 2026-05-16-selective-rebuild

**생성:** 2026-05-16 17:08
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-16-selective-rebuild
**브랜치:** task/2026-05-16-selective-rebuild

## 목표
[지식 재구축] 을 **챕터 단위 + 합성 타겟 선택 + 비용 미리보기** 로 확장해서 사용자가 필요한 부분만 다시 돌릴 수 있게 한다. 전체 비용의 1/N 으로 부분 재구축 가능.

## 사용자 시나리오
1. 사용자 [지식 재구축] 클릭
2. **모달**: 챕터 체크박스 목록 + 합성 타겟 라디오(둘 다 / 마인드맵만 / 질문만) + 예상 비용 표시
3. 사용자 선택 → [재구축] 클릭 → 선택한 챕터·타겟만 wipe + 재합성

## 변경 범위

### BE
- DTO: `RebuildKnowledgeRequest { List<String> chapters; String targets; }` (targets: `all` / `mindmap` / `questions`)
- DTO: `RebuildCostPreviewResponse { items: [{chapter, mindmapTokens, questionTokens, questionNodes}], totalUsd, totalKrw }`
- `FeynmanController`:
  - `POST /{docId}/rebuild-knowledge` 시그니처에 `@RequestBody RebuildKnowledgeRequest req` 추가 (req=null 또는 chapters=null/empty → 전체)
  - `GET /{docId}/rebuild-cost-preview?chapters=...&targets=...` 신규 — 모달에서 사용자가 선택 바꿀 때 호출
- `FeynmanService.rebuildKnowledge(userId, docId, chapters /*null=all*/, targets)` 시그니처 확장
  - targets 별 wipe 범위:
    - `all`: 기존 동작 — message_sources/answer_attempts/chapter_questions/mindmaps (선택 챕터만)
    - `mindmap`: mindmaps + chapter_questions(자동으로 의존 안전을 위해) wipe + 마인드맵 재합성
    - `questions`: chapter_questions + answer_attempts wipe (mindmaps 보존) + `QuestionSynthesisService.rebuildChapterFromMindmapAsync` 직접 호출
  - chapter 인자가 있으면 wipe SQL 도 chapter 단위로
- `FeynmanService.previewRebuildCost(userId, docId, chapters, targets)` 신규 — 토큰/달러 추정
  - 휴리스틱: 마인드맵 챕터당 ~10K, 질문 노드당 ~1.5K 토큰 (B 방향 적용 후)
  - 단가는 `LlmConfig.pricing` 활용 — `gpt-5.4-mini` input/output (대략 input 비중 70%)
  - 노드 수는 `mindmap_nodes` 카운트 (questions 타겟이면 마인드맵 보존 가정 — 이미 있어야 의미)
- Mappers:
  - `FeynmanMapper.deleteAnswerAttemptsByDocAndChapter` — `WHERE question_id IN (SELECT id FROM chapter_questions WHERE doc_id=? AND chapter=?)`
  - `ChapterQuestionMapper.deleteByDocAndChapter` — `WHERE doc_id=? AND chapter=?`
  - `MindmapMapper.deleteByDocAndChapter` — `WHERE doc_id=? AND chapter=?`
  - `MindmapNodeMapper.countByDocAndChapter` — preview 용
  - `message_sources` 는 chapter 단위 wipe 안 함 — chunk_id 는 보존 (chunk 자체가 안 사라지므로 dangling 아님)

### FE (워크트리)
- `services/feynmanApi.js`:
  - `rebuildKnowledge(docId, { chapters, targets })` — body 전달
  - `fetchRebuildCostPreview(docId, { chapters, targets })` — GET 쿼리 파라미터
- `hooks/useRebuildProgress.js`:
  - `startRebuild(docId, expectedTotal /* 선택 챕터 수 */)` — 진행률 base 변경
  - localStorage entry 에 `expectedTotal` 추가, derivePhase 가 그 값 사용
- `components/feynman/RebuildOptionsModal.jsx` 신규 — 챕터 picker + targets 라디오 + 비용 미리보기
  - 디바운스 (300ms) 로 선택 바뀔 때 비용 미리보기 API 호출
- `components/feynman/FeynmanPipelineTab.jsx`:
  - `handleRebuildKnowledge` 가 confirm 팝오버 대신 새 모달 띄우게 변경
  - 모달 onConfirm → `rebuildKnowledge(docId, { chapters, targets })` + `startRebuild(docId, chapters.length)`

## 구현 계획

### 1단계 — BE 매퍼/SQL
1. ChapterQuestionMapper + XML 에 `deleteByDocAndChapter` 추가
2. FeynmanMapper + XML 에 `deleteAnswerAttemptsByDocAndChapter` 추가
3. MindmapMapper + XML 에 `deleteByDocAndChapter` 추가
4. MindmapNodeMapper + XML 에 `countByDocAndChapter` 추가

### 2단계 — BE Service/Controller
5. `RebuildKnowledgeRequest` / `RebuildCostPreviewResponse` DTO
6. `FeynmanService.rebuildKnowledge` 시그니처 확장 + targets 분기
7. `FeynmanService.previewRebuildCost` 신규
8. `FeynmanController` 엔드포인트 2개 업데이트

### 3단계 — FE API/훅
9. `feynmanApi.js` 함수 2개
10. `useRebuildProgress` expectedTotal 인자 처리

### 4단계 — FE 모달 + 연결
11. `RebuildOptionsModal.jsx` 신규
12. `FeynmanPipelineTab.jsx` 모달 연결 + handleRebuildKnowledge 변경

### 5단계 — 빌드/타이트닝
13. BE compileJava, FE vite build

## 단위 테스트 계획
- BE compile 통과
- FE vite build 통과
- 코드 트레이스:
  - chapters=null → 기존 전체 wipe + 합성 (하위 호환)
  - chapters=[ch1, ch2] + targets='questions' → ch1/ch2 의 chapter_questions + answer_attempts 만 wipe, 마인드맵 보존, QuestionSynth 직접 트리거
  - cost preview: mindmap 타겟 + 챕터 3개 → 약 30K 토큰 예상, USD/KRW 계산 검증

## 회귀 테스트 계획
- 기존 [지식 재구축] 흐름 (chapters 없이) 정상 동작
- cancel-rebuild 와 호환 — 취소 버튼이 부분 재구축 중에도 작동
- 채팅/마인드맵/문서 등 다른 기능 영향 없음
