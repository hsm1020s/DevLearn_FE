# 설계: 2026-04-22-remove-adaptive-quiz

**생성:** 2026-04-22 12:05
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-22-remove-adaptive-quiz
**브랜치:** task/2026-04-22-remove-adaptive-quiz

## 목표
QuizSettings의 "🎚️ 적응형 출제" 토글을 제거한다. 사용자가 직접 난이도를 선택하는 편이 UX가 명확하고, mock 백엔드에서 실제로 적응형 출제 로직이 구현돼 있지 않아 토글 존재가 기능을 오해하게 만든다.

### 스코프
- QuizSettings 내 `adaptive` 상태 + 체크박스 UI 삭제
- 난이도 드롭다운의 disabled/overrides 관련 분기 제거
- 파일 상단 주석 정리

### 비(非)목표
- 난이도 드롭다운·문제 유형·모의고사 프리셋 등 다른 설정은 그대로 유지

## 변경 범위
| 경로 | 변경 |
|------|------|
| `src/components/study/QuizSettings.jsx` | adaptive state/체크박스/disabled 분기 제거, Gauge 아이콘 import 제거(미사용 시), 파일/컴포넌트 주석 정비 |

## 구현 계획
1. adaptive state 및 체크박스 JSX 제거
2. 난이도 드롭다운의 `value`/`disabled` 적응형 분기 삭제
3. `applyExamPreset`·`handleGenerate`에서 adaptive 참조 제거
4. 사용하지 않게 된 Gauge import 정리
5. 상단 주석에서 "적응형" 언급 삭제
6. 빌드 + 스모크 + evidence + 병합

## 단위 테스트 계획
| # | 시나리오 | 기대 |
|---|---------|------|
| 1 | QuizSettings 진입 | 적응형 체크박스 없음, 난이도 드롭다운 항상 활성 |
| 2 | 난이도 선택 후 퀴즈 시작 | 선택한 난이도가 그대로 generateQuiz에 전달 |
| 3 | 모의고사 프리셋 클릭 | 난이도 'mixed'로 세팅, 이전과 동일 |
| 4 | 모의고사 해제 | 일반 퀴즈 설정 복귀 |
| 5 | 빌드/린트 | unused import 없음 |

## 회귀 테스트 계획
- 자격증 모드 전체 플로우(설정→풀이→결과)
- 일반/업무학습/마인드맵·로그인 영향 없음 확인
