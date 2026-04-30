# 설계: 2026-04-22-simplify-mode-header

**생성:** 2026-04-22 12:28
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-22-simplify-mode-header
**브랜치:** task/2026-04-22-simplify-mode-header

## 목표
ModeHeader가 모드 라벨 뒤에 `— {description}`을 항상 붙여 표시하는데(예: "자격증 — SQLP · DAP 퀴즈 학습"), 사용자가 라벨만 남기길 원한다. 구분자(`—`)와 description 문자열을 ModeHeader 렌더에서 제거한다.

### 스코프
- `src/components/layout/ModeHeader.jsx` 단독 수정 — 구분자 span과 description span 삭제
- `MODES.*.description` 값 자체는 유지(사이드바 호버 툴팁 / 향후 다른 곳에서 재사용 가능성 열어둠)

### 비(非)목표
- 사이드바 등 다른 UI에서 description 사용 여부 손대지 않음

## 변경 범위
| 경로 | 변경 |
|------|------|
| `src/components/layout/ModeHeader.jsx` | 라벨 우측의 `—` separator + description span 제거 |

## 구현 계획
1. ModeHeader에서 구분자·description 2개 span 삭제
2. 빌드 + dev 스모크 + evidence
3. 병합 + push + 정리

## 단위 테스트
- 일반 모드 헤더: "일반"만 노출
- 자격증 모드: "자격증"만 노출
- 업무학습 모드: "업무학습"만 노출
- 모바일 햄버거 버튼 + 아이콘 여전히 표시
- 빌드 성공

## 회귀
- 사이드바에서 모드 클릭 → 헤더 라벨만 갱신, 나머지 UI 영향 없음
