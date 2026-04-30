# 설계: 2026-04-22-remove-ox-quiz-type

**생성:** 2026-04-22 11:40
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-22-remove-ox-quiz-type
**브랜치:** task/2026-04-22-remove-ox-quiz-type

## 목표
퀴즈 설정에서 OX 문제 유형을 제거한다. SQLP·DAP 실제 시험이 객관식(4지선다) + 단답/서술형 위주라 OX는 학습 가치가 낮음. 관련 mock·stats·상수 전부 정리.

### 스코프
- `QUIZ_TYPES`에서 `'ox'` 엔트리 제거
- `STATS_TYPE_LABELS`에서 `ox` 키 제거
- `useStudyStore`의 `stats.byType` 기본 shape에서 `ox: 0` 제거
- `studyMock.getStudyStats`의 `byType` 배열에서 'ox' 행 제거
- 체크리스트/오답/마이그레이션은 문제 유형 기반이 아니라 영향 없음

### 비(非)목표
- 남은 유형(multiple·short) 자체 조정 없음
- 기존 오답노트에 'ox'로 태그된 문제가 있더라도 표시는 STATS_TYPE_LABELS 폴백("4지선다")으로 자연 처리되므로 오답 데이터 자체는 손대지 않음

### 마이그레이션
- `useStudyStore` persist v4 → v5: 각 subjects 버킷의 `stats.byType.ox` 키 제거
- 현 사용자가 쌓아둔 `ox` 카운트는 버림(드물고 의미 없는 수치)

## 변경 범위

| 경로 | 변경 |
|------|------|
| `src/utils/constants.js` | QUIZ_TYPES에서 ox 엔트리 삭제, STATS_TYPE_LABELS에서 ox 삭제 |
| `src/services/mock/studyMock.js` | getStudyStats byType에서 ox 행 삭제(총합 비율 재조정) |
| `src/stores/useStudyStore.js` | `stats.byType` 기본 shape `{ multiple:0, short:0 }`, persist v5 migrate (byType.ox 드롭) |

### 영향 범위
- QuizSettings의 문제 유형 체크박스에 OX 사라짐 → 자격증 모드 유저 관점 체크 선택지 2개
- StudyStatsTab·StudyStatsPanel 차트에서 ox 막대 사라짐
- 일반/업무학습/마인드맵/어드민 등은 영향 없음

## 구현 계획
1. constants.js — QUIZ_TYPES·STATS_TYPE_LABELS 정리
2. studyMock.js — byType 'ox' 행 삭제, 잔여 multiple/short 비율 재분배
3. useStudyStore.js — version 4→5, migrate에 byType.ox 삭제 추가, 기본 shape에서 ox 제거
4. 빌드 + dev 스모크 + evidence 노트
5. 병합 + push + 정리

## 단위 테스트 계획
| # | 시나리오 | 기대 |
|---|---------|-----|
| 1 | QuizSettings 문제 유형 체크박스 | "4지선다" + "단답형" 2개만 노출 |
| 2 | SQLP 모의고사 시작 | 기본 선택 types에 ox 없음, 정상 생성 |
| 3 | 기록 탭 > 통계 | 유형별 막대에 OX 없음, multiple/short만 |
| 4 | 통계 모달(StudyStatsPanel) | 동일 |
| 5 | 기존 v4 사용자 (stats.byType.ox 있음) | v5 migrate로 ox 키 제거, UI 영향 없음 |
| 6 | 기존 오답노트의 type='ox' 항목 | STATS_TYPE_LABELS 폴백 "4지선다"로 표시됨(데이터 보존) |

## 회귀 테스트 계획
- 일반/업무학습/마인드맵 영향 없음 확인
- SQLP·DAP 퀴즈 전체 플로우(설정→풀이→결과) 정상
- 오답노트 다시 풀기 / 체크리스트 / 스타일 칩 정상
