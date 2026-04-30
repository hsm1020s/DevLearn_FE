# 설계: 2026-04-23-rag-source-panel

**생성:** 2026-04-23 15:15
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-rag-source-panel
**브랜치:** task/2026-04-23-rag-source-panel

## 목표
파인만(및 자격증 학습의 RAG 채팅) 답변이 어떤 문서 청크를 근거로 생성됐는지를 채팅 화면 **오른쪽 전용 패널**에서 메시지별로 확인할 수 있게 한다.

- 각 AI 답변에 쓰인 top-k 청크(문서명, 페이지, 원문 스니펫, 유사도)를 응답에 함께 내려보낸다.
- 메시지를 클릭하면 해당 메시지의 근거가 우측 패널에 표시된다.
- 탭을 닫았다 다시 열어도 출처가 보이도록 `message_sources` 테이블에 영속화한다.
- 출처는 **우측 패널에만** 노출한다. RAG 스트림 메시지의 버블 하단 인라인 `SourceCard`는 숨긴다.
- 적용 범위: `/api/feynman/stream`으로 라우팅되는 모든 RAG 채팅
  (파인만 학습 + 자격증 학습 모드의 doc 첨부 대화). 일반 채팅(`/api/chat/stream`) 제외.

### 합의된 UX 결정
1. 영속화: O
2. 표시 위치: 우측 패널만
3. 상호작용: 메시지 클릭 → 패널에 해당 답변의 출처 로드 (②안)
4. 모바일: 후순위, 이번 태스크 제외
5. 스코프: RAG가 들어가는 `/api/feynman/stream` 전부 / 일반 채팅 제외

## 변경 범위

### Backend (`/Users/moon/IdeaProjects/DevLearn_BE`)
- `chat/dto/StreamEvent.java` — `done` 이벤트에 `sources: List<SourceRef>` 필드 추가
- `feynman/dto/SourceRef.java` — 신규 DTO (chunkId, docId, docName, page, snippet, similarity, rank)
- `feynman/service/FeynmanService.java:streamChat()` — 검색한 청크를 보관 → done 이벤트에 실음 + 저장
- `feynman/mapper/FeynmanMapper.java` + `mapper/feynman/FeynmanMapper.xml`
  - `findSimilarChunks` SELECT에 `id` 컬럼 추가 (현재 page/content/similarity만)
  - `insertMessageSources(messageId, List<SourceRow>)` 신규
- 신규 테이블 마이그레이션 `message_sources` (`migration/*.sql` 또는 schema.sql에 추가)
- `chat/mapper/` 쪽 메시지 로드 경로: 메시지 히스토리를 내려보낼 때 각 메시지의 출처를 함께 조인해 반환
  (파인만 전용 경로인지 chat 공용 경로인지 조사 후 결정)

### Frontend (`/Users/moon/DevLearn_FE`)
- `src/components/study/StudyChatTab.jsx` — 레이아웃을 `flex-row`로 바꿔 우측 패널 영역 확보
- `src/components/feynman/FeynmanSourcePanel.jsx` — 신규 우측 패널 (선택된 메시지의 출처 렌더)
- `src/components/chat/ChatMessage.jsx` — prop `hideInlineSources` 추가, 파인만 스트림 메시지의 `SourceCard` 인라인 렌더 억제
- `src/components/chat/ChatMessage.jsx` — 클릭 핸들러로 `onSelect(messageId)` 노출, 선택 시 하이라이트 스타일
- `src/stores/useChatStore.js` — `selectedMessageId` 상태 + 셀렉터 (기본값 null = 최신 AI 답변을 따라감)
- `src/services/feynmanApi.js` — 이미 `sources` 파싱 가능. `SourceRef` 필드 추가분(chunkId, docName, snippet 등) 수용
- 타입/문서상 JSDoc 필드 업데이트

### 스키마 (신규 테이블)
```sql
CREATE TABLE message_sources (
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    chunk_id   UUID NOT NULL REFERENCES rag_chunks(id) ON DELETE CASCADE,
    rank       INT NOT NULL,
    similarity DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (message_id, chunk_id)
);
CREATE INDEX idx_message_sources_message ON message_sources(message_id);
```

### DTO 구조
```
SourceRef {
  chunkId:    UUID,
  docId:      UUID,
  docName:    String,          // rag_docs.file_name 조인
  page:       Integer,
  snippet:    String,          // content 앞 200자
  similarity: Double,          // 0~1
  rank:       Integer          // 1~5 (top-k 순위)
}
```

### SSE 프로토콜
- 기존: `{type:"token", content}` / `{type:"done", conversationId, content}`
- 확장: `{type:"done", conversationId, content, sources: SourceRef[]}` — 기존 클라이언트는 `sources` 무시하면 호환

## 구현 계획

### Step 1 — 백엔드: SSE에 출처 싣기 (세션 내 표시까지)
1. `SourceRef` DTO 생성
2. `StreamEvent` 에 `sources` 필드 + `done(convId, text, sources)` 팩토리 오버로드
3. `FeynmanMapper.findSimilarChunks` SELECT에 `id` (청크 id) + 문서명 조인 추가
4. `FeynmanService.streamChat()`에서 검색한 청크를 `List<SourceRef>`로 변환, 스트림 종료 시 done에 포함
5. 프론트에서 JSON console.log로 수신 확인 (전체 UI 건드리기 전에 전송부터 검증)

### Step 2 — 영속화 + 히스토리 복원
1. `message_sources` 테이블 DDL 추가 (마이그레이션)
2. `FeynmanMapper.insertMessageSources` 구현
3. `streamChat()`에서 AI 메시지 저장 직후 sources도 저장
4. 메시지 히스토리 로드 API가 각 메시지에 `sources`를 포함하도록 조인 쿼리 수정

### Step 3 — 프론트: 우측 패널 UI
1. `useChatStore`에 `selectedMessageId` 추가 (없으면 가장 최근 assistant 메시지)
2. `StudyChatTab`을 2-pane 레이아웃으로 변경 (RAG 세션일 때만 패널 표시)
3. `FeynmanSourcePanel` 컴포넌트 작성 — 선택된 메시지의 `sources` 렌더
4. `ChatMessage`에 `onSelect`, `isSelected`, `hideInlineSources` prop 추가
5. RAG 모드에서 인라인 `SourceCard` 숨김

### Step 4 — 폴리시 & 복원 확인
1. 카드 내 원문 전문 토글 또는 모달 (필요 시 `FeynmanResult`의 렌더 재사용)
2. 유사도 배지 컬러 분기 (≥0.85 녹 / ≥0.7 황 / 그 외 회)
3. 대화 다시 열었을 때 출처 복원 확인

## 단위 테스트 계획

**Backend**
- `FeynmanService.streamChat()`가 `done` 이벤트에 `sources`를 5개 이하로 포함하는지
- `message_sources`에 rank/similarity가 올바르게 저장되는지 (정렬 순서 = rank)
- 동일 메시지 저장 시 중복 insert가 없는지 (PK 충돌 회피)
- 히스토리 조회 시 메시지별 `sources` 배열이 올바르게 채워지는지

**Frontend**
- `/api/feynman/stream` 응답 `done.sources`가 수신되어 store에 반영되는지
- 메시지 클릭 시 `selectedMessageId`가 갱신되고 패널 내용이 바뀌는지
- 선택된 메시지가 없으면 최신 assistant 메시지의 출처가 표시되는지
- RAG 모드에서 버블 내부의 인라인 `SourceCard`가 보이지 않는지
- 대화를 닫았다 다시 열어도 출처가 복원되는지 (Step 2/4 조인 확인)

결과는 `.claude/state/evidence/2026-04-23-rag-source-panel/unit/notes.md` 에 기록.

## 회귀 테스트 계획

출처 패널이 **건드리지 않은** 주요 기능이 그대로 동작하는지 확인.

- 일반 채팅 (`/api/chat/stream`) 흐름: 레이아웃/메시지 렌더에 영향 없음
- 마인드맵 생성/편집: Study 모드 좌측 영역 레이아웃 변경이 마인드맵에 영향 없음
- 자격증 퀴즈 생성·풀이 (`generateQuizAsync` + 폴링): Study 경로 공용이라 회귀 가능성 있음 → 실제 퀴즈 1세트 끝까지 풀어보기
- 파인만 `verify()` (검증 모드): `VerifyResponse.sources`는 기존 그대로 유지되는지

결과는 `.claude/state/evidence/2026-04-23-rag-source-panel/regression/notes.md` 에 기록.
