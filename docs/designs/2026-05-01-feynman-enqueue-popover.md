# 설계: 2026-05-01-feynman-enqueue-popover

**생성:** 2026-05-01 00:17
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-01-feynman-enqueue-popover
**브랜치:** task/2026-05-01-feynman-enqueue-popover

## 목표
파인만 파이프라인의 "전체 실행" 버튼이 사용하는 `window.confirm`을 인-앱 커스텀 팝오버로 교체한다. CLAUDE.md 규칙(`alert/confirm` 금지, 위험 동작은 팝오버 우선)을 준수하기 위함이며, 기존 삭제/TOC 재추출 팝오버와 동일한 시각·동작 패턴을 사용한다.

## 변경 범위
- `src/components/feynman/FeynmanPipelineTab.jsx` 단일 파일.
  - `handleEnqueueAll`을 두 단계로 분리: 트리거(팝오버 띄우기) / 실행(실제 API 호출).
  - 기존 `confirmAction` state에 새 type `'enqueue-all'` 추가 (`{ type, count, mode, rect }`).
  - 팝오버 JSX에 `enqueue-all` 분기 추가 (메시지·버튼 라벨).
  - `handleConfirmAction` switch에 `enqueue-all` 분기 추가.

## 구현 계획
1. "전체 실행" 버튼 onClick을 `(e) => triggerEnqueueAll(e, 'skip_embed')`로 교체.
   - `triggerEnqueueAll`는 enqueueable 0건이면 무시, 그렇지 않으면 `getBoundingClientRect()`로 위치 계산해 `setConfirmAction({ type: 'enqueue-all', count, mode, rect })`.
2. 실제 큐 등록 로직은 `runEnqueueAll(mode)`로 분리 (try/catch + showSuccess/showError + loadDocs).
3. `handleConfirmAction`에서 `type === 'enqueue-all'` 일 때 `runEnqueueAll(confirmAction.mode)` 호출.
4. 팝오버 메시지 분기 추가:
   - 본문: `"{count}개 문서를 일괄 실행할까요?"` + 모드 설명 보조 문구.
   - 확인 버튼 라벨: "실행", 색상은 `bg-primary` (위험 동작 아님 — danger 아님).

## 단위 테스트 계획
- uploaded/error 문서가 있을 때 "전체 실행" 클릭 → 팝오버가 트리거 버튼 우측에 뜨는지.
- 팝오버에 정확한 카운트/모드 문구가 보이는지.
- "취소" 클릭 → 팝오버 닫힘, API 호출 없음.
- "실행" 클릭 → 큐 등록 API 호출, success toast, 목록이 queued 상태로 갱신.
- 외부 영역 클릭 시 팝오버 자동 닫힘 (기존 useEffect 동작 유지).
- enqueueable 0건이면 버튼 자체가 숨겨져 트리거 불가 (기존 동작 유지).

## 회귀 테스트 계획
- 기존 삭제 팝오버 정상 동작 (다른 type 분기 영향 없음).
- 기존 TOC 재추출 팝오버 정상 동작.
- 채팅 / 마인드맵 등 다른 주요 기능 1개 사용해 사이드이펙트 없음 확인.
