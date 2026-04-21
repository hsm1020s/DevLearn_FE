# 설계: 2026-04-21-sidebar-doc-upload

**생성:** 2026-04-21 18:50
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-21-sidebar-doc-upload
**브랜치:** task/2026-04-21-sidebar-doc-upload

## 목표
사이드바 하단의 "기능개선 제안" 버튼 바로 위에 **문서 업로드(RAG용 PDF)** 진입점을 추가한다.
버튼을 누르면 앵커 팝오버 모달이 열리고, PDF 드래그앤드롭 + 업로드 진행률/상태 표시 + 업로드된 문서 목록 + 삭제 기능을 제공한다.
과거 `b1e34612` 커밋에 있던 RAG 문서 업로드 UX를 현재 코드 스타일(`SuggestionModal` 패턴 / `FileDropZone` / `useDocStore` / `studyApi.uploadPdf`)에 맞춰 재구성한다.

## 변경 범위
| 파일 | 변경 |
|------|------|
| `src/components/common/DocumentUploadModal.jsx` | **신규** — `SuggestionModal` 패턴 기반 업로드 모달 |
| `src/components/layout/Sidebar.jsx` | 버튼·ref·state·모달 렌더 추가 (기존 "기능개선 제안" 버튼 바로 위) |

활용하는 기존 자산 (수정하지 않음):
- `src/components/common/Modal.jsx` — anchorRef 팝오버 위치 계산
- `src/components/common/FileDropZone.jsx` — 드래그앤드롭 UI (`accept='.pdf'`, `multiple` 지원)
- `src/components/common/Button.jsx`, `src/components/common/Toast.jsx`
- `src/stores/useDocStore.js` — `addDoc/updateDocStatus/updateDocInfo/removeDoc`
- `src/services/studyApi.js` — `uploadPdf(file)` (`/study/upload`, Mock 지원)

## 구현 계획
1. **`DocumentUploadModal.jsx` 작성**
   - Props: `isOpen`, `onClose`, `anchorRef`
   - 업로드 처리 흐름:
     1. `FileDropZone`에서 `File[]` 수신
     2. PDF 필터링 + 용량 초과(예: 50MB) 거르기 → 거른 사유는 Toast로 안내
     3. 각 파일마다 `addDoc({ fileName, size })` → 즉시 목록에 `status: 'processing'` 항목 추가
     4. `uploadPdf(file)` 호출 → 성공 시 `updateDocStatus(id, 'completed', 100)` + `updateDocInfo(id, { pages, chunks, docId })`, 실패 시 `updateDocStatus(id, 'error', 0)` + Toast
   - 업로드된 문서 목록 UI
     - `useDocStore((s) => s.docs)` 구독
     - 각 항목: 파일명, 상태 뱃지(처리 중/완료/실패), 페이지/청크 정보(완료 시), 삭제 버튼(`removeDoc`)
     - 비어있으면 "업로드된 문서가 없습니다" 빈 상태 안내
   - 닫기 버튼/취소 버튼 (업로드 중에도 모달은 닫을 수 있음 — 업로드는 백그라운드 계속, 완료 시 Toast)
2. **`Sidebar.jsx` 수정**
   - `FileText` 아이콘 import (또는 `FileUp`) + `DocumentUploadModal` import
   - `showDocUpload` state + `docUploadBtnRef` 추가
   - 544번 라인의 `기능개선 제안` 버튼 바로 앞에 동일 스타일(`flex items-center gap-2 … hover:bg-bg-secondary`) 버튼 삽입
   - 614번 라인 근처 `SuggestionModal` 렌더 옆에 `DocumentUploadModal` 렌더 추가

## 단위 테스트 계획
- **렌더링**: 사이드바 하단 "문서 업로드" 버튼이 "기능개선 제안" 버튼 위에 표시되고 접힌 상태(collapsed)에서는 숨겨지는지 확인
- **모달 열림/닫힘**: 버튼 클릭 시 앵커 팝오버 모드로 모달이 열리고 닫기 동작이 정상인지
- **업로드 흐름(Mock 경로)**: `VITE_MOCK_API` Mock 모드에서 PDF 드롭 시 `docs` 목록에 항목이 추가되고 상태가 `processing` → `completed`로 전이되는지
- **비-PDF 차단**: `.txt` 등 다른 확장자는 거르고 Toast가 뜨는지
- **빌드 검증**: `npm run build` 성공

## 회귀 테스트 계획
다음 기능이 기존과 동일하게 동작하는지 수동 확인 (결과는 `evidence/regression/notes.md`):
- **채팅**: 메시지 전송/수신, 대화 생성·전환·삭제
- **마인드맵**: 탭 전환, 노드 CRUD, TTS 재생 (직전 태스크 회귀 확인)
- **"기능개선 제안" 버튼**: 위치(문서 업로드 아래) 이동 + 동작 정상
- **로그인/로그아웃**: 로그인 상태에서 사용자 메뉴, 비로그인 상태에서 로그인 버튼 표시
- **사이드바 접기/펼치기**: collapsed 토글

영향 범위 분석:
- `useDocStore`는 이미 다른 화면에서 사용 중일 수 있으므로 스토어 **스키마 변경 없음** — 기존 액션만 호출
- `studyApi.uploadPdf`는 기존 호출부와 공유되므로 시그니처·반환 형태 변경 금지
- CSS 변수/전역 스타일 수정 없음
