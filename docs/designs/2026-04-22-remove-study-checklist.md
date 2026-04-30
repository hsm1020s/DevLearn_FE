# 설계: 2026-04-22-remove-study-checklist

**생성:** 2026-04-22 11:52
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-22-remove-study-checklist
**브랜치:** task/2026-04-22-remove-study-checklist

## 목표
자격증(학습) 모드의 **기록 탭에서 체크리스트 서브 기능**을 완전히 제거한다. 자격증 학습에서는 교재 챕터 진도 체크보다 오답노트/통계가 학습 피드백 루프의 중심이라 중복이고, 체크리스트 카탈로그 시드 유지 비용이 가치 대비 큼.

**업무학습 모드의 체크리스트는 유지**(업무노트와 함께 업무학습의 핵심 기능).

### 스코프
- `StudyRecordTab`의 [오답노트 | 체크리스트 | 통계] → [오답노트 | 통계] 2탭으로 축소
- `StudyChecklistPanel.jsx` 파일 삭제
- `useStudyStore`: `checklist` 필드 + `toggleChecklistChapter` 액션 제거, 마이그레이션 v5 → v6 (기존 사용자 subjects[*].checklist 드롭)
- `SUBJECT_CATALOG` (SQLP/DAP/CUSTOM): 각 과목의 `checklist` 배열 제거
- 부속 문구/주석에서 "체크리스트" 언급 정리 (SubjectSelector · StudyHomeCards · 헤더 주석)

### 비(非)목표
- **`ChecklistPanel.jsx` 컴포넌트 파일은 유지** — 업무학습 모드의 `WorkLearnChecklistPanel`에서 여전히 사용하는 범용 프레젠테이션 컴포넌트.
- 업무학습 모드 체크리스트 기능 일체 보존.
- 기존 오답노트/통계·다른 과목 기능 변화 없음.

### 마이그레이션
- persist v5 → v6: 각 `subjects[*]` 버킷에서 `checklist` 키 삭제. 데이터 소실이지만 단순 진도 체크라 허용 가능.

## 변경 범위

### 삭제 파일
| 경로 | 이유 |
|------|------|
| `src/components/study/StudyChecklistPanel.jsx` | 학습 모드 전용 어댑터. 기능 제거로 호출처 0개. |

### 수정 파일
| 경로 | 변경 |
|------|------|
| `src/components/study/StudyRecordTab.jsx` | SUB_TABS에서 checklist 제거, import 제거, 렌더 분기 제거 |
| `src/stores/useStudyStore.js` | `checklist` 필드 / `toggleChecklistChapter` 액션 삭제, `emptySubjectState`/`initialSubjects` 정리, version 5 → 6, migrate에서 v<6 단계 추가(subjects[*].checklist 삭제). 헤더 주석 업데이트 |
| `src/registry/subjects.js` | SQLP/DAP/CUSTOM 각 과목의 `checklist` 필드 삭제, 헤더 주석에서 "기본 체크리스트" 문구 제거 |
| `src/components/study/StudyHomeCards.jsx` | 복습·기록 카드 description "오답노트 · 체크리스트" → "오답노트 누적 복습" |
| `src/components/study/SubjectSelector.jsx` | 주석에서 "체크리스트" 언급 제거 |

### 영향 범위
- 학습 모드의 기록 탭이 2탭 구조로 축소 (오답노트 / 통계)
- 업무학습 모드·일반 모드·마인드맵·어드민·문서 업로드는 영향 없음
- 이전에 체크해 둔 과목별 진도 데이터는 소실

## 구현 계획
1. `SUBJECT_CATALOG`에서 `checklist` 배열 제거 (SQLP/DAP/CUSTOM)
2. `useStudyStore` — 필드/액션/초기화 정리 + v5→v6 migrate
3. `StudyRecordTab` — 서브탭 2개로 축소 + StudyChecklistPanel import 삭제
4. `StudyChecklistPanel.jsx` 파일 삭제
5. 주석/문구 정리 (StudyHomeCards, SubjectSelector)
6. 빌드 + dev 스모크 + evidence 노트
7. 병합 + push + 정리

## 단위 테스트 계획
| # | 시나리오 | 기대 |
|---|---------|------|
| 1 | 자격증 모드 기록 탭 진입 | [오답노트 | 통계] 2탭만 노출. "체크리스트" 탭 사라짐 |
| 2 | SQLP/DAP 과목 전환 | 체크리스트 탭 없음, 나머지(오답노트/통계) 정상 |
| 3 | 업무학습 모드 | [채팅 | 업무노트 | 체크리스트] 3탭 그대로. 체크리스트 CRUD 정상 |
| 4 | 기존 v5 사용자 | 새로고침 시 subjects[*].checklist 자동 삭제, UI 정상 |
| 5 | 퀴즈 전 플로우(SQLP 72문항 모의고사) | 영향 없음, 결과 화면 과목별 집계 유지 |
| 6 | 오답노트 다시 풀기 | 기존 동작 유지 |
| 7 | StudyHomeCards "복습·기록" 카드 | description이 "오답노트 누적 복습" 로 변경, 클릭 시 record 탭 이동 |

## 회귀 테스트 계획
- 일반 모드 채팅, 업무학습 모드 전반(특히 체크리스트 탭), 마인드맵, 로그인/로그아웃, 어드민 페이지
