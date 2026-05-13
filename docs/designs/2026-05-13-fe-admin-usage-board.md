# 설계: 2026-05-13-fe-admin-usage-board

**생성:** 2026-05-13 17:53
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-fe-admin-usage-board
**브랜치:** task/2026-05-13-fe-admin-usage-board

## 목표
AdminPage 에 "LLM 사용량" 섹션을 추가해 관리자가 사용자별 LLM 비용을 한눈에 본다.
BE 의 GET /api/admin/usage 를 호출하고, 기간 토글(오늘/주/달/전체) + 사용자별 표 + 행 클릭 시 모델별 펼침.

## 변경 범위 (모두 FE 리포)
1. `src/components/admin/AdminUsageBoard.jsx` 신설
2. `src/pages/AdminPage.jsx` — 신설 섹션 추가 (SuggestionsBoard 와 동일 카드 패턴)
3. (기존) `src/services/usageApi.js` 의 `getAdminUsage(period)` 활용 — Phase 3 에서 이미 정의됨

## 구현 계획
### AdminUsageBoard.jsx
- 자체 state: `period` (today|week|month|total, 기본 month), `data` (AdminUsageResponse), `loading`, `error`, `expandedUserId` (행 펼침)
- 마운트 + period 변경 시 `getAdminUsage(period)` 호출
- 상단: 기간 토글 칩 + 합계 카드("이번 달 총 $X.XX / ₩X · 활성 사용자 N명")
- 본문: 사용자 표 — 컬럼(사용자/권한/입력토큰/출력토큰/비용 USD/비용 KRW/마지막 사용)
- 행 클릭 → byModel 펼침: 모델별 입력/출력 토큰 + USD + KRW + 호출 횟수
- 빈 데이터/에러/로딩 상태 UI

### AdminPage 통합
- import + state: `adminUsage` 는 컴포넌트 내부에서 관리(부모는 컨테이너만 제공)
- "기능개선 제안" 위 또는 아래에 별도 `<section>` 으로 삽입
- SuggestionsBoard 와 동일 카드 스타일 (`bg-bg-secondary/40 border rounded-xl p-3`)

## 단위 테스트 계획
- ADMIN 로그인 → /admin 진입 → "LLM 사용량" 섹션 표시
- 기간 칩 클릭 → 표 데이터 갱신 (BE 호출 1회)
- 데이터 없는 사용자(이번달 0)는 표에서 제외 (BE 가 INNER JOIN 으로 사용 기록 있는 사용자만 응답)
- 행 클릭 → byModel 펼침, 다시 클릭 → 접힘
- USD/KRW 형식 일관 ($X.XX / ₩X,XXX)
- 인증 만료/네트워크 실패 → 에러 메시지

dev :3005 transform 통과 + 실제 UI 확인.

## 회귀 테스트 계획
- AdminPage 의 기존 섹션(통계/대시보드/대화/문서/제안) 정상 유지
- 일반 사용자가 /admin 진입 시 메인으로 리다이렉트 (기존 가드)
- 채팅·사이드바·기타 페이지 무관
