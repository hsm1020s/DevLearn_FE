# 설계: 2026-04-23-chapter-question-prebuild

**생성:** 2026-04-23 16:21
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-chapter-question-prebuild
**브랜치:** task/2026-04-23-chapter-question-prebuild

## 목표
파인만 학습을 "LLM 이 매번 즉석에서 질문 생성" 에서 **"챕터 전체를 읽고 미리 만들어둔 질문을 서빙"** 하는 구조로 전환한다. 질문과 답변의 근거가 명확해지고, 첫 질문이 즉시 나오며, 이후 에이전트 계층의 기초 데이터(answer_attempts)가 쌓이기 시작한다.

### 합의된 결정
1. 챕터당 질문 수: **10개** (설정 가능하지만 기본 10)
2. 서빙 전략: **랜덤/적응형** — 미답변 우선(랜덤), 모두 답한 뒤엔 저점수 우선
3. 폴백: 사전 질문이 없거나 생성 중이면 **현재 온디맨드 방식 그대로**
4. 전체 스택 로컬 Ollama (`gpt-oss-20b`) 로 돌려도 무방 (사용자 64GB RAM)

### 비-목표 (이번 태스크 범위 밖)
- Question QA / Coverage / Path Planner 에이전트 — 후속 태스크
- 진행도 대시보드 UI — 후속 태스크
- A/B 인프라, 재질문 루프 — 후속 태스크

## 변경 범위

### Backend — 신규

**DDL (schema.sql 추가분)**
```sql
CREATE TABLE IF NOT EXISTS chapter_questions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id           UUID NOT NULL,
    chapter          VARCHAR(200) NOT NULL,
    seq              INT NOT NULL,
    concept          VARCHAR(500),
    question         TEXT NOT NULL,
    ideal_answer     TEXT,
    linked_chunk_ids UUID[] NOT NULL,
    difficulty       VARCHAR(10) DEFAULT 'mid',
    status           VARCHAR(20) DEFAULT 'active',
    generated_at     TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cq_doc_chapter ON chapter_questions(doc_id, chapter);

CREATE TABLE IF NOT EXISTS answer_attempts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL,
    question_id       UUID NOT NULL,
    message_id        UUID,
    user_answer       TEXT NOT NULL,
    score             INT,
    missing_concepts  TEXT[],
    feedback          TEXT,
    answered_at       TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aa_user_time ON answer_attempts(user_id, answered_at DESC);
CREATE INDEX IF NOT EXISTS idx_aa_user_question ON answer_attempts(user_id, question_id);
```

**클래스 신설**
- `feynman/service/QuestionSynthesisService.java` — 2-pass 로 챕터 전체 → 10개 질문 생성
  - Pass 1: 챕터의 모든 청크를 LLM 에 넘겨 "핵심 개념 10개 + 각 개념의 근거 청크 seq" 추출
  - Pass 2: 개념 1개당 LLM 호출 1회 → `{question, ideal_answer, difficulty}` 반환
  - 결과를 chapter_questions 에 bulk insert
- `feynman/service/AnswerGraderService.java` — 사용자 답변 채점
  - 입력: user_answer + question.linked_chunk_ids → chunks + ideal_answer
  - 프롬프트: "이 모범답안과 원본 청크를 기준으로 학생 답변을 0-100 점으로 채점하고, 누락 개념을 배열로 뽑아라"
  - 결과를 answer_attempts 에 저장
- `feynman/mapper/ChapterQuestionMapper.java` + XML
  - `countByDocAndChapter`, `insertMany`, `findUnansweredByUser`, `findLowestScoredByUser`
- `feynman/mapper/AnswerAttemptMapper.java` + XML — `insert`, `findByUserQuestion`
- `feynman/dto/ChapterQuestionEntity.java`, `AnswerAttemptEntity.java`

**수정**
- `feynman/service/FeynmanService.java`
  - `runPipelineAsync` 끝(`exitCode == 0`)에 **챕터별 질문 합성 비동기 호출** 추가 — 각 챕터에 대해 `QuestionSynthesisService.synthesizeAsync`
  - `streamChat` 의 대기 플로우 수정:
    - 최초 진입(message 비어있음): 사전 질문이 있으면 랜덤/적응형으로 1개 뽑아 SSE 로 스트리밍 (LLM 호출 없음)
    - 사용자 답변 도착: 직전 assistant 메시지가 pre-gen 질문이면 → `AnswerGraderService` 로 채점 + 피드백 생성 + 다음 질문 이어붙임
    - 사전 질문이 0개인 챕터는 기존 플로우 유지 (폴백)
  - SSE 프로토콜: 질문 서빙 시에도 `token` → `done` 구조 유지. done 이벤트 sources 는 질문의 linked_chunks 로 채움 → 기존 UI 그대로 동작.
- `chat/mapper/MessageEntity` + `MessageMapper.xml`: `question_id` 컬럼 추가 (nullable). 저장된 assistant 메시지가 어느 pre-gen 질문이었는지 추적 → 답변 도착 시 grader 가 참조.
- `schema.sql` messages 테이블 DDL 에 `question_id UUID` 추가 + live DB 에 `ALTER TABLE` 도 수동 실행 필요 (작업 중 수행)

**백엔드 미변경**
- `EmbeddingClient`, `LlmClient`, RAG 검색 로직 자체
- Auth/Conversation 전반

### Frontend — 최소 변경
- UI 구조 변경 없음 (채팅 흐름 동일 — 질문/답변/피드백이 SSE 로 내려옴)
- (선택) `StudyChatTab` 상단 또는 `StudyStyleChips` 옆에 "진행: 3/10 답변 완료" 같은 배지 → **후속 태스크로 미룸** (MVP 에서 데이터만 쌓으면 됨)

### 미변경
- 기존 /api/feynman/stream SSE 엔드포인트 시그니처 유지 (내부 로직만 분기)
- verify() 엔드포인트 (별도 경로, 영향 없음)
- 일반 채팅 / 자격증 퀴즈 / 마인드맵

## 구현 계획

### Step 1 — DDL + 엔티티 + 매퍼
1. schema.sql 에 chapter_questions / answer_attempts 추가, messages.question_id 추가
2. 라이브 DB 에 동일 DDL 수동 적용 (`psql ALTER TABLE messages ADD COLUMN question_id UUID`)
3. ChapterQuestionEntity / AnswerAttemptEntity + Mapper (인터페이스 + XML)

### Step 2 — QuestionSynthesisService
1. Pass 1 프롬프트: 챕터 청크 전체(큰 경우 seq 순 concat → 토큰 제한 내로 트림) → JSON `{concepts: [{name, chunk_seqs}]}` 반환 강제
2. Pass 2 프롬프트: 개념별로 "이 청크들을 근거로 파인만 검증 질문 + 모범답안 + easy/mid/hard" JSON 반환 강제
3. JSON 파싱 실패 케이스: 재시도 1회, 그래도 실패면 해당 개념 skip 후 로그
4. 10개 미만이면 있는 만큼만 저장 (0개 챕터는 폴백 모드로 떨어짐)
5. `@Async` 로 실행 — `runPipelineAsync` 뒤에서 챕터별 fork
6. 동일 (doc_id, chapter) 에 기존 레코드 있으면 skip (idempotent 재실행)

### Step 3 — streamChat 분기 + AnswerGrader
1. `streamChat` 에 pre-gen 질문 체크 로직 추가
   - 빈 메시지 진입 + 사전 질문 O → `pickNextQuestion(userId, docId, chapter)` → 질문 텍스트를 SSE token/done 으로 스트리밍, 저장 시 `question_id` 세팅
   - 사용자 답변 + 직전 assistant 메시지의 question_id O → Grader 호출 → 피드백을 SSE 로, 이어서 다음 질문 텍스트도 연결해서 전송
   - 그 외는 기존 RAG+LLM 플로우
2. `pickNextQuestion`: `findUnansweredByUser` 에서 랜덤 1개 → 없으면 `findLowestScoredByUser` 에서 랜덤 1개 → 그래도 없으면 null (모두 마스터)
3. AnswerGraderService: linked_chunks 조회 → 프롬프트 구성 → LLM 호출 → JSON 파싱 → answer_attempts 저장 → 피드백 텍스트 반환

### Step 4 — messages.question_id 연결
1. saveMessage(assistant, content) 호출을 question_id 버전으로 확장
2. 사용자 답변 도착 시 직전 assistant 메시지의 question_id 를 MessageMapper 로 역조회

### Step 5 — 폴백 + 스모크
1. 사전 질문 없는 문서/챕터에서 기존 플로우 그대로 동작하는지 스모크
2. 사전 질문 있는 챕터에서 10개가 정확히 순환 서빙되는지 (단위 노트)

## 단위 테스트 계획
- Pass 1: 샘플 청크 묶음을 넣었을 때 개념 10개(±) + chunk_seqs 가 유효 범위에 있는지
- Pass 2: 개념 1개 → JSON 에 question/ideal_answer/difficulty 3필드가 모두 있는지, difficulty 가 easy/mid/hard 중 하나인지
- `chapter_questions` bulk insert 성공 후 `countByDocAndChapter` 가 10 반환
- `pickNextQuestion` 첫 호출: 모두 미답변 → 랜덤 하나 나옴
- `pickNextQuestion` 반복 호출: 중복 없이 진행, 10회 후에는 저점수 랜덤 서빙 (점수가 없으면 null)
- `AnswerGraderService.grade` → answer_attempts 1행 추가 + score 0~100 + feedback 문자열 반환
- `streamChat` 폴백: 사전 질문 0개 챕터 진입 시 기존 플로우로 떨어짐 (로그 확인)
- BE 컴파일 + `./gradlew bootRun` 기동 + /api/feynman/stream 401(인증 필요) 응답 확인

결과는 `.claude/state/evidence/2026-04-23-chapter-question-prebuild/unit/notes.md`.

## 회귀 테스트 계획
- 일반 채팅 `/api/chat/stream` → 401 그대로
- 자격증 퀴즈 생성/폴링 경로 영향 없음
- 기존 파인만 verify() 엔드포인트 (점수+피드백+sources) 그대로 동작
- 마인드맵/관리자/인증 경로 영향 없음
- 프론트 레이아웃: 채팅 흐름 그대로 보임 (출처 팝오버는 pre-gen 질문에서도 linked_chunks 로 정상 노출)

결과는 `.claude/state/evidence/2026-04-23-chapter-question-prebuild/regression/notes.md`.
