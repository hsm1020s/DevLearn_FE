# 설계: 2026-05-16-rebuild-progress-base

**생성:** 2026-05-16 17:27
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-16-rebuild-progress-base
**브랜치:** task/2026-05-16-rebuild-progress-base

## 목표
부분 재구축에서 진행 표시가 "선택한 N챕터 기준" 으로 그려지고, complete 판정도 정상 동작하게 한다.

## 현재 버그
- 사용자: 모달에서 1챕터만 선택 → 재구축 → 진행 표시 "6/17" 노출
- 원인: `useRebuildProgress` 가 BE 의 `totalChapters`(문서 전체 챕터 수) / `mindmapsReady`(전체 마인드맵 카운트) 를 그대로 사용
- 결과:
  - 분모 17 (전체) → 선택 1챕터의 진행이 묻혀버림
  - `complete = (mindmapsReady >= total && questionsReady >= total)` → 부분 재구축은 mindmapsReady=17 도달이 안 됨(미선택 챕터 마인드맵이 이미 존재하면 17 도달이지만 questionsReady 가 미달이면 stale 까지 영원)
  - 결과적으로 부분 재구축이 30분 후 stale 실패 토스트로 끝남

## 변경 범위 (FE 만)
- `src/hooks/useRebuildProgress.js`:
  - `startRebuild(docId, expectedTotal, baseline?)` — 시작 시점의 mindmapsReady/questionsReady 를 baseline 으로 캡처해 entry 에 저장
  - polling 마다 `delta = current - baseline`, `complete = delta >= expectedTotal`
  - `expectedTotal` 없으면 (전체 모드) 기존 동작 그대로
- `src/components/feynman/RebuildProgressInline.jsx`:
  - entry 에 `expectedTotal` + `baseline*` 있으면 표시도 baseline-aware ("선택 1챕터 중 0/1")
- `src/components/feynman/FeynmanPipelineTab.jsx`:
  - `runRebuildKnowledge` 가 rebuild API 호출 직전에 현재 진행률 API 한번 호출해 baseline 캡처 → startRebuild 에 전달
  - 또는 useRebuildProgress 가 첫 폴링 응답을 baseline 으로 캡처 (간단)
- 간단함 위주로 **첫 폴링 응답을 baseline 으로** 캡처 (옵션 B).
  - startRebuild 시 baselineCaptured=false 로 저장
  - 첫 폴링 응답에서 baseline 세팅 + baselineCaptured=true

## 구현 계획
1. useRebuildProgress: entry shape 에 `expectedTotal`, `baselineMindmapsReady`, `baselineQuestionsReady`, `baselineCaptured` 필드 추가
2. pollOnce 에서 처음 응답이면 baseline 세팅 (entry.baselineCaptured=false). 이후는 progress = current - baseline, complete = both >= expectedTotal
3. RebuildProgressInline: expectedTotal 있으면 "선택 X/N 챕터" 표기, 없으면 기존 표기
4. derivePhase 함수도 baseline-aware 인자로 변경

## 단위 테스트 계획
- FE vite build 통과
- 코드 트레이스:
  - 전체 모드 (expectedTotal=null) → 기존 로직과 동일
  - 부분 모드 1챕터 (expectedTotal=1, baselineMindmaps=17, baselineQuestions=6):
    - polling 후 mindmapsReady=16 → delta=-1 (wipe 직후) → 진행 0/1
    - 합성 후 mindmapsReady=17 → delta=0 (마인드맵 복구) → 0/1
    - chapter_questions 복구 questionsReady=7 → delta=1 → 1/1 complete=true → done 토스트
  - cancel 흐름 영향 없음

## 회귀 테스트 계획
- 전체 재구축 (모든 챕터) — 기존 흐름 그대로 complete=true 도달
- 부분 재구축 (1챕터) — 1챕터 완료되면 즉시 done
- cancel — 표시 즉시 사라짐 (기존 cancel 흐름)
- 채팅/마인드맵/문서 미영향
