# 설계: 2026-05-13-fe-split-handle-wider-hitzone

**생성:** 2026-05-13 19:07
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-fe-split-handle-wider-hitzone
**브랜치:** task/2026-05-13-fe-split-handle-wider-hitzone

## 목표
공부/업무학습 모드의 좌(일반채팅)·우(파인만채팅) 분할 워크스페이스에서, 가운데 리사이저
핸들이 너무 얇아서(`w-px` = 1px) 채팅 영역(`overflow-y-auto`) 위로 커서가 살짝만
벗어나도 핸들을 못 잡고 스크롤만 발생하는 문제를 해결한다.

핵심 요구:
- 시각적으로 거슬리지 않게 라인은 가늘게 유지하되,
- **포인터 히트 영역**(클릭 가능 영역)을 넓혀 쉽게 잡을 수 있게 한다.
- 발견성을 위해 호버 시 시각적 단서(grip 노브)를 명확히 보여준다.
- 채팅 패널의 실제 가로폭은 그대로 유지(히트 존이 두 패널 사이 공간을 추가로 차지하더라도
  컨테이너 너비 안에서 흡수되도록).

## 변경 범위
- `src/components/study/SplitLearningWorkspace.jsx` — 가운데 리사이저 div 마크업/클래스 수정
  - 외부 wrapper: 넓은 히트존(`w-3` ≈ 12px), `cursor-col-resize`, pointer 이벤트 바인딩
  - 내부 child: 가는 시각적 라인(`w-px`), 호버 시 라인 굵어짐 + 중앙 grip 노브
- 다른 파일 영향 없음. 이 컴포넌트는 study/worklearn 모드 워크스페이스 한 곳에서만 사용.

## 구현 계획
1. SplitLearningWorkspace.jsx 의 리사이저 핸들 div 를 두 겹 구조로 변경:
   - 바깥: `w-3 shrink-0 cursor-col-resize` + 모든 포인터 핸들러 + `group` 클래스
   - 안: `w-px h-full bg-border-medium` (시각 라인) + `group-hover:w-1 group-hover:bg-primary/60 group-active:bg-primary`
   - 중앙에 항상 보이는 grip 노브: 세로로 길쭉한 작은 핸들 표시 (호버 시 더 진해짐)
2. JSDoc 주석 갱신 — 히트 존이 시각 라인보다 넓다는 점 명시.

## 단위 테스트 계획
- dev 서버 띄워서 공부 모드(좌:일반 / 우:파인만) 진입
- 채팅 영역에 메시지가 많아 스크롤이 생긴 상태에서:
  - 핸들 근처 (가운데 ±6px) 어디서나 cursor 가 col-resize 로 바뀌고 드래그 시작 가능
  - 드래그 중 화면 다른 곳으로 포인터가 벗어나도 pointer capture 로 추적 유지
  - 좌측 폭 비율(20~80) 클램프 정상 동작
- 호버 시 grip 노브가 강조되는지 시각 확인

## 회귀 테스트 계획
- 일반 채팅 입력/전송/스크롤 정상
- 파인만 모드 시작/진행 흐름 정상 (우측 패널)
- 마인드맵-채팅 분할(`SplitView`, 다른 비율 변수)에 영향 없음 확인
