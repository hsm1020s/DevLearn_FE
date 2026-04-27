# 설계: 2026-04-27-multi-pdf-upload

**생성:** 2026-04-27 12:40
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-27-multi-pdf-upload
**브랜치:** task/2026-04-27-multi-pdf-upload

## 목표
- PDF 여러 개를 한 번에 업로드할 수 있게 한다(파이프라인 자동 실행은 하지 않음 — 업로드만).
- 적용 범위: 두 곳 모두
  1. `FeynmanPipelineTab` 헤더의 "PDF 업로드" 버튼 (input file)
  2. `DocumentUploadModal` (드래그앤드롭/클릭 업로드)
- 부분 실패가 나도 나머지는 정상 처리한다(한 파일 실패가 전체를 막지 않음).
- 진행 상황을 사용자에게 명시(예: "3/5 업로드 중...").
- BE는 변경하지 않는다 — 단일 파일 엔드포인트(`POST /api/feynman/upload`)를 N번 순차 호출.

## 변경 범위
### 변경 파일
- `src/components/feynman/FeynmanPipelineTab.jsx`
  - `<input>`에 `multiple` 추가
  - `handleUpload`를 N개 파일 **순차** 처리로 확장
  - 업로드 중 라벨을 "업로드 중 (i/N)..."으로 표기
  - 결과 토스트: 성공 N건/실패 M건 요약, 실패 파일명 표시
- `src/components/common/DocumentUploadModal.jsx`
  - 기존 `Promise.allSettled`(병렬)를 **순차** 업로드로 변경 (큰 PDF 다중 시 서버 부담 회피)
  - 모달 내부 안내 텍스트에 "i/N" 진행도 추가(아이템 카드에는 이미 status 표시됨)

### 비변경
- BE (단일 파일 엔드포인트 그대로 사용)
- `src/services/feynmanApi.js` `uploadPdf(file)` 시그니처 유지 — 호출자에서 N번 await
- `src/components/common/FileDropZone.jsx` (이미 `multiple` 기본 + `File[]` 콜백 지원)

### 영향 범위
- 파인만 학습 모드의 파이프라인 관리 탭
- 사이드바/공용 문서 업로드 모달(존재하는 호출 지점 모두)

## 구현 계획
1. **FileDropZone 확인** — 다중 파일 허용 옵션이 이미 있는지 점검, 없으면 prop 추가.
2. **`uploadPdf` 헬퍼는 그대로** — 호출 측에서 `for...of`로 순차 await 처리(서버 부하/타임아웃 회피).
3. **`FeynmanPipelineTab.handleUpload`**
   - `e.target.files`를 배열화 → PDF 확장자 검증으로 비PDF 제외
   - 모든 파일이 비PDF면 에러 토스트 후 종료
   - `[i+1, total]` 진행도 state 추가 → 헤더 버튼 라벨에 반영
   - 각 파일 결과를 `{ name, ok, err }`로 누적
   - 끝나면: 전부 성공 → `showSuccess('N개 PDF 업로드 완료')`, 일부 실패 → `showError`로 실패 파일명 나열
   - `loadDocs()`는 마지막에 1회만 호출
4. **`DocumentUploadModal`** — 같은 패턴 적용. FileDropZone 콜백을 `(files: File[])`로 처리.
5. **테스트**
   - 0개 / 1개 / N개 / 비PDF 섞임 / 일부 실패 케이스
6. **회귀**: 업로드 후 파이프라인 수동 실행이 여전히 정상인지 1건 확인.

## 단위 테스트 계획
- [ ] `FeynmanPipelineTab`: PDF 1개 업로드 → 성공 토스트 + 목록 반영
- [ ] `FeynmanPipelineTab`: PDF 3개 업로드 → 진행도 "1/3 → 2/3 → 3/3" 노출, 완료 후 "3개 PDF 업로드 완료"
- [ ] `FeynmanPipelineTab`: PDF + .txt 섞어 선택 → .txt만 거부, PDF만 업로드
- [ ] `DocumentUploadModal`: 드래그앤드롭으로 2개 PDF → 둘 다 업로드, 진행도 표시
- [ ] 업로드 중 버튼/드롭존 disabled 상태 확인
- 결과는 `.claude/state/evidence/2026-04-27-multi-pdf-upload/unit/notes.md` 에 기록

## 회귀 테스트 계획
- [ ] 마인드맵 패널: 기존 문서 선택 → 챕터 목록 정상 표시(파이프라인 완료된 문서)
- [ ] 채팅(파인만 모드 또는 일반): 한 라운드 메시지 송수신 정상
- [ ] 사이드바 네비게이션: 파인만 ↔ 일반 채팅 ↔ 마인드맵 전환 시 화면 깨짐 없음
- 결과는 `.claude/state/evidence/2026-04-27-multi-pdf-upload/regression/notes.md` 에 기록
