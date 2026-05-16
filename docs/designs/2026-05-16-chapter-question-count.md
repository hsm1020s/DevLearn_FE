# 설계: 2026-05-16-chapter-question-count

**생성:** 2026-05-16 17:35
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-16-chapter-question-count
**브랜치:** task/2026-05-16-chapter-question-count

## 목표
파인만 채팅 시작 화면(챕터 picker) + 재구축 모달에서 챕터별로
**면접 질문 보유 여부 + 개수** 를 노출해서 사용자가 어느 챕터만 추가로 재구축하면 되는지 알 수 있게 한다.

## 현재 상태
- `FeynmanChapterPicker` 가 챕터별 노드 수만 표시 ("X개 노드")
- chapter_questions 가 비어있는 챕터인지 한눈에 알 수 없음 → 부분 재구축 의사결정이 어려움

## 변경 범위

### BE
- `MindmapSynthesisService.getChapterStatuses` — 응답 row 에 `questionCount` 필드 추가
- 매 챕터당 1회 추가 SQL: `chapterQuestionMapper.countByDocAndChapter(docId, ch.title())` (이미 존재하는 매퍼)
- N+1 가 있지만 챕터 수 보통 10~20개라 무시 가능

### FE
- `FeynmanChapterPicker.jsx` — 챕터 버튼에 표시 추가: "X개 노드 · 면접 Y" / 0이면 "X개 노드 · 면접 없음"
- (선택) `RebuildOptionsModal.jsx` — 챕터 리스트에도 같은 정보 노출하면 사용자가 "비어있는 챕터" 만 골라 재구축 가능

## 구현 계획
1. BE: `getChapterStatuses` row 에 questionCount 추가
2. FE: `FeynmanChapterPicker` 표시 텍스트 변경
3. FE: `RebuildOptionsModal` 도 챕터별 questionCount 표시 — fetchChapterStatuses 활용 또는 fetchTopics 응답 확장

## 단위 테스트 계획
- BE compile 통과
- FE vite build 통과
- 코드 트레이스:
  - chapter_questions 0건 챕터 → "면접 없음" 표시
  - 70건 챕터 → "면접 70" 표시
  - 부분 재구축 모달에서 "면접 없음" 챕터만 골라 재구축 가능

## 회귀 테스트 계획
- 채팅 시작 흐름 정상 (챕터 클릭 → 채팅 진입)
- 마인드맵 자동 탭 등 다른 getChapterStatuses 사용처 영향 없음
- 모달의 비용 미리보기는 그대로 작동
