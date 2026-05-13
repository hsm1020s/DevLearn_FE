# 설계: 2026-05-13-fe-admin-tabbed-layout

**생성:** 2026-05-13 19:41
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-fe-admin-tabbed-layout
**브랜치:** task/2026-05-13-fe-admin-tabbed-layout

## 목표
관리자 페이지(`/admin`)의 현재 "한 화면에 모든 섹션을 위→아래로 쌓아 스크롤하는" 구조를 **좌측 탭 메뉴 + 우측 컨텐츠 영역**(카페24 어드민 스타일)로 변경한다. 각 섹션을 한 번에 한 탭만 노출해서 화면이 짧아지고 탐색이 빨라지도록 한다. 기능·데이터 흐름은 변경 없음(순수 레이아웃 리팩터).

### 현재 구조 (수직 스크롤)
[AdminPage.jsx](src/pages/AdminPage.jsx) 의 메인 영역에 6개 섹션을 `space-y-6` 으로 단일 컬럼 나열:
1. **사용 현황** — `StatCard` x4 (총 대화 / 업로드 문서 / 마인드맵 노드 / 풀이한 문제)
2. **최근 대화** — `RecentConversations`
3. **문서 현황** — `DocumentTable`
4. **LLM 사용량** — `AdminUsageBoard`
5. **사용자 채팅** — `AdminConversationsBoard`
6. **기능개선 제안** — `SuggestionsBoard`

## 변경 범위

### 변경 파일 (1개)
- [src/pages/AdminPage.jsx](src/pages/AdminPage.jsx) — 레이아웃·라우팅 로직만 수정. 자식 컴포넌트(`StatCard`, `RecentConversations`, `DocumentTable`, `AdminUsageBoard`, `AdminConversationsBoard`, `SuggestionsBoard`) 시그니처 무변경.

### 새 컴포넌트 없음 (이번 PR 한정)
탭은 작은 인라인 구조(좌측 `<nav>` + 우측 `<main>`)로 처리한다. 별도 `AdminTabs` 컴포넌트로 추출하지 않는다 — 사용처가 1곳뿐이고 props 가 단순(현재 활성 키 + 메뉴 배열). 향후 다른 페이지에서 같은 패턴이 필요할 때 추출.

## 구현 계획

### Phase A — 탭 정의 + 활성 상태
- 탭 메타 배열 정의 (id / label / icon / 렌더 함수). 6개 섹션 → 5개 탭으로 합친다:
  1. `dashboard` — 사용 현황(StatCards) + 최근 대화 (개요 페이지로 묶음).
  2. `documents` — 문서 현황.
  3. `usage` — LLM 사용량.
  4. `conversations` — 사용자 채팅.
  5. `suggestions` — 기능개선 제안.
- 활성 탭 상태: `useState('dashboard')` 기본값. URL 동기화는 이번 PR 에서는 하지 않는다(스코프 절제).
- 새로고침 버튼은 기존대로 상단 헤더 우측에 유지. 활성 탭이 `dashboard` 일 때만 노출 (다른 탭은 자체 새로고침 컨트롤이 있거나 데이터를 매 진입시 가져온다).

### Phase B — 레이아웃 변경
- 현재의 `max-w-4xl mx-auto space-y-6` 단일 컬럼을 **좌측 사이드 + 우측 메인** 2분할로 교체.
- 데스크톱 기준:
  - 좌측 `<nav>` — `w-56`(224px) 고정 폭, `border-r border-border-light`, 위에서부터 탭 버튼 리스트.
  - 우측 `<main>` — `flex-1 overflow-y-auto`, 안에 활성 탭의 컴포넌트만 렌더.
- 모바일(`md` 미만): 좌측 탭을 상단 가로 스크롤 바로 변경. (1단 분기, 별도 햄버거는 두지 않음.)
- 탭 버튼 스타일 — 활성: `bg-bg-secondary text-text-primary font-medium border-l-2 border-primary`, 비활성: `text-text-secondary hover:bg-bg-secondary/50`. 모두 디자인 토큰(`bg-bg-secondary`, `text-text-primary` 등)만 사용. 하드코딩 색상 금지.
- 아이콘: 기존 섹션 헤더에 쓰던 lucide 아이콘 그대로 재사용 (`BarChart3`, `MessageSquare`, `Lightbulb`, `BookOpen` 등).

### Phase C — 폴백/로딩/에러 상태 처리
- `loading && !data` 일 때 — 좌측 nav 셸은 그대로 그리고, 우측 메인 영역만 `DashboardSkeleton` 으로 채운다(기존엔 전체 페이지 스켈레톤).
- `error && !data && !hasAnyFallback` 일 때 — 우측 메인 영역에 `DashboardError`. 탭은 정상 노출하되 dashboard 외 탭으로 이동은 가능.
- 폴백 경고 배너(`error && !data && hasAnyFallback`) — dashboard 탭 상단에만 노출. 다른 탭에서는 보이지 않음.

## 단위 테스트 계획
브라우저(`/admin`) 진입 후 (결과는 `evidence/unit/notes.md` 에 기록):
1. 첫 진입 시 좌측 nav 5개 탭 노출, dashboard 탭이 활성, 우측에 StatCard x4 + 최근 대화 카드 정상.
2. 좌측 탭 클릭(문서 → LLM 사용량 → 사용자 채팅 → 기능개선 제안) 순회 — 각 탭 클릭 시 우측 컨텐츠가 즉시 교체되고 새로고침 없이 부드럽게 전환.
3. 데이터 로딩 중 진입 → 좌측 nav 노출 + 우측 스켈레톤.
4. 폴백 배너 — 서버 실패 + 로컬 폴백 있는 상태에서 dashboard 탭 상단에만 경고 배너 노출, 다른 탭에서 이동 시 비노출.
5. 모바일 폭(`md` 미만, DevTools responsive)에서 좌측 nav 가 상단 가로 스크롤로 바뀌고, 탭 전환 동일.
6. role !== 'ADMIN' 진입 시 기존대로 `/` 리다이렉트(가드 보존).

## 회귀 테스트 계획
이번 변경과 무관한 주요 기능을 직접 확인 후 `evidence/regression/notes.md` 에 기록:
- 일반 사용자 채팅 1회 송수신 → 사이드바 대화 목록 정상.
- 사이드바 "설정" 클릭 → `/settings` 정상 진입 (직전 PR 결과 보존).
- 마인드맵 토글 → 캔버스 렌더.
