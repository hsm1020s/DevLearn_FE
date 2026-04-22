# 설계: 2026-04-22-remove-eng-subject

**생성:** 2026-04-22 11:26
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-22-remove-eng-subject
**브랜치:** task/2026-04-22-remove-eng-subject

## 목표
정보관리기술사(`eng`) 과목은 본질적으로 논술형이라 현재 앱의 객관식 퀴즈 구조와 맞지 않음. 사용자 지시대로 **관련 코드·데이터·문서 언급을 전부 제거**한다. 나중에 논술 모드 전용 설계로 다시 추가할 때 깨끗한 출발점을 확보한다.

### 스코프
- `SUBJECT_CATALOG.eng` 항목 전체 삭제 (ENG const, SUBJECT_LIST 엔트리)
- Mock 데이터에서 `eng` 분기 삭제 (SUBJECT_PREFIX, getStudyStats SAMPLE)
- `useStudyStore` v3 → v4 마이그레이션 — 기존 `subjects.eng` 버킷 드롭, `activeSubject === 'eng'` 이면 SQLP로 폴백
- 문서·JSDoc·UI 문구에서 "정보관리기술사" 문자열 제거 또는 정리

### 비(非)목표
- 논술 모드 설계·구현 (별도 후속 태스크)
- 체크리스트·오답노트의 `eng-*` chapter id가 섞인 레거시 데이터 수동 정리 (마이그레이션이 `subjects.eng` 버킷 통째로 드롭하므로 자동 해소)

## 변경 범위

### 수정 파일
| 경로 | 변경 |
|------|------|
| `src/registry/subjects.js` | `ENG` const + CATALOG/LIST 엔트리 삭제, 헤더 주석에서 정보관리기술사 언급 제거 |
| `src/services/mock/studyMock.js` | SUBJECT_PREFIX.eng + SAMPLE.eng 삭제 |
| `src/stores/useStudyStore.js` | persist v3 → v4 migrate: `subjects.eng` 드롭 + activeSubject 정리. 헤더 주석 업데이트 |
| `src/registry/modes.js` | study 모드 description 문구 조정 ("SQLP · DAP 퀴즈 학습") |
| `src/services/studyApi.js` | JSDoc subject 예시에서 'eng' 제거 |
| `src/services/mock/adminMock.js` | 정보관리기술사 관련 demo 대화 1건 SQLP 기출 리뷰 등으로 교체 |
| `src/components/study/SubjectSelector.jsx` | 헤더 주석에서 언급 제거 |
| `src/components/study/StudyChecklistPanel.jsx` | 주석 업데이트 |
| `src/utils/examScoring.js` | 주석 업데이트 (정보관리기술사 예 제거) |
| `src/utils/constants.js` | 정리된 라인에서 정보관리기술사 언급 제거 |

### 신규 파일
없음.

### 영향 범위
- 자격증 모드 내부에서 "정보관리기술사" 드롭다운 항목이 사라지고, 과목은 SQLP·DAP·custom 3종으로 축소.
- 기존 사용자가 activeSubject='eng'를 가진 localStorage → v4 migrate에서 'sqlp'로 자동 교체.
- 어드민·마인드맵·일반/업무학습 모드·오답·통계 로직은 영향 없음.

## 구현 계획
1. `subjects.js` — ENG 제거, SUBJECT_LIST에서 제거, 헤더 주석 정비
2. `studyMock.js` — SUBJECT_PREFIX·SAMPLE에서 eng 삭제
3. `useStudyStore.js` — version 3 → 4, migrate 로직 추가
4. 나머지 파일 문서/주석 정리
5. 빌드 + dev 스모크

## 단위 테스트 계획
| # | 시나리오 | 기대 |
|---|---------|------|
| 1 | 신규 사용자 | 과목 드롭다운 3개 (SQLP·DAP·기타/사용자정의). 정보관리기술사 없음 |
| 2 | 기존 v3 사용자(활성 과목 eng) | v4 마이그레이션으로 activeSubject → 'sqlp'. eng 버킷 사라짐 |
| 3 | 기존 v3 사용자(활성 과목 sqlp) | sqlp 유지, subjects.eng만 드롭 |
| 4 | SQLP 모의고사 | 72문항·180분 정상 |
| 5 | DAP 모의고사 | 76문항·240분 정상 |
| 6 | custom 과목 | 30문항·30분 심플 결과 |
| 7 | 어드민 최근 대화 | "정보관리기술사 논술 토픽" 항목이 다른 자격증 관련 항목으로 교체됨 |

## 회귀 테스트 계획
- 일반/업무학습/마인드맵/문서 업로드/로그아웃 — 영향 없음 확인
- SQLP·DAP 과목별 집계·합격 판정 기존 동작 유지
