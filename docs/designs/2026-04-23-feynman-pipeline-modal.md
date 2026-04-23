# 설계: 2026-04-23-feynman-pipeline-modal

**생성:** 2026-04-23 12:23
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-feynman-pipeline-modal
**브랜치:** task/2026-04-23-feynman-pipeline-modal

## 목표
사이드바 "문서 업로드" 버튼 바로 **위**에 **"문서 파이프라인"** 버튼을 추가. 클릭 시
큰 모달(팝업)로 기존 `FeynmanPipelineTab` 의 화면을 그대로 보여준다. 파인만 모드 내부
"파이프라인 관리" 탭은 **그대로 유지** — 두 경로(사이드바 팝업, 탭)가 동일 기능을 제공.

## 변경 범위
- **신규 `src/components/common/FeynmanPipelineModal.jsx`**
  - 센터 정렬 대형 모달 (90vw · max 5xl · 85vh). 오버레이 클릭 또는 ESC 키로 닫힘.
  - 내부에 기존 `FeynmanPipelineTab` 그대로 렌더. `isOpen=false` 일 땐 컴포넌트 언마운트
    → 폴링 타이머 자동 정리 + 초기 로드 비용 없음.
  - body overflow-hidden 은 필요 없음(탭 내부가 자체 스크롤).
- **수정 `src/components/layout/Sidebar.jsx`**
  - `Workflow` 아이콘 + `FeynmanPipelineModal` import.
  - `showPipeline` state + `pipelineBtnRef`.
  - "문서 업로드" 버튼 위에 "문서 파이프라인" 버튼 추가 (같은 스타일).
  - 컴포넌트 하단에 `<FeynmanPipelineModal isOpen={showPipeline} onClose={...} />` 마운트.
  - 새 버튼은 `anchorRef` 없이 — 대형 중앙 모달이라 포지셔닝 불필요.
- **불변:** `FeynmanPipelineTab.jsx` · `feynmanApi` · 파인만 모드 탭 구조 전혀 손대지 않음.

## 구현 계획
1. `FeynmanPipelineModal.jsx` 작성
   - `useEffect` 로 ESC 키 리스너 (`keydown` → onClose).
   - `className` 루트: `fixed inset-0 z-50 flex items-center justify-center`.
   - 오버레이: `absolute inset-0 bg-black/40`.
   - 본체: `relative bg-bg-primary rounded-xl border border-border-light w-[90vw] max-w-5xl h-[85vh] flex flex-col shadow-xl animate-popover-in overflow-hidden`.
   - 헤더: "문서 파이프라인" 타이틀 + X 닫기 버튼.
   - 본문: `<div className="flex-1 min-h-0"><FeynmanPipelineTab /></div>` — `FeynmanPipelineTab`
     이 내부에서 `flex-col h-full` 로 컨테이너 채움.
2. `Sidebar.jsx` 수정
   - import 추가: `Workflow`, `FeynmanPipelineModal`.
   - state/ref 추가: `showPipeline`, `pipelineBtnRef` (안전용 — 현재 미사용, 추후 확장).
   - 버튼 블록: 문서 업로드 버튼 **바로 위**에 새 버튼 배치.
   - Modal 마운트: 기존 `DocumentUploadModal` 옆에 `FeynmanPipelineModal` 추가.
3. 검증
   - `vite build` 성공.
   - dev 서버(3100)에서 사이드바 DOM 에 "문서 파이프라인" 버튼이 "문서 업로드" 위에
     렌더되는지 headless Chrome 으로 확인.
   - 사용자 수동: 버튼 클릭 → 모달 열림 → `FeynmanPipelineTab` UI 렌더 → ESC/오버레이/X 로 닫힘.

## 단위 테스트 계획 (evidence/unit/notes.md)
자동:
1. `vite build` 성공.
2. Dev 서버에서 `Sidebar.jsx` 번들에 `FeynmanPipelineModal` / `Workflow` 심볼 포함.
3. headless Chrome 첫 화면 DOM 에 "문서 파이프라인" 텍스트 존재.

수동:
4. 사이드바 "문서 파이프라인" 클릭 → 큰 모달 열림. 내부에 PDF 업로드/파이프라인 실행
   UI 존재.
5. ESC 키 / 오버레이 클릭 / X 버튼으로 닫힘.
6. 파인만 모드 "파이프라인 관리" 탭은 여전히 존재하며 동일 기능 동작.

## 회귀 테스트 계획 (evidence/regression/notes.md)
1. "문서 업로드" 버튼은 그대로 동작 (파인만 업로드 API 호출).
2. "기능개선 제안" 버튼 정상.
3. 채팅 마이크/스트리밍 정상.
4. 파인만 모드 → 파이프라인 관리 탭 내부 UI 그대로.
