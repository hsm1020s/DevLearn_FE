# 설계: 2026-04-22-exam-parts-scoring

**생성:** 2026-04-22 11:06
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-22-exam-parts-scoring
**브랜치:** task/2026-04-22-exam-parts-scoring

## 목표
SQLP·DAP 모의고사가 실제 시험처럼 **과목별 정답률·배점·과락 여부·합격 판정**까지 결과 화면에서 확인 가능하도록 카탈로그/mock/UI를 확장한다. 사용자가 "72문항 다 풀면 합격 예상 점수는?" 같은 실질 피드백을 즉시 받을 수 있게 한다.

### 스코프
- SQLP·DAP: **과목 집계 풀 경로** (parts + mock 태깅 + 결과 UI)
- 정보관리기술사·custom: parts 없이 기본 UI 유지 (폴백). 정보관리기술사 논술 모드는 별도 태스크.

### 비(非)목표
- 실제 기출 문제 풀(pool). mock은 여전히 템플릿 생성, 과목 태그만 붙음.
- 과목별 가중 난이도 조정(예: SQL 고급/튜닝 40문항이라 난이도 high). 단순 비율 배분만.
- 실기 2문항(SQLP) · 실기 1문항(DAP)의 서술형 채점 — 객관식 합산만 반영, 실기는 추후.

---

## 설계 결정

### A. `SUBJECT_CATALOG`에 `parts` + `passingCriteria` 추가

SQLP:
```js
parts: [
  { id: 'sqlp-pm', label: '데이터 모델링의 이해',   questionCount: 10, points: 10 },
  { id: 'sqlp-p1', label: 'SQL 기본 및 활용',       questionCount: 20, points: 20 },
  { id: 'sqlp-p2', label: 'SQL 고급 활용 및 튜닝',  questionCount: 40, points: 40 },
],
passingCriteria: { totalMin: 75, partMinPercent: 40 },
```

DAP:
```js
parts: [
  { id: 'dap-p1', label: '전사아키텍처 이해',      questionCount: 10, points: 8 },
  { id: 'dap-p2', label: '데이터 요건 분석',        questionCount: 10, points: 8 },
  { id: 'dap-p3', label: '데이터 표준화',           questionCount: 10, points: 8 },
  { id: 'dap-p4', label: '데이터 모델링',           questionCount: 25, points: 20 },
  { id: 'dap-p5', label: '데이터베이스 설계와 이용',questionCount: 10, points: 8 },
  { id: 'dap-p6', label: '데이터 품질 관리 이해',   questionCount: 10, points: 8 },
],
passingCriteria: { totalMin: 75, partMinPercent: 40 },
```

- `part.id`는 기존 `checklist` 과목 id와 **동일 키로 설계** — 체크리스트 헤더에서 meta를 조회할 수 있도록.
- 객관식 비율만 반영(실기 배점은 별도, 이번 스코프 외).
- 정보관리기술사/custom: `parts: null` (있어도 됨), `passingCriteria: null`.

### B. Mock 문제 생성 — `part` 태깅 + 과목별 비율 배분

`generateQuiz({ subject, count, ... })`:
1. `SUBJECT_CATALOG[subject].parts` 조회.
2. 있으면 **과목별 비율**에 따라 count를 나눠 각 part에서 문항 생성. 각 문제에 `part: '<part-id>'` 태그.
3. 없으면 (정보관리기술사·custom·미인식 subject) 기존 방식으로 균등 생성.

배분 알고리즘(간단, 반올림 보정):
- 각 part의 목표 수 = `Math.round(count * part.questionCount / totalQuestionCount)`
- 마지막 part에서 잔여 보정 (sum = count 보장)
- count가 모의고사 프리셋(72/76)이 아닌 임의 값일 때도 비율 유지

### C. QuizResult — 과목별 집계 + 과락/합격 판정

신규 컴포넌트: `QuizResultByParts` — 과목별 정답/문항수/정답률/과락 여부 표.
- 문제별 `part` 태그 + `answers[q.id]?.correct` 를 합산.
- `passingCriteria.partMinPercent` 미만 과목은 빨간 표시 ("과락").
- 총점은 `sum(part.points * (correctInPart / countInPart))` — 부분점수 가중.
  - 단순화: 한 문항 배점 = `part.points / part.questionCount` 가정. 현 시험과 일치.
- 합격 판정: `총점 >= totalMin && 과락 과목 수 === 0`.
- parts가 없으면(정보관리기술사·custom) 기존 심플 결과 화면.

### D. QuizSettings 모의고사 배너 — 합격 기준 라벨

현재 배너: "SQLP 모의고사 · 72문제 · 혼합 · 전체 범위 · 전체 유형 · 180분 타이머"

추가:
- "합격 기준: 총점 75점 + 과목별 40% 이상"
- (선택) 과목별 비율 표 간단히 (공간 허락 시)

### E. ChecklistPanel — 과목 제목에 메타

현재: "1과목 · 데이터 모델링의 이해  0/4 (0%)"
확장: "1과목 · 데이터 모델링의 이해  (10문항 · 10점)  0/4 (0%)"

- 메타는 `parts.find(p => p.id === book.id)?.questionCount/points` 로 조회.
- parts 없는 과목은 기존 헤더 유지.

### F. 구현 난이도 / 리스크

- **mock 배분 로직**: count가 72/76일 때는 정확히 떨어지지만 기타(10, 20, 30, 40) 값에서는 반올림 오차 → 마지막 part 잔여 보정.
- **결과 집계**: `currentQuiz.questions`에서 part 태그 읽어 map/reduce. 성능 무관.
- **parts 없는 과목**: QuizResult·QuizSettings·ChecklistPanel 모두 null-safe 렌더 필수 (정보관리기술사·custom 동작 유지).
- **기존 오답노트**: 오답에 part 태그를 같이 저장하면 나중에 "과목별 오답 필터"가 쉬워짐. 이번에 `addWrongAnswersFromSession`에도 part 필드 전파.

---

## 변경 범위

### 수정 파일
| 경로 | 변경 |
|------|------|
| `src/registry/subjects.js` | SQLP·DAP에 `parts`, `passingCriteria` 추가 |
| `src/services/mock/studyMock.js` | `generateQuiz` — parts 기반 비율 배분 + `part` 태깅 |
| `src/components/study/QuizSettings.jsx` | examMode 배너에 합격 기준 + (선택) 과목별 비율 한 줄 |
| `src/components/study/StudyQuizTab.jsx` | `QuizResult`를 subject parts 유무에 따라 `QuizResultByParts` 렌더로 분기 |
| `src/components/study/ChecklistPanel.jsx` | 과목 헤더에 선택적 메타(`meta` prop or render slot) 표시 |
| `src/components/study/StudyChecklistPanel.jsx` | parts 메타를 ChecklistPanel 에 주입 |
| `src/stores/useStudyStore.js` | `addWrongAnswersFromSession` — 오답에 `part` 필드 전파 (shape 확장, migrate 불필요: 신규 필드 optional) |

### 신규 파일
| 경로 | 역할 |
|------|------|
| `src/components/study/QuizResultByParts.jsx` | 과목별 집계 + 과락/합격 판정 결과 화면 |
| `src/utils/examScoring.js` | 집계 유틸 — `computePartsScore(currentQuiz, answers, parts, passingCriteria)` 반환 `{ perPart, total, failedParts, passed }` |

### 영향 범위
- 자격증 모드 전용 변경. 일반/업무학습/마인드맵/어드민 영향 없음.
- parts 없는 과목(정보관리기술사·custom)은 기존 결과 화면 그대로 → 회귀 없음.

---

## 구현 계획

**Phase 1 — 데이터 모델 (직렬)**
1. `subjects.js` — SQLP/DAP에 parts + passingCriteria 추가
2. `utils/examScoring.js` — 집계 유틸 작성

**Phase 2 — Mock 배분**
3. `studyMock.generateQuiz` — parts 비율 배분 + part 태그

**Phase 3 — UI**
4. `QuizResultByParts` 컴포넌트
5. `StudyQuizTab`에서 분기 렌더
6. `QuizSettings` 배너 합격 기준 라벨
7. `ChecklistPanel` 헤더 메타 슬롯 + `StudyChecklistPanel` 주입

**Phase 4 — 오답 전파**
8. `useStudyStore.addWrongAnswersFromSession` — 오답에 part 필드 보존

**Phase 5 — QA**
9. 빌드 + dev 스모크
10. 단위·회귀 노트

---

## 단위 테스트 계획

| # | 시나리오 | 기대 |
|---|----------|-----|
| 1 | SQLP 모의고사 시작 | 72문제 중 1과목 10 / 2과목 20 / 3과목 40 비율 배분 |
| 2 | DAP 모의고사 시작 | 76문제 중 과목별 10/10/10/25/10/10 비율 배분 |
| 3 | SQLP 모의고사 일부 풀이 후 결과 | 과목별 행 3개, 각 행에 정답/문항/정답률, 미달 과목은 "과락" 빨강 표시 |
| 4 | SQLP 모의고사 전 문제 정답 | 총점 100점, 합격 O |
| 5 | SQLP 2과목 0점 + 나머지 만점 | 총점 80점이어도 과락으로 불합격 표시 |
| 6 | 정보관리기술사 프리셋 시작 → 결과 | 기존 간단 결과 화면(심플) 그대로 — parts 없음 |
| 7 | custom 과목 | parts 없어 기존 경로 유지 |
| 8 | 일반 퀴즈(모의고사 아닌 임의 count=20) | parts 비율대로 배분 (SQLP면 3/6/11 정도) |
| 9 | 체크리스트 헤더 | SQLP에서 "(10문항 · 10점)" 메타 노출 |
| 10 | QuizSettings examMode 배너 | "합격 기준: 총점 75점 + 과목별 40%" 추가 |
| 11 | 새로고침 후 오답노트 | 오답에 part 필드 유지(optional 필드라 기존 오답엔 없어도 됨) |

## 회귀 테스트 계획
- 일반 모드 채팅
- 업무학습 모드 노트/체크리스트/채팅
- 마인드맵 on/off
- 정보관리기술사 / custom 과목 — 기존 결과 UI 유지 확인
- 로그아웃 reset 후 재진입
- persist 기존 사용자 데이터 영향 없음
