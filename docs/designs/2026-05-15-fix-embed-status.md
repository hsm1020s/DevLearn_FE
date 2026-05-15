# 설계: 2026-05-15-fix-embed-status

**생성:** 2026-05-15 11:49
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-15-fix-embed-status
**브랜치:** task/2026-05-15-fix-embed-status

## 목표
"임베딩 실행"(embed-only) 도중 파이프라인 UI 뱃지가 **"임베딩 생성 중"** 으로 정상 표시되도록 하고, 3초 폴링이 작동해 완료 시 자동으로 **"학습 가능"** 으로 전환되게 한다.

### 현재 증상
- `POST /api/feynman/pipeline/{docId}/embed` 호출 후 `embedder.py` 가 `rag_docs.status` 컬럼에 literal `'processing'` 을 박는다.
- `'processing'` 은 FE의 `STATUS_MAP` 에 정의돼 있지 않아 fallback `uploaded` ("업로드 완료") 라벨로 표시된다.
- `isProcessing()` 체크 배열에도 빠져 있어 진행 중 폴링이 멈춘다.
- 결과적으로 사용자는 "임베딩 버튼을 눌렀는데 아무 일도 안 일어나는 것처럼" 보인다.

### 근본 원인
백엔드 파이프라인의 status enum은 `uploaded → extracting → grouping → embedding → completed/error` 인데, `embedder.py` 만 단독 실행 시작 시점에 이 enum 외 값(`'processing'`)을 쓰고 있다. `'processing'` 은 본래 MyBatis 필터 키워드(`extracting/grouping/embedding` 묶음)이지 status 컬럼 값이 아니다.

## 변경 범위

### 주 변경 (BE)
- `/Users/moon/IdeaProjects/DevLearn_BE/scripts/feynman_pipeline/embedder.py:196-197`
  - INSERT 시 `status='processing'` → `status='embedding'`
  - ON CONFLICT UPDATE 시 `SET status='processing'` → `SET status='embedding'`

### 영향 검증 대상
- `FeynmanMapper.xml` 의 status 필터: `processing` 키워드는 `IN ('extracting','grouping','embedding')` 매칭이므로, `'embedding'` 으로 바뀌어도 파이프라인 UI의 "진행 중" 필터에 그대로 잡힘. 변경 불필요.
- `FeynmanService` 의 다른 status 전이 로직: `embedder.py` 가 status를 'embedding' 으로 두면, Java 측 `finalize` 단계가 'completed' 로 정상 덮어쓰는지 확인 (현재 SQL전문가가이드_ocr 케이스에서 최종 'completed' 도달 확인됨).

### FE는 변경 없음
- FE `STATUS_MAP` / `isProcessing()` 은 이미 `'embedding'` 을 올바르게 처리하고 있다. BE만 enum을 맞추면 자동으로 정상 동작.
- 단, 향후 BE에서 다시 비표준 값이 들어왔을 때 대비한 방어 추가는 본 태스크 범위 밖. (별도 follow-up 후보)

## 구현 계획

1. `embedder.py:196-197` 두 군데의 literal 교체 (`'processing'` → `'embedding'`).
2. BE 서버 재시작 (Spring Boot 가 Python 스크립트를 ProcessBuilder 로 호출하므로 Python 코드 변경은 즉시 반영되지만, 진행 중 임베딩이 있으면 끝난 뒤 검증 필요).
3. 새로운 PDF 1건을 업로드하거나 기존 chunks 비어있는 문서에 대해 embed-only 실행, status 전이 관찰.

## 단위 테스트 계획

- **시나리오 A**: chunks=0 상태의 문서에 대해 `POST /api/feynman/pipeline/{docId}/embed` 호출 직후 DB 확인 → `status='embedding'` 임을 확인.
- **시나리오 B**: 같은 시점 FE 파이프라인 UI 새로고침 → 뱃지가 **"임베딩 생성 중"** 으로 표시되는지 확인.
- **시나리오 C**: 3초 폴링이 자동 작동하여 완료 시 뱃지가 **"학습 가능"** 으로 전환되는지 확인 (수동 새로고침 없이).
- **시나리오 D**: 완료 후 파인만 학습 / 마인드맵 자동생성 화면에 해당 문서가 노출되는지 확인.

결과는 `.claude/state/evidence/2026-05-15-fix-embed-status/unit/notes.md` 에 기록.

## 회귀 테스트 계획

- 풀 파이프라인(`POST /api/feynman/pipeline/{docId}`, skipEmbed=false) 실행: extracting → grouping → embedding → completed 전이가 영향 받지 않음을 확인.
- 채팅 기능: 기존 completed 문서로 RAG 검색이 정상 동작하는지.
- 마인드맵 자동생성: 다른 completed 문서로 마인드맵 생성 트리거가 정상인지.

결과는 `.claude/state/evidence/2026-05-15-fix-embed-status/regression/notes.md` 에 기록.
