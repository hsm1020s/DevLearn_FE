# 설계: 2026-05-13-fe-pipeline-tab-upload-limit

**생성:** 2026-05-13 11:32
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-fe-pipeline-tab-upload-limit
**브랜치:** task/2026-05-13-fe-pipeline-tab-upload-limit

## 목표
파인만 · 파이프라인 관리 탭(`FeynmanPipelineTab.jsx`)의 PDF 업로드에도 role 기반 한도(USER 50MB / ADMIN 1GB)를 적용해 BE 기준과 동기화한다.

직전 작업(`2026-05-13-fe-upload-limit-by-role`)은 사이드바 `DocumentUploadModal`만 손봤고, 파이프라인 탭에는 누락되어 있었다. 현 상태:
- `handleUpload`가 PDF 확장자만 검사하고 곧장 `uploadPdf()` 호출 → BE에서 50MB 초과 거부 시 일반 토스트 "업로드 실패"만 표시되어 원인을 알 수 없음.

## 변경 범위
`src/components/feynman/FeynmanPipelineTab.jsx`
- `useAuthStore`에서 role 구독, role별 `maxBytes` / `limitLabel` 계산
- `handleUpload` 내 PDF 필터 직후 크기 필터 추가 (초과 파일은 토스트로 안내하고 건너뜀)
- 업로드 버튼 라벨에 "(최대 50MB)" / "(최대 1GB)" 노출

영향 범위: 이 탭의 업로드 흐름. API/병합 로직 변경 없음.

## 구현 계획
1. import 추가: `useMemo`, `useAuthStore`
2. 상수 추가: `ADMIN_MAX_BYTES`, `USER_MAX_BYTES` (DocumentUploadModal과 동일 값. 두 컴포넌트가 독립적으로 사용하므로 작은 중복 허용)
3. 컴포넌트 본문에서 `role` 구독, `useMemo`로 `{ maxBytes, limitLabel }` 계산
4. `handleUpload`:
   - PDF 필터 통과 후 `[ok, oversized]`로 분리
   - oversized가 있으면 안내 토스트 ("X개 파일이 {limitLabel} 초과로 제외됨, 파일명…")
   - 남은 파일만 업로드 루프 진행 / 모두 초과인 경우 조기 종료
5. 업로드 버튼 라벨에 한도 정보 노출 — `PDF 업로드 (최대 ${limitLabel})`

## 단위 테스트 계획
- USER role 상태에서 60MB 모의 File로 `handleUpload` 호출 → 토스트 안내 / `uploadPdf` 호출 없음 (코드 리뷰로 확인)
- ADMIN role 상태에서 60MB → 업로드 진행
- 정상 + 초과 혼합 → 정상만 업로드되고 초과는 안내

dev 서버 transform 통과로 import/문법 검증.

## 회귀 테스트 계획
- 직전 변경(`DocumentUploadModal`) 진입점 정상 동작 유지
- 다른 페이지(채팅/마인드맵/Admin) transform 통과
- `feynmanApi.uploadPdf` 호출 시그니처 변경 없음
