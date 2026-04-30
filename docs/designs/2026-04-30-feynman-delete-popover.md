# 설계: 2026-04-30-feynman-delete-popover

**생성:** 2026-04-30 22:35
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-30-feynman-delete-popover
**브랜치:** task/2026-04-30-feynman-delete-popover

## 목표
`FeynmanPipelineTab.jsx` 에 남아있던 `window.confirm` 두 곳(문서 삭제, TOC 재추출 경고)을
프로젝트 표준인 인라인 확인 팝오버로 교체해 CLAUDE.md UI 규칙(브라우저 내장 confirm 금지)을 준수.

## 변경 범위
- `src/components/feynman/FeynmanPipelineTab.jsx`
  - `handleDeleteDoc`: window.confirm → 버튼 옆 fixed 팝오버
  - `handleRetryToc`: ragIndexed=true 분기의 window.confirm → 같은 팝오버 패턴
  - `confirmAction` state: `{ type: 'delete'|'toc', doc, rect }` 단일 슬롯
  - 바깥 클릭 닫힘 useEffect, ref, 실행 핸들러 추가

## 참고 패턴
`src/components/layout/Sidebar.jsx:723-752` 의 `deleteConfirm` 팝오버 구조를 거의 그대로 이식.
- `getBoundingClientRect()` 로 버튼 좌표 캡처
- fixed + z-[999], `top: rect.top, left: rect.right + 6`
- 취소(secondary)·실행(danger) 두 버튼

## 구현 계획
1. `confirmAction` state + ref + 바깥클릭 effect 추가.
2. 삭제: `requestDeleteDoc(doc, e)` 가 팝오버 띄우고 `confirmAction.run` 콜백에 실삭제 로직 보관.
3. TOC 재추출: ragIndexed=false 면 즉시 실행, true 면 팝오버.
4. 삭제 버튼·TOC 재추출 버튼 onClick 교체 (이벤트 인자 받아 rect 캡처).
5. JSX 말미에 팝오버 렌더 추가. `type` 에 따라 메시지/버튼 라벨 분기.

## 단위 테스트 계획
- 삭제 버튼 클릭 → 팝오버가 버튼 옆에 뜸 → "삭제" 클릭 시 deleteDoc 호출.
- 팝오버 바깥 클릭 시 닫힘 + deleteDoc 미호출.
- ragIndexed=true 문서의 TOC 재추출 클릭 → 경고 팝오버 → 확인 시 retryToc 호출.
- ragIndexed=false 문서의 TOC 재추출 클릭 → 팝오버 없이 즉시 실행 (기존 동작 유지).
- `vite build` 성공.

## 회귀 테스트 계획
- 다른 모드(채팅/마인드맵/공부) 진입·전송 정상.
- 사이드바 채팅 삭제 팝오버는 영향 없음 (별도 컴포넌트).
- FE/BE dev-health 정상.

