# 설계: 2026-05-13-fe-pdf-quota-ui

**생성:** 2026-05-13 16:08
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-13-fe-pdf-quota-ui
**브랜치:** task/2026-05-13-fe-pdf-quota-ui

## 목표
USER 권한일 때 PDF 보유 슬롯 한도(3개)를 BE 가드와 함께 FE 에서도 사전 안내·차단한다.
BE `GET /api/feynman/quota` 응답을 사용해 한도 도달 시 업로드 버튼 disabled / 토스트 안내.
BE 409 QUOTA_EXCEEDED 응답은 최종 안전망(보조).

## 변경 범위 (모두 FE 리포)
1. `src/services/feynmanApi.js` — `getQuota()` 함수 신설
2. `src/components/feynman/FeynmanPipelineTab.jsx`
   - quota state + 마운트/업로드/삭제 후 refetch
   - 헤더에 `보유 PDF X/3` 표기 (ADMIN limit=null 은 "무제한")
   - 업로드 버튼 라벨에 `(used/limit)`, disabled 조건 추가
   - `handleUpload`: 잔여 슬롯만큼만 통과, 초과분은 토스트
3. `src/components/common/DocumentUploadModal.jsx`
   - 모달 open 시 quota fetch
   - 한도 도달 시 FileDropZone 영역 위에 안내 + 드롭 입력 차단
   - 업로드 성공 시 quota.used 로컬 +1 (또는 refetch)
4. `src/utils/errorHandler.js` 또는 axios 인터셉터 — 409 + `errorCode === 'QUOTA_EXCEEDED'` 토스트 메시지 일관성 확인 (기존 일반 errorMessage 처리로 충분하면 추가 코드 없음)

## 구현 계획
1. feynmanApi.js — `export async function getQuota()` (GET /api/feynman/quota)
2. FeynmanPipelineTab
   - import 추가: `getQuota`
   - state: `const [quota, setQuota] = useState(null)` (null=미로드)
   - effect: 마운트 시 1회 fetch. 업로드/삭제 성공 직후 다시 호출
   - 헤더 표기: `quota?.limit != null ? \`보유 PDF ${quota.used}/${quota.limit}\` : null`
   - 업로드 버튼: `const slotFull = quota?.limit != null && quota.used >= quota.limit;` → disabled + 라벨 변경
   - `handleUpload`: PDF/크기 필터 통과 후 `if (quota?.limit != null) { const remaining = Math.max(0, quota.limit - quota.used); ... }` 로 잔여만큼만 valid 로 두고 초과는 안내
3. DocumentUploadModal
   - 마찬가지 quota fetch + slotFull 시 FileDropZone disabled 또는 상단 안내 박스
4. errorHandler — 기존이 errorCode 별 메시지를 잘 노출하면 변경 없음. 확인 후 결정.

## 단위 테스트 계획
- USER role 상태로 dev 진입 → quota 표기 정상
- BE 에 임의로 문서 3개 보유 상태에서 업로드 버튼 disabled + 안내
- 1개 + 1개 + 1개 업로드 후 4번째 시도 시 사전 차단 토스트
- 4개 한번에 드롭 시: 3개만 시도, 1개 초과 안내
- 삭제 → 슬롯 회복
- ADMIN: 표기 "무제한" 또는 미표기, 슬롯 차단 없음
- 409 강제 응답(예: 동시 업로드 race) → 토스트 노출

dev 서버 transform 검증 + UI 상태 시각 확인.

## 회귀 테스트 계획
- 사이드바 채팅, 마인드맵 진입점 transform 통과
- 기존 PDF 업로드(크기 50MB/1GB) 동작 보존
- DocumentUploadModal 와 FeynmanPipelineTab 사이 quota 일관성 (한쪽에서 업로드 → 다른 쪽에 반영) — 모달은 닫혔다 다시 열 때 refetch 되면 OK
