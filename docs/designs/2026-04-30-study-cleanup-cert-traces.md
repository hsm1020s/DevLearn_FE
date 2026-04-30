# 설계: 2026-04-30-study-cleanup-cert-traces

**생성:** 2026-04-30 20:32
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-30-study-cleanup-cert-traces
**브랜치:** task/2026-04-30-study-cleanup-cert-traces

## 목표
공부 모드 전반에서 SQLP/DAP 자격증 특화 표현(라벨/설명/예시질문/모의고사 합격기준/과목별 출제표/배너)을 사용자 화면에서 모두 제거. 단일 "공부" 컨텍스트로 일원화.

## 사용자에게 보이는 SQLP 흔적 (제거 대상)
1. **채팅 빈 화면 헤더** (StudyChatTab.jsx)
   - 타이틀 `학습 · ${subjectMeta.label}` → "학습 · SQLP"
   - 서브타이틀 → "SQL 전문가 · 72문항 180분 · 과목별 40% / 총점 75점"
   - 예시 질문 → 옵티마이저/B-Tree/조인 SQLP 특화
2. **빈 화면 3카드 위 배너** (StudyHomeCards.jsx)
   - "SQLP" 칩 + "과목으로 학습 · 상단에서 과목 전환" — SubjectSelector 제거 후 안내 문구만 남음
   - 카드 설명 "오답노트 · 과목별 통계"
3. **퀴즈 모의고사 프리셋 박스** (QuizSettings.jsx)
   - "{label} 모의고사" → "SQLP 모의고사"
   - 합격기준 라인, "과목별 출제: 데이터 모델링의 이해(10) · …"
4. **학습 통계 패널 상단 칩** (StudyStatsPanel.jsx)
   - "SQLP" 칩 + "과목 누적 통계"
5. **모의고사 결과 화면 분기** (StudyQuizTab.jsx) — `subjectMeta.parts`가 truthy면 SQLP 과목별 집계 화면
6. **admin mock 대화 더미** (services/mock/adminMock.js) — "SQLP 튜닝 기출 오답노트" 등

## 변경 범위

### 1) 카탈로그 단일화 — `src/registry/subjects.js`
- SQLP/DAP/CUSTOM 3엔트리 → 단일 STUDY 엔트리(id 'sqlp' 그대로 — bucket key 호환)
- `parts: null`, `passingCriteria: null`
- `examPreset`은 30문항·30분 (자격증 무관 디폴트)
- `examples`: 일반 학습 질문 3개
- `SUBJECT_LIST = [STUDY]`, `SUBJECT_CATALOG = { sqlp: STUDY }`
- `getSubject(id)`는 미일치 시 STUDY 폴백 (기존 사용자 dap/custom 잔존 데이터의 메타 조회 시 안전)

### 2) 빈 화면 정리
- `StudyChatTab.jsx` 헤더 폴백 → 단일 "공부" 타이틀 + "PDF 업로드 후 자동 출제·즉시 채점·오답 정리" 서브타이틀 (subjectMeta.description 의존 제거)
- `StudyHomeCards.jsx` 상단 배너(label 칩 + "과목으로 학습 · 상단에서 과목 전환") 통째 제거. 카드 설명 "과목별 통계" → "누적 통계"

### 3) 퀴즈 설정 / 결과
- `QuizSettings.jsx` — 모의고사 박스 헤더 "{subjectMeta.label} 모의고사" → "모의고사 프리셋". 합격기준·과목별출제 라인은 passingCriteria/parts=null로 자연 비활성화.
- `StudyQuizTab.jsx` — parts 분기는 그대로 두되 주석에서 SQLP/DAP 표현 일반화. 실질적으로 항상 simple QuizResult로 분기.
- `QuizResultByParts.jsx` — 도달 불가지만 파일 보존, fileoverview만 일반화.

### 4) 통계 패널
- `StudyStatsPanel.jsx` — 상단 "{label}" 칩 + "과목 누적 통계" → "학습 누적 통계" 헤더로 교체. subjectMeta import 제거.

### 5) 주석/fileoverview/mock 일반화
- `StudyRecordTab.jsx`, `ChecklistPanel.jsx`, `feynman/FeynmanMode.jsx`, `worklearn/WorkLearnMode.jsx`, `common/ModeSwitcher.jsx` JSDoc에서 "자격증" → "공부"
- `utils/constants.js`, `utils/examScoring.js` 주석의 SQLP/DAP 언급 일반화
- `services/mock/adminMock.js` 더미 대화 제목 SQLP/DAP 단어 제거
- `services/mock/studyMock.js` SUBJECT_PREFIX 주석 일반화

### 6) 변경하지 않는 것
- `useStudyStore` persist 스키마/버전 — 기존 사용자 오답/통계 보존 (dap/custom 버킷도 storage에 그대로 남음, UI 도달 0)
- API 호출 시 `subject: activeSubject` 파라미터 — 백엔드 인터페이스 고정
- `examScoring.js` 알고리즘 — 도달 불가지만 보존

## 구현 계획
1. `subjects.js` 단일화
2. `StudyChatTab.jsx` 헤더 폴백 정리
3. `StudyHomeCards.jsx` 배너 제거 + 카드 텍스트 일반화
4. `QuizSettings.jsx` 모의고사 박스 라벨 + 주석 정리
5. `StudyStatsPanel.jsx` 상단 칩 제거
6. 잔여 fileoverview/주석/mock 일반화
7. 빌드 + dev 서버(워크트리) 띄워 4 지점 확인

## 단위 테스트 계획
- vite build 성공
- 공부 모드 빈 화면 헤더에 "SQLP" 미노출, 예시질문이 일반화됨
- 3카드 상단 배너 사라짐, 카드 설명에 "과목별" 단어 0건
- 퀴즈 설정 모의고사 박스에 "SQLP" 미노출, 합격기준·과목별출제 라인 미노출
- 학습 통계 패널 상단 헤더 "학습 누적 통계" (SQLP 칩 0건)
- 모의고사 종료 시 단순 결과 화면(과목별 표 X)
- admin 최근 대화 더미 제목에 SQLP/DAP 미노출

## 회귀 테스트 계획
- 일반 채팅 / 업무학습 모드 진입+메시지 정상
- 마인드맵 토글 정상
- 모드 전환 후 상태 보존
- 새로고침 후 useStudyStore persist 데이터 보존
- 퀴즈 생성 → 채점 → 결과 흐름 정상
