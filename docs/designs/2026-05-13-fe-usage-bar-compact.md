# 설계: 2026-05-13-fe-usage-bar-compact

**생성:** 2026-05-13 18:12
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-fe-usage-bar-compact
**브랜치:** task/2026-05-13-fe-usage-bar-compact

## 목표
헤더에 들어간 ChatUsageBar 가 3줄(라벨/USD/KRW) 구조라 헤더 세로 높이가 커졌다.
한 줄로 압축해 헤더 높이를 원래대로 되돌린다.

표기 형식 (사용자 지정):
```
$0.04 / ₩60 | 오늘    $0.25 / ₩340 | 이번주    $4.02 / ₩6,030 | 이번달
```

## 변경 범위
1. `src/components/common/ChatUsageBar.jsx` — PeriodCell 을 1줄 인라인 표기로 재구성.

## 구현 계획
- PeriodCell:
  - 기존: `flex flex-col` 3줄 (라벨/USD/KRW)
  - 변경: `inline-flex items-center gap-1.5 text-xs` 1줄
  - 구조: `<span>{USD}</span><span className="text-text-tertiary">/</span><span>{KRW}</span><span className="text-text-tertiary mx-1">|</span><span className="text-text-tertiary">{label}</span>`
- 외곽 컨테이너:
  - 기존 `py-1.5` 유지하되 자연스럽게 1줄이라 헤더 높이 축소
- 모바일 협소 화면 대응: gap 줄이고 폰트 살짝 작게 (text-[11px])

## 단위 테스트 계획
- 헤더 세로 높이가 이전 phase(이동) 이전 수준으로 복원
- 텍스트가 "$0.04 / ₩60 | 오늘" 형태로 가독성 확보
- summary null 시 "—" 자리표시자 그대로

## 회귀 테스트 계획
- ChatUsageBar 호출처는 ModeHeader 하나라 영향 격리
- 자동 갱신 hook 그대로 작동
