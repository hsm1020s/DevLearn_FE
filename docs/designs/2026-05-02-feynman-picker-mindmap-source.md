# 설계: 2026-05-02-feynman-picker-mindmap-source

**생성:** 2026-05-02 12:37
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-feynman-picker-mindmap-source
**브랜치:** task/2026-05-02-feynman-picker-mindmap-source

## 목표
공부모드의 파인만 챕터 선택 패널(`FeynmanChapterPicker`)에서 챕터 출처를 **`rag_chunks` 기반 → 마인드맵 생성 결과 기반**으로 전환한다.

배경:
- 최근 `5d24e76 feat(feynman): 마인드맵 기반 면접형 파인만 학습` 으로 파인만 챗 자체가 마인드맵을 컨텍스트로 사용하도록 바뀜.
- 그런데 챕터 선택 패널은 여전히 `/feynman/topics`(rag_chunks 그룹핑)를 사용 → `--skip-embed`로 처리되어 `rag_indexed=false`인 책에서는 챕터가 한 개도 안 나옴.
- 그리고 최근 `8d3640dc refactor(mindmap): 자동 마인드맵 탭 대단원 그룹핑 + 복합키 선택` 으로 마인드맵 탭은 2뎁스(parentChapter → chapter)로 그룹핑되도록 개선됐는데, 파인만 패널은 이 구조가 반영되지 않아 일관성도 없음.

따라서 챕터 출처를 마인드맵 상태 API로 통일하고, 마인드맵이 **생성 완료된 챕터만** 노출한다(미생성 챕터는 숨김 — 사용자 요구). 동시에 마인드맵 탭과 동일한 2뎁스 그룹핑을 적용한다.

## 변경 범위

- `src/components/feynman/FeynmanChapterPicker.jsx`
  - import: `fetchTopics` → `fetchChapterStatuses` 로 교체
  - 챕터 로드 시 `status === 'completed'`인 항목만 필터링
  - 결과를 `parentChapter` 기준으로 2뎁스 그룹핑하여 렌더 (`AutoMindmapTab`과 동일 패턴)
  - 챕터 선택 시 `onSelect(docId, chapter)` 시그니처는 그대로 유지 (호출 측 영향 없음)
  - 챕터가 0개일 때 안내 문구를 "마인드맵이 생성된 챕터가 없습니다" 로 보강
- 1단계 책 목록(`fetchDocs`)은 손대지 않음.
  - `fetchDocs`가 어떤 필터를 쓰는지는 별건이며, 이번 사용자 요구는 "챕터 단위로 미생성은 숨김". 책 단위 필터는 보류.
  - 단, 책을 선택했는데 생성된 마인드맵이 0개인 경우 위 안내 문구로 자연스럽게 처리됨.

영향 받는 호출 측: `StudyStyleChips.jsx` → `FeynmanChapterPicker` 단독 사용. 시그니처 변화 없으므로 그대로.

## 구현 계획

1. `FeynmanChapterPicker.jsx` 상단 import 교체 (`fetchTopics` → `fetchChapterStatuses`).
2. `handleDocSelect` 내부 fetch 호출 교체 + `data.filter(r => r.status === 'completed')` 적용 + 정렬 유지(현재 `chapter` 숫자 추출 정렬은 1뎁스 가정이므로, parent 그룹 안에서 동작하도록 재배치).
3. 렌더 부분을 `AutoMindmapTab`의 `chKey`/`groups` 패턴으로 재작성.
4. 빈 상태 메시지 문구 수정.
5. dev 서버 재기동 후 브라우저에서 동작 확인.

## 단위 테스트 계획

브라우저에서 다음 시나리오를 실측:
- 책 1개 선택 → 마인드맵이 일부 챕터에만 있는 상태일 때, **생성된 챕터만** 패널에 노출되는지.
- parentChapter가 같은 챕터들이 한 그룹으로 묶이고 대단원 헤더가 위에 표시되는지.
- 챕터 클릭 → 기존처럼 파인만 학습 진입하는지(`onSelect(docId, chapter)` 콜백 정상 동작).
- 마인드맵 0개 책 진입 시 "마인드맵이 생성된 챕터가 없습니다" 안내가 뜨는지.

결과는 `.claude/state/evidence/2026-05-02-feynman-picker-mindmap-source/unit/notes.md` 에 기록.

## 회귀 테스트 계획

- 마인드맵 탭(자동 마인드맵)에서 같은 책의 챕터 트리/그룹핑이 그대로 동작하는지(2뎁스 헤더, 클릭 동작).
- 파인만 학습 진입 후 채팅 기능이 정상 동작(질문 받기·답변 보내기) 하는지 한 사이클.

결과는 `.claude/state/evidence/2026-05-02-feynman-picker-mindmap-source/regression/notes.md` 에 기록.
