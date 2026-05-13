# 설계: 2026-05-13-remove-doc-upload

**생성:** 2026-05-13 20:19
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-remove-doc-upload
**브랜치:** task/2026-05-13-remove-doc-upload

## 목표
사이드바 하단에 있는 "문서 업로드" 버튼/모달이 "문서 파이프라인" 기능과 겹쳐서 사용되지 않으므로 제거한다.
- "문서 업로드"는 PDF 업로드만 가능하고 세션 한정 로컬 목록만 보여준다.
- "문서 파이프라인"이 업로드 + 파이프라인 실행 + 상태 관리까지 모두 담당한다.
- 따라서 사이드바에는 "문서 파이프라인" 버튼만 남긴다.

## 변경 범위
- 삭제 파일
  - `src/components/common/DocumentUploadModal.jsx`
- 수정 파일
  - `src/components/layout/Sidebar.jsx`
    - `DocumentUploadModal` import 제거
    - `lucide-react` import 에서 `FileUp` 제거 (다른 곳에서 안 쓰면)
    - `showDocUpload` 상태 제거
    - "문서 업로드" 버튼 렌더링 제거 (Sidebar.jsx 720-728)
    - 버튼 ref 제거 (139 부근)
    - `<DocumentUploadModal />` 마운트 제거 (812 부근)
- API 함수 `feynmanApi.uploadPdf`는 `FeynmanPipelineTab`이 내부에서 호출하므로 **유지**.

## 구현 계획
1. `Sidebar.jsx` 에서 문서 업로드 관련 코드를 모두 제거 (import / state / ref / 버튼 / 모달 마운트).
2. `DocumentUploadModal.jsx` 파일 삭제.
3. `FileUp` 아이콘이 Sidebar 안에서 더 이상 쓰이지 않으면 import 도 제거.
4. dev 서버에서 첫 화면을 열어 사이드바 하단에 "문서 파이프라인" 버튼만 남았는지 확인.

## 단위 테스트 계획
- 첫 화면(MainPage) 진입 시 사이드바 하단에 "문서 파이프라인" 버튼만 보이는지.
- "문서 파이프라인" 버튼 클릭 시 `FeynmanPipelineModal` 이 정상적으로 열리는지.
- 콘솔 에러/경고 없는지 (특히 `DocumentUploadModal` 참조 누락 없는지).
- 빌드/타입 체크 통과 (`npm run build` 또는 lint).

## 회귀 테스트 계획
- 채팅 기능(기본 모드) — 메시지 전송/응답이 평소처럼 동작하는지.
- 사이드바의 다른 버튼/메뉴 (모드 전환, 설정 등)가 정상 동작하는지.
- 문서 파이프라인 모달의 업로드/실행/삭제 흐름이 정상인지 (실제 PDF 한 개 업로드해 보기).

