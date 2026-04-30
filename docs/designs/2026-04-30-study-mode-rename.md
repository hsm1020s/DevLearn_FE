# 설계: 2026-04-30-study-mode-rename

**생성:** 2026-04-30 20:19
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-30-study-mode-rename
**브랜치:** task/2026-04-30-study-mode-rename

## 목표
- 모드 라벨 `자격증` → `공부`로 변경 (description도 SQLP/DAP 노출 제거)
- 학습 워크스페이스 상단의 **SubjectSelector(SQLP/DAP/기타) 드롭다운 제거**
- 분기 효과가 미미했던 과목 선택을 사용자에게 노출하지 않고 단일 컨텍스트로 통일

## 변경 범위
### 1) 라벨/문구
- `src/registry/modes.js` — `study.label` → "공부", `description` 갱신
- `src/components/admin/RecentConversations.jsx` — `MODE_LABELS.study` → "공부"
- 사용자에게 노출되는 코멘트/JSDoc 중 "자격증 모드" 표현은 그대로 둬도 동작에 영향 없음 → 이번 PR 범위 외 (혼선 방지를 위해 핵심 컴포넌트 fileoverview만 정리)

### 2) UI에서 과목 선택기 숨김
- `src/components/study/StudySubTabs.jsx` — `<SubjectSelector />` 및 좌측 구분선 제거, import 제거
- `src/components/study/SubjectSelector.jsx` — 파일 자체는 유지(향후 재도입 가능성). 단, 더 이상 import 되지 않으므로 빌드에서 자연 탈락. 또는 깔끔히 삭제. **결정: 삭제** (사용자 정책상 backwards-compat shim 금지)

### 3) 스토어/데이터 스키마 (보수적)
- `useStudyStore`의 `subjects[id]` 버킷 구조는 **그대로 유지**한다.
  - 이유: 현재 SubjectSelector가 사라져도 UI에서 `activeSubject`는 항상 기본값(`sqlp`)에 머무름. persist 마이그레이션을 굳이 도입하면 기존 사용자의 오답/통계 데이터가 의도치 않게 이동·소실될 위험이 있다.
  - 단, `activeSubject` 외부 노출(드롭다운)이 사라졌으므로 사용자가 다른 버킷을 선택할 경로가 없다 → 사실상 단일 컨텍스트로 동작.
- `src/registry/subjects.js`, `src/utils/examScoring.js`, `QuizResultByParts.jsx` 등 과목별 분기는 **그대로 유지**한다 (현재 활성 버킷=SQLP가 가진 parts/passingCriteria가 계속 유효). 모의고사 결과 화면의 과목별 집계는 그대로 동작.

### 4) 영향 없음 (확인만)
- API 호출 (`getStudyStats({ subject })`, `generateQuiz({ subject })`): `activeSubject`가 항상 `'sqlp'`로 고정되므로 백엔드 인터페이스 변경 없음.

## 구현 계획
1. `src/registry/modes.js`에서 `label`/`description` 변경, fileoverview 갱신
2. `src/components/admin/RecentConversations.jsx` 라벨 매핑 변경
3. `src/components/study/StudySubTabs.jsx`에서 SubjectSelector 사용처 + import 제거, 구분선 제거, 관련 fileoverview 정리
4. `src/components/study/SubjectSelector.jsx` 파일 삭제
5. `npm run build` 또는 dev 서버 재기동으로 빌드 검증
6. 브라우저로 모드 사이드바·학습 탭 진입 확인

## 단위 테스트 계획
- 사이드바 모드 버튼에 "공부"가 표시되고 GraduationCap 아이콘은 그대로 노출
- 공부 모드 진입 시 상단에 SubjectSelector 드롭다운이 보이지 않음
- 학습 채팅 / 퀴즈 / 기록 3개 탭이 정상 노출, 진행/오답 뱃지 동작
- 새 모의고사 시작 → 결과 화면이 SQLP parts 기준으로 정상 렌더 (단일 버킷이 유지되는지 확인)
- admin/RecentConversations 컴포넌트가 모드 라벨 "공부"를 표시 (조건부 — admin 진입 가능 시)

## 회귀 테스트 계획
- 일반 채팅 모드 진입/메시지 송수신 정상
- 업무학습 모드 진입 정상
- 마인드맵 토글 정상
- 모드 전환 후 재진입 시 이전 상태(activeStudySubTab 등) 보존
