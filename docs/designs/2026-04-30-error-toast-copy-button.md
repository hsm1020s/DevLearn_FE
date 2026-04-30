# 설계: 2026-04-30-error-toast-copy-button

**생성:** 2026-04-30 21:08
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-30-error-toast-copy-button
**브랜치:** task/2026-04-30-error-toast-copy-button

## 목표
에러 토스트에 복사 버튼을 추가해, 사용자가 한 번 클릭으로 토스트 내용(제목/본문/에러코드)을 클립보드에 복사 → 곧바로 다른 AI 채팅에 붙여넣어 에러 진단을 의뢰할 수 있게 한다. 성공/정보 토스트에는 불필요하므로 에러 토스트에만 노출.

## 변경 범위
- `src/components/common/Toast.jsx`
  - ToastItem에 복사 버튼 추가 — 닫기(X) 버튼 왼쪽에 배치
  - error 타입에서만 노출 (success/info는 미노출)
  - 클릭 시 `navigator.clipboard.writeText(...)`로 복사
  - 복사 직후 짧은 시각 피드백 — 아이콘이 ✓로 1.5초간 바뀜 (별도 패키지 추가 없음)
  - 복사 텍스트 포맷:
    ```
    [{title}]
    {body}
    errorCode: {code}
    ```
    - title 없으면 첫 줄 생략
    - code 없으면 마지막 줄 생략
    - 단일 본문만 있으면 한 줄만 복사

## 변경하지 않는 것
- 토스트 자동 제거 시간 / 색상 / 배치 — 그대로
- 메시지 데이터 모델 (`{title, body, code}` 객체 또는 문자열) — 그대로
- errorHandler / showError API — 변경 없음

## 구현 계획
1. `Toast.jsx`에 `Copy`, `Check` 아이콘 import 추가 (lucide-react 이미 사용 중)
2. ToastItem 내 로컬 state `copied` (boolean, 1.5초 후 자동 false)
3. 복사 핸들러: `buildCopyText({title, body, code})` 함수 → `navigator.clipboard.writeText`
4. 버튼 위치: 닫기(X) 왼쪽, 동일 색감(white/70%) 아이콘 14px
5. clipboard API 미지원 환경(구형 브라우저) 폴백: `document.execCommand('copy')` — 없어도 무방하나 안전하게 try/catch
6. 빌드 → dev 서버에서 의도적으로 에러 유도하여 토스트 복사 동작 확인

## 단위 테스트 계획
- 빌드 성공
- 에러 토스트에 복사 버튼 노출 (success/info 토스트에는 미노출)
- 클릭 시 클립보드에 포맷된 텍스트 복사 (title/body/code 조합 시나리오 3종)
- 클릭 직후 아이콘이 ✓ 로 바뀌고 1.5초 후 원래대로 복귀
- 닫기(X) 버튼 동작 변동 없음
- 토스트 자동 제거 5초 그대로

## 회귀 테스트 계획
- 정상 채팅/공부/업무학습 모드에서 토스트 미발생
- 성공 토스트(`showSuccess`) 정상 노출, 복사 버튼 없음
- 클라이언트 검증 토스트(`showError(null, '...')`) 정상 노출, 복사 버튼 노출(에러 타입)
- 다중 토스트 동시 노출 정상
