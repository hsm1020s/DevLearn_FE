# 설계: 2026-04-22-remove-short-quiz-type

**생성:** 2026-04-22 12:15
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-22-remove-short-quiz-type
**브랜치:** task/2026-04-22-remove-short-quiz-type

## 목표
SQLP·DAP 실제 시험 구성(객관식 70/75 + 실기 서술형 1~2)에 단답형은 존재하지 않는다. 현재 QuizSettings의 "문제 유형" 선택지에서 "단답형"을 제거해 퀴즈 생성 흐름을 실제 시험과 정합시키고, 남은 유일한 유형(4지선다)을 기본 고정값으로 단순화한다.

### 스코프
- `QUIZ_TYPES`에서 `{ value:'short', label:'단답형' }` 삭제 → `[{ value:'multiple', label:'4지선다' }]`만 남김
- `STATS_TYPE_LABELS`에서 `short` 키 제거
- QuizSettings의 "문제 유형" 선택 UI 섹션 전체 제거 (선택지 1개라 UI 무의미)
- `types` 체크박스 관련 로직(`toggleType`, disable 조건의 `types.length` 체크) 제거
- `types`는 내부에서 `['multiple']`로 고정
- Mock `getStudyStats`의 byType 배열에서 short 행 제거(혹은 multiple 하나만 남김)
- `useStudyStore` persist v6 → v7 migrate (각 subjects 버킷의 stats.byType.short 드롭)

### 비(非)목표
- SQLP/DAP 실기(서술형) 별도 지원 — 객관식 mock 구조 밖, 후속 태스크
- 기존 오답노트의 `type:'short'` 엔트리 — STATS_TYPE_LABELS 폴백("4지선다")으로 자연 표시, 데이터 유지

### 마이그레이션
persist v6 → v7: 각 subjects 버킷의 `stats.byType.short` 키 삭제. 기존 short 풀이 카운트는 소실(드물고 의미 없는 수치).

## 변경 범위

| 경로 | 변경 |
|------|------|
| `src/utils/constants.js` | QUIZ_TYPES에서 short 엔트리 삭제 + 헤더 주석 정리, STATS_TYPE_LABELS.short 삭제 |
| `src/components/study/QuizSettings.jsx` | "문제 유형" 섹션 UI 제거, toggleType 함수 삭제, `disabledStart` 조건에서 types 체크 제거, settings.types를 ['multiple'] 고정 |
| `src/services/mock/studyMock.js` | getStudyStats byType에서 short 행 제거(multiple 100% 채움) |
| `src/stores/useStudyStore.js` | `stats.byType` 기본 shape `{ multiple }`로 축소, persist version 6 → 7, migrate에 v<7 단계 추가(byType.short 드롭). 마이그레이션 히스토리 주석 업데이트 |

### 영향 범위
- 자격증 모드 퀴즈 UI: "문제 유형" 섹션 사라짐 → 더 간결한 폼
- generateQuiz 호출 시 `types: ['multiple']`로 고정 전송
- 통계 차트에 "단답형" 막대 사라짐
- 업무학습/일반/마인드맵/어드민 영향 없음

## 구현 계획
1. constants.js — QUIZ_TYPES · STATS_TYPE_LABELS 정리
2. QuizSettings.jsx — UI 섹션 제거 + types 고정
3. studyMock.js — byType 샘플에서 short 행 제거
4. useStudyStore.js — 기본 shape + v7 migrate
5. 빌드 + 스모크 + evidence + 병합

## 단위 테스트 계획
| # | 시나리오 | 기대 |
|---|---------|------|
| 1 | QuizSettings 진입 | "문제 유형" 섹션 없음. 교재/문제 수/난이도/출제 범위만 노출 |
| 2 | 일반 퀴즈 시작 | types=['multiple']로 generateQuiz 호출, 문제 모두 4지선다 |
| 3 | 모의고사 프리셋 | 이전과 동일 동작 (types 처리 내부 고정) |
| 4 | 기록 탭 > 통계 | byType 차트에 "4지선다" 하나만 노출 |
| 5 | 통계 모달 | 동일 |
| 6 | 기존 v6 사용자 | v7 migrate로 subjects[*].stats.byType.short 자동 제거 |
| 7 | 기존 오답노트에 type='short' 있을 경우 | STATS_TYPE_LABELS 폴백으로 "4지선다"로 표시됨, 데이터 유지 |

## 회귀 테스트 계획
- 자격증 모드 퀴즈 전 플로우 · 과목 전환 · 오답노트 다시 풀기
- 업무학습·일반·마인드맵·문서 업로드·로그인 영향 없음 확인
