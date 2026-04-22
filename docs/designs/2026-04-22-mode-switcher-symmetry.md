# 설계: 2026-04-22-mode-switcher-symmetry

**생성:** 2026-04-22 12:42
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-22-mode-switcher-symmetry
**브랜치:** task/2026-04-22-mode-switcher-symmetry

## 목표
일반 모드의 빈 화면에만 있던 **중앙 모드 전환 탭 + 마인드맵 토글** 묶음을 자격증·업무학습 모드의 빈 화면에서도 동일하게 노출해 모드 간 이동 대칭성을 확보한다. 기존 고아 `ModeSwitcher` 컴포넌트를 EmptyChatView의 인라인 디자인으로 승급해 3군데 빈 상태에서 공용한다.

### 스코프
- `src/components/common/ModeSwitcher.jsx` 업그레이드 — 3개 모드 버튼(큰 크기, 기존 EmptyChatView 스타일) + 구분선 + 마인드맵 토글
- `src/components/chat/EmptyChatView.jsx` — 인라인 JSX 블록을 `<ModeSwitcher />` 로 교체
- `src/components/study/StudyChatTab.jsx` — 빈 상태 헤더 아래에 `<ModeSwitcher />` 삽입 (`mode="study"`와 `mode="worklearn"` 공용, 따로 분기 불필요)

### 비(非)목표
- 사이드바 UX 변경 없음
- 채팅 non-empty 상태(메시지 있을 때)에는 탭 노출 안 함(기존 패턴 유지)
- 스위처 자체 애니메이션·단축키 등 추가 기능 없음

## 변경 범위
| 경로 | 변경 |
|------|------|
| `src/components/common/ModeSwitcher.jsx` | 모드 3개 버튼 + 마인드맵 토글 포함 공용 바. EmptyChatView의 인라인 디자인과 시각 동일(px-3 py-1.5, text-sm, 구분선, Brain 아이콘) |
| `src/components/chat/EmptyChatView.jsx` | 인라인 mode 탭 + 마인드맵 토글 JSX 삭제 → `<ModeSwitcher />` 한 줄로 치환 |
| `src/components/study/StudyChatTab.jsx` | 빈 상태 섹션에서 타이틀 바로 밑에 `<ModeSwitcher />` 추가 |

## 구현 계획
1. ModeSwitcher 업그레이드 (EmptyChatView 인라인과 동일 시각)
2. EmptyChatView 리팩터 — 인라인 블록 제거 후 ModeSwitcher 사용
3. StudyChatTab 빈 상태에 ModeSwitcher 추가
4. 빌드 + dev 스모크 + evidence
5. 병합 + push + 정리

## 단위 테스트
| # | 시나리오 | 기대 |
|---|---------|------|
| 1 | 일반 모드 빈 화면 | ModeSwitcher 중앙에 3개 탭 + 마인드맵 토글. 디자인은 기존과 동일 |
| 2 | 자격증 모드 빈 화면(신규) | 상단 아이콘/타이틀 아래 동일 바 노출. "일반" 또는 "업무학습" 버튼 클릭 시 즉시 모드 전환 |
| 3 | 업무학습 모드 빈 화면 | 동일 바 노출. 모드 전환 동작 정상 |
| 4 | 메시지 입력 후 | 스위처 숨겨짐(빈 상태 조건 벗어남) |
| 5 | 마인드맵 토글 | 3모드 모두에서 on/off 정상 |
| 6 | 활성 모드 하이라이트 | 현재 모드 버튼이 primary 톤으로 강조 |

## 회귀
- 모드 전환 후 이전 대화 복원(lastActiveByMode) 정상
- 자격증 모드 과목 드롭다운·StudyHomeCards·퀴즈 플로우 영향 없음
- 업무학습 모드 탭 바(채팅/업무노트/체크리스트) 정상
