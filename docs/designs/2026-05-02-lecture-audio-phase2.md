# 설계: 2026-05-02-lecture-audio-phase2

**생성:** 2026-05-02 14:15
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-lecture-audio-phase2
**브랜치:** task/2026-05-02-lecture-audio-phase2

## 목표
Phase 1 의 강의 대본(`script.md`)을 OpenAI TTS(`tts-1`, voice=`nova`)로 mp3 화하여 챕터별로 캐시한다. Phase 1 과 동일한 패턴으로:
- 챕터/과목/책 단위 단일+일괄 생성 UI
- 진행상태 가시성(배지·배너·결과 패널)
- 모든 실행/배치 이력 DB 영속화 (`lecture_audio_runs` + `lecture_batch_runs.kind='audio'` + `llm_call_logs.source='lecture-tts'`)
- 드로워에 오디오 플레이어

## 사용 데이터
- 입력: 디스크 `output/<docId>/lectures/<chapter>/script.md`
- 출력: 같은 폴더에 `audio.mp3` (단일 mp3) + `audio_meta.json` (model/voice/chars/duration_sec)

## 변경 범위

### 백엔드 (DevLearn_BE)

1. **schema 변경**
   - `lecture_batch_runs` 에 `kind VARCHAR(20) NOT NULL DEFAULT 'script'` 추가 — Phase 1 기존 행은 자동 'script', 신규 audio 배치는 'audio'.
   - 신규 `lecture_audio_runs` 테이블:
     ```
     id, user_id, doc_id, chapter, batch_id (NULL),
     model (예: tts-1), voice (예: nova),
     status (running|completed|failed),
     input_chars, audio_path, duration_sec,
     cost_usd, duration_ms (호출 소요시간, audio 길이와는 다름),
     error_code, error_msg,
     started_at, finished_at, created_at
     ```
   - 인덱스: `(doc_id, chapter, started_at DESC)`, `(user_id, created_at DESC)`, `(batch_id)`

2. **신규 mapper / Entity** — `lecture/mapper/`
   - `LectureAudioRunEntity` + `LectureAudioRunMapper` + XML
   - `LectureBatchRunMapper.insertRunning` 의 INSERT 에 `kind` 컬럼 포함

3. **신규 `LectureAudioService`**
   - `streamGenerate(userId, docId, chapter, voiceOverride, batchId, emitter)`
     - 권한 검증 → script.md 읽기(없으면 NOT_FOUND) → inflight INSERT
     - script 텍스트 정리: `# 제목` / `## 섹션` 헤딩 유지(읽기 자연스러움), `[SLIDE: ...]` 마커 제거, 코드블록·표는 그대로 발화될 가능성 — Phase 2 v1 에서는 단순 strip 만.
     - OpenAI TTS API 호출(`POST https://api.openai.com/v1/audio/speech`, model `tts-1`, voice `nova`, response_format `mp3`)
     - 4096자 초과 시 단락 단위로 분할 호출 후 mp3 바이너리 단순 concat (CBR mp3 라 가능)
     - 디스크 저장 + 메타 JSON 작성 → UPDATE completed
     - 예외 시 UPDATE failed
     - llm_call_logs INSERT (source=`lecture-tts`, phase=`synth`)
   - `findExisting(userId, docId, chapter)` — audio.mp3 디스크 존재 확인
   - `audioFile(userId, docId, chapter)` — Resource 반환 (컨트롤러 streaming 용)
   - `listGenerated(userId, docId)` — 폴더명 Set
   - `startBatch / finishBatch` — kind='audio' 로 lecture_batch_runs INSERT/UPDATE (LectureBatchRunMapper 재사용)
   - 비용 단가: tts-1 `$15.00/1M chars`. 챕터당 ~5,000자 → ~$0.075.

4. **신규 `LectureAudioController`**
   - `GET  /api/lectures/{docId}/{chapter}/audio` — mp3 streaming (Range 지원)
   - `POST /api/lectures/{docId}/{chapter}/audio/stream` — SSE 생성 (token 이벤트는 진행 비율 emit, done 이벤트는 audio URL 포함)
   - `GET  /api/lectures/{docId}/audio/status` — 이미 생성된 챕터 safe-name 목록
   - 일괄 배치는 기존 `/lectures/{docId}/batches` 재사용 + body `kind='audio'` 받기

5. **`LectureBatchRunEntity` / Mapper** 에 `kind` 필드 추가, batch start 시그니처에 kind 추가.

### 프론트 (DevLearn_FE)
- `services/lectureApi.js`
  - `fetchLectureAudioStatus(docId)` → Set<safeName>
  - `streamLectureAudio({docId, chapter, voice, batchId, onProgress, onDone, signal})`
  - `lectureAudioUrl(docId, chapter)` — `<audio src=...>` 용 URL 빌더 (auth 필요하니 fetch+blob 변환 또는 token query)
  - `startLectureBatch` 에 `kind` 인자 추가 (default `'script'`)
- `components/lecture/LectureScriptDrawer.jsx`
  - 헤더 옆에 🎵 "오디오 생성" 버튼. 이미 있으면 인라인 오디오 플레이어 표시.
  - 생성 중 → 상단에 "오디오 생성중 0:42" 진행 줄. 완료/실패 토스트.
- `components/mindmap/AutoMindmapTab.jsx`
  - 각 완료 챕터 행에 음악 아이콘(🎵) 추가. 상태 배지(없음/생성중/완료/실패) 같은 패턴으로.
  - 챕터 목록 상단 + 대단원 헤더에 "전체 오디오" 버튼. 기존 confirm popover 와 batch infra 100% 재사용 — 단지 `kind='audio'` 분기.
  - 두 일괄(스크립트/오디오)가 동시 진행될 가능성 — v1 에서는 직렬화하지 않고 별도 state 로 둠. 단 같은 챕터의 동일 kind 중복 호출은 disabled 처리.

### 의도적으로 빼는 것 (스코프 외)
- 단락별 timings.json (재생 위치에 따른 본문 하이라이트) — 단락 별 TTS 호출은 비용/지연 부담. 균등 비율 추정으로 충분하다는 판단도 있으나 v1 에서는 timings 자체를 안 만들고 단순 mp3 만. Phase 3 에서 슬라이드 sync 같이 처리.
- 재생 속도 / 자막 / 청취 위치 저장 — 기본 HTML5 audio controls 만.

## 구현 계획
1. schema.sql 패치 + 즉시 적용 SQL.
2. Entity / Mapper / XML (audio + batch.kind 추가).
3. LectureAudioService 작성 (TTS 호출, mp3 concat, DB 통합, 비용 계산).
4. LectureAudioController 라우트 + 기존 batch 라우트에 kind 파라미터.
5. lectureApi 신규 함수 + AutoMindmapTab batch 흐름에 kind thread + LectureScriptDrawer 오디오 섹션.
6. BE 재기동 + FE 검증 (단일 챕터 → DB row + 디스크 mp3 + 플레이어).

## 단위 테스트 계획
- 단일 챕터 오디오 생성 → `lecture_audio_runs` 1행, status=completed, audio_path/duration_sec/cost_usd/input_chars 채워짐.
- `llm_call_logs` source='lecture-tts' 1행 추가.
- 디스크 audio.mp3 + audio_meta.json 존재.
- 드로워에 `<audio>` 플레이어 노출 + 재생 가능.
- 책/과목 단위 일괄 → batch 행(kind='audio') + runs N행.

결과는 `.claude/state/evidence/2026-05-02-lecture-audio-phase2/unit/notes.md`.

## 회귀 테스트 계획
- Phase 1 스크립트 단일/일괄 흐름 그대로 동작 (batch insert 시 kind='script' 기본값).
- 마인드맵 자동 생성 / 파인만 챗 / 자동 마인드맵 탭 회귀 없음.
- 기존 batch 행(kind 컬럼 NULL → 'script' 기본값) 통계 깨지지 않음.

결과는 `.claude/state/evidence/2026-05-02-lecture-audio-phase2/regression/notes.md`.
