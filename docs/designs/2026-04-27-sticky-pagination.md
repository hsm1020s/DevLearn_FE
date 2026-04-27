# 설계: 2026-04-27-sticky-pagination

**생성:** 2026-04-27 13:16
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-27-sticky-pagination
**브랜치:** task/2026-04-27-sticky-pagination

## 목표
파인만 → 파이프라인 관리 페이지에서, 마지막 페이지처럼 카드 수가 적을 때 페이지네이션 컨트롤이 카드 바로 아래로 떠올라서 보기 거슬리는 문제 해결.

- 페이지네이션 + 총 건수 안내를 **항상 컨테이너 하단 고정 푸터**로 분리.
- 카드만 스크롤되고 푸터는 그대로 유지.
- **1페이지여도 푸터 노출** (총 건수 안내는 항상 보임). 페이지 1개면 페이지 번호 버튼은 자동으로 적게 표시(이미 `pageNumbers` 헬퍼가 처리).

## 변경 범위
- `src/components/feynman/FeynmanPipelineTab.jsx`
  - 외곽 `flex flex-col h-full` 그대로.
  - 본문 컨테이너: `<div className="flex-1 overflow-y-auto p-4">` — 목록만 스크롤.
  - 본문 끝에 있던 페이지네이션/총 건수 블록을 **본문 밖, 새 푸터 영역**으로 이동.
  - 푸터: `<div className="shrink-0 border-t border-border-light px-4 py-3 bg-bg-primary flex items-center justify-between gap-2">`
    - 좌측: `총 N건 · i/N` (textXs, tertiary)
    - 가운데: 페이지 버튼들(이전/번호/다음). `pageNumbers(page, totalPages)` 그대로 사용.
    - 우측: 균형용 빈 공간(`w-[88px] shrink-0` 정도, 좌측 텍스트와 거의 같은 너비).
  - 푸터 노출 조건: `!loading && totalCount > 0`. (totalCount=0이면 빈 상태이므로 푸터 숨김 자연스러움.)
  - 페이지 버튼은 totalPages>1 일 때만 그리고, 1페이지면 가운데에 버튼이 비어 보일 수 있어 `<span>1 페이지</span>` 같은 인디케이터를 넣을지 검토 → 단순히 비워두면 좌측 "총 N건 · 1/1" 만으로 충분하다고 판단.

### 비변경
- `feynmanApi.fetchDocsPage`, `pageNumbers` 헬퍼, BE 엔드포인트, 폴링 로직, 카드 내용/스타일.

## 구현 계획
1. 본문 컨테이너 닫는 위치를 목록 직후로 옮긴다(현재는 페이지네이션까지 포함).
2. 페이지네이션 + 총 건수를 푸터로 빼낸다(레이아웃: justify-between).
3. 페이지 버튼들은 그대로 재사용(이전 / `pageNumbers` 매핑 / 다음). 1페이지일 때 자동으로 1개만 그려져 가운데가 비어 보이지 않도록 조건 정리.
4. dev 서버 새로고침으로 시각 확인(카드 5개 + 다음 페이지 0개 케이스, 카드 1개 케이스, 빈 케이스).

## 단위 테스트 계획
- [ ] 다중 페이지(예: 12건, 페이지당 10건) 마지막 페이지(2건)에서 푸터가 화면 하단에 고정되는지
- [ ] 1페이지(예: 5건)에서 푸터가 보이고 좌측에 "총 5건 · 1/1" 표시되는지
- [ ] 빈 페이지(0건)에서 푸터 숨김
- [ ] 본문 카드만 스크롤되고 푸터는 안 움직이는지
- [ ] 7페이지 초과 시 ... 축약 그대로 동작
- 결과: `.claude/state/evidence/2026-04-27-sticky-pagination/unit/notes.md`

## 회귀 테스트 계획
- [ ] 헤더(상태 필터/PDF 업로드) 정상
- [ ] 카드 클릭/실행 버튼 정상
- [ ] 사이드바 문서 업로드 모달 정상
- 결과: `.claude/state/evidence/2026-04-27-sticky-pagination/regression/notes.md`
