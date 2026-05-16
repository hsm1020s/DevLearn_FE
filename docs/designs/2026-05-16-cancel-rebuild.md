# 설계: 2026-05-16-cancel-rebuild

**생성:** 2026-05-16 16:55
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-16-cancel-rebuild
**브랜치:** task/2026-05-16-cancel-rebuild

## 목표
파인만 [지식 재구축] 진행 중 사용자가 **즉시 취소**할 수 있게 한다.
- FE 진행 인디케이터에 X 버튼 → 클릭 시 표시 즉시 제거
- BE 측 진행 중인 합성(질문) 도 cancel flag 로 다음 노드부터 중단 → 토큰 낭비 방지

## 현재 문제
- 빌트인 취소 기능 없음 (`POST /rebuild-cancel` 엔드포인트 부재)
- BE 재시작 시 async 작업이 죽지만 FE localStorage 의 진행 엔트리는 30분간 유지 → "면접질문 합성중" 좀비 표시
- 사용자가 [지식 재구축] 다시 누르면 wipe 로 정리되지만, 그 사이 진행 중 LLM 호출은 끝까지 토큰 소모

## 변경 범위

### BE (DevLearn_BE — master 직접 작업, 하네스 밖)
- `FeynmanController.cancelRebuild(docId)` — `POST /api/feynman/{docId}/rebuild-cancel`
- `FeynmanService.cancelRebuild(userId, docId)` — `assertDocOwner` + cancelled flag set
- `RebuildCancelRegistry` (신규) — `ConcurrentHashMap<docId, AtomicBoolean>` 으로 cancel flag 관리
- `QuestionSynthesisService.rebuildChapterFromMindmapAsync` 노드 루프 매 iter 에 cancelled 체크 → break
- (선택) `MindmapSynthesisService` — 챕터 루프 진입 직전 cancelled 체크. 단 챕터 1개의 마인드맵은 이미 단일 LLM 호출이라 중간 취소 어렵고 그대로 두는 게 단순함.

### FE (워크트리 작업)
- `src/services/feynmanApi.js` — `cancelRebuild(docId)` 함수 추가
- `src/hooks/useRebuildProgress.js` — `cancel(docId)` 메서드 추가 → BE 호출 + localStorage entry 즉시 삭제 (BE 실패해도 표시는 사라지게)
- `src/components/feynman/FeynmanPipelineTab.jsx` — 진행 인디케이터 행 옆에 X 버튼 추가
  - 기존 confirm 팝오버 패턴 활용 (rebuild 자체에 이미 패턴 있음)
  - "진행 중인 합성을 취소하시겠어요?" 짧은 경고

## 구현 계획

### 1단계 — BE
1. `RebuildCancelRegistry` 빈 작성 — `markCancelled(docId)`, `isCancelled(docId)`, `clear(docId)`
2. `FeynmanService.rebuildKnowledge` 시작 시점에 `clear(docId)` (이전 flag 잔재 제거)
3. `FeynmanService.cancelRebuild` 작성 — owner 검증 + `markCancelled(docId)` + 즉시 wipe 는 안 함 (다음 rebuild 가 wipe)
4. `FeynmanController` 엔드포인트 추가 (`@PostMapping("/{docId}/rebuild-cancel")`)
5. `QuestionSynthesisService.rebuildChapterFromMindmapAsync` 의 노드 루프 매 iter 에 `cancelRegistry.isCancelled(docId)` 체크 → break + log
6. 컴파일

### 2단계 — FE
1. `feynmanApi.js` cancelRebuild API 함수
2. `useRebuildProgress.js` cancel 메서드 추가
3. 진행 인디케이터 UI 에 X 버튼 + confirm 팝오버
4. dev 서버에서 실제 동작 확인

## 단위 테스트 계획
- FE 빌드 통과 (vite build)
- 코드 트레이스: cancel 클릭 시 localStorage entry 삭제됨 + 진행 바 즉시 사라짐
- BE: cancel flag set 후 노드 루프 break 동작 검증 (수동)

## 회귀 테스트 계획
- 채팅 정상 동작 (cancel 안 한 흐름)
- rebuild 정상 완료 (cancel 없는 흐름) — 기존 코드 회귀 없는지
- cancel 후 다시 rebuild 클릭 — 정상 시작
- 다른 문서 rebuild 중 본 문서 cancel — 다른 문서 영향 없음 (docId 격리)
