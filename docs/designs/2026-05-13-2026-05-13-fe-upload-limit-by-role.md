# 설계: 2026-05-13-2026-05-13-fe-upload-limit-by-role

**생성:** 2026-05-13 11:12
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-2026-05-13-fe-upload-limit-by-role
**브랜치:** task/2026-05-13-2026-05-13-fe-upload-limit-by-role

## 목표
PDF 업로드 모달에서 사용자 role(USER/ADMIN)에 따라 클라이언트 측 용량 제한과 안내 문구를 백엔드와 일치시킨다.

- ADMIN: 1GB
- USER: 50MB

현재 FE는 일괄 1GB로 안내·검증하므로, 일반 사용자가 50MB~1GB 파일을 골랐을 때 FE 통과 후 BE에서 거부되어 혼란이 생긴다.
BE 기준(`FeynmanService.java` ADMIN_MAX_BYTES=1GB, USER_MAX_BYTES=50MB)과 동기화한다.

## 변경 범위
- `src/components/common/DocumentUploadModal.jsx`
  - 상수 `MAX_FILE_SIZE` (단일 1GB) → role 기반 계산으로 변경
  - `useAuthStore`에서 `user.role`을 구독해 `isAdmin` 판단
  - 업로드 검증(`handleFiles`)에서 role별 한도로 분기
  - 드롭존 라벨(`label`)에 role별 한도 표기
  - 안내 토스트 메시지에 role별 한도 반영

영향 범위: 이 모달이 호출되는 사이드바 PDF 업로드 진입점만. API 호출(`feynmanApi.uploadPdf`)·BE 검증은 변경 없음.

## 구현 계획
1. 상수 분리:
   - `ADMIN_MAX_BYTES = 1024 ** 3` (1GB)
   - `USER_MAX_BYTES = 50 * 1024 * 1024` (50MB)
2. 컴포넌트 내부에서 `useAuthStore((s) => s.user?.role)` 구독 → `isAdmin = role === 'ADMIN'`
3. `maxBytes = isAdmin ? ADMIN_MAX_BYTES : USER_MAX_BYTES`, `limitLabel = isAdmin ? '1GB' : '50MB'`
4. `handleFiles` 내 크기 비교 및 토스트 메시지에 `limitLabel` 사용
5. `FileDropZone label`을 ``PDF 파일을 드래그하거나 클릭하여 업로드 (최대 ${limitLabel})`` 로 변경
6. 상단 주석/병렬 미사용 주석의 "1GB 한도" 표현도 일반화

## 단위 테스트 계획
- 로그인 상태에서 일반 USER로 60MB 가상 PDF를 드롭 → "50MB 이하 파일만…" 토스트, 업로드 시도 안 함
- ADMIN으로 60MB 드롭 → 정상 업로드 시도
- 드롭존 라벨이 role에 따라 "(최대 50MB)" / "(최대 1GB)"로 다르게 보이는지 UI 확인
- 비PDF 파일은 기존대로 거부되는지 회귀

(실제 60MB PDF 만들기 부담 → File 객체 size를 임의 조작한 수동 검증 또는 코드 리뷰로 대체)

## 회귀 테스트 계획
- 사이드바 일반 채팅 흐름(메시지 전송/응답) 1회
- 마인드맵 또는 파인만 파이프라인 관리 탭 진입 확인
- 결과는 `evidence/regression/notes.md` 에 기록
