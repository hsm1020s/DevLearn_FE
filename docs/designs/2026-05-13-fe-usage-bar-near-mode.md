# 설계: 2026-05-13-fe-usage-bar-near-mode

**생성:** 2026-05-13 18:16
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-fe-usage-bar-near-mode
**브랜치:** task/2026-05-13-fe-usage-bar-near-mode

## 목표
ChatUsageBar 가 헤더 오른쪽 끝에 딱 붙어 있는 걸, 모드 라벨("공부" 등) 바로 옆으로 가깝게 배치한다.

## 변경 범위
`src/components/layout/ModeHeader.jsx` 한 파일.

## 구현 계획
- `justify-between` 제거 → `flex items-center gap-6` 로 변경
- 좌측 그룹(햄버거+아이콘+라벨) 뒤에 ChatUsageBar 가 자연스럽게 붙음 (gap-6 = ~24px 간격)
- 우측 빈 공간은 그대로 남음
- 모드 라벨이 truncate 되더라도 사용량 바는 우측에 안 붙고 라벨 옆 자리 유지

## 단위 테스트 계획
- "공부 [24px gap] $0.04 / ₩60 | 오늘 …" 형태로 표시
- 라벨이 짧을 때든 길 때든 사용량 바가 라벨 바로 옆

## 회귀 테스트 계획
- 모바일 햄버거 위치 유지
- 사용량 바는 모바일에서 `hidden sm:flex` 로 가려진 채 유지
