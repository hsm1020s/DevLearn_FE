# 설계: 2026-05-02-lecture-video-phase4
**생성:** 2026-05-02 15:58
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-lecture-video-phase4
**브랜치:** task/2026-05-02-lecture-video-phase4

## 목표
Phase 1·2·3 산출물(script + audio + slides + slide_timings) 을 단일 mp4 + WebVTT 자막 + 챕터 마커로 합성하고, 풀스크린/자막 토글/챕터 점프/다운로드가 가능한 비디오 플레이어를 마인드맵 패널에 통합한다.

## 산출물 (챕터당)
```
output/<doc>/lectures/<chapter>/
├── lecture.mp4         ⊕ H.264 1280×720 + AAC 128kbps (~10~20MB)
├── captions.vtt        ⊕ WebVTT 자막 (gpt-5.4-mini 가 단락→호흡 cue 분할)
└── chapters.vtt        ⊕ WebVTT 챕터 마커 (script ## 헤딩 → sec 환산)
```

## LLM 사용
- gpt-5.4-mini 1회 호출/챕터 — 단락(80~150자)을 자막 cue(20~40자/2~4초) 로 정밀 분할
- 신규 시스템 프롬프트 `lecture.captions.split` (JSON 배열 출력 강제)
- 비용 ~$0.01/챕터 (~₩14)
- 다른 단계는 LLM 없음 (chapters/메타데이터/썸네일 모두 결정적)

## 5-step 파이프라인 (LectureVideoService)
1. **measure** — `ffprobe` 로 audio.mp3 의 정확한 duration(sec) 측정
2. **slide-timing 갱신** — slide_timings.json 의 charRatio × audioDur → startSec/endSec 추가
3. **captions** — script.md 단락 split → LLM 호출 → cues[]: charStart/charEnd → sec 환산 → captions.vtt
4. **chapters.vtt** — script `## ...` 헤딩 정규식 → sec 환산 → chapters.vtt
5. **mp4 합성** — Python `build_video.py` 가 ffmpeg concat demuxer 로 슬라이드+오디오 → lecture.mp4

## 변경 범위

### DB
- `lecture_batch_runs.kind` 에 'video' 케이스 추가 (컬럼 변경 없음)
- 신규 `lecture_video_runs`:
  ```
  id, user_id, doc_id, chapter, batch_id (NULL),
  status (running|completed|failed),
  video_path, vtt_path, chapters_vtt_path,
  audio_dur_sec NUMERIC(10,2),
  video_dur_sec NUMERIC(10,2),
  slide_count INT,
  llm_model, input_tokens, output_tokens, cost_usd,
  measure_ms BIGINT,    -- ffprobe
  captions_ms BIGINT,   -- LLM + .vtt 빌드
  ffmpeg_ms BIGINT,     -- mp4 합성
  duration_ms BIGINT,
  file_size_bytes BIGINT,
  error_code, error_msg,
  started_at, finished_at, created_at
  ```
- 신규 시스템 프롬프트 `lecture.captions.split`

### 백엔드 (DevLearn_BE)
- `lecture/mapper/LectureVideoRunEntity` + `Mapper` + XML
- `lecture/service/CaptionsBuilder.java` — script 단락 추출 + LLM 호출 + cue→sec 환산 + .vtt 빌드. ChaptersBuilder 메서드 같은 클래스에 둠.
- `lecture/service/LectureVideoService.java` — 5 step orchestrate + DB INSERT/UPDATE + ProcessBuilder ffprobe/build_video.py + startBatch/finishBatch
- `lecture/controller/LectureVideoController.java`:
  - GET  `/lectures/{doc}/{chapter}/video`              — mp4 stream (Range 지원, Phase 2 패턴)
  - GET  `/lectures/{doc}/{chapter}/video/captions.vtt` — WebVTT
  - GET  `/lectures/{doc}/{chapter}/video/chapters.vtt` — chapter markers
  - GET  `/lectures/{doc}/{chapter}/video/meta`         — `{duration, slideCount, fileSizeBytes, chapters[]}`
  - POST `/lectures/{doc}/{chapter}/video/stream`       — SSE 생성
  - GET  `/lectures/{doc}/video/status`                 — 챕터 safe-name set
  - POST `/lectures/{doc}/video/batches`                — kind='video' 배치
  - POST `/lectures/video/batches/{id}/finish`          — 종료
  - GET  `/lectures/{doc}/video/runs`                   — 최근 run

### Python 파이프라인
- `scripts/lecture_pipeline/build_video.py`:
  - args: `--slides-dir`, `--audio`, `--out-mp4`, `--timings-json`
  - timings.json 의 startSec/endSec 로 concat.txt 생성
  - ffmpeg concat demuxer + libx264 (CRF 23, veryfast) + AAC 128k

### 프론트 (DevLearn_FE)
- `services/lectureApi.js`:
  - `fetchLectureVideoMeta`, `fetchLectureVideoStatus`
  - `lectureVideoUrl(docId, chapter)` (mp4 직접 URL, ?access_token=)
  - `lectureVideoCaptionsUrl`, `lectureVideoChaptersUrl`
  - `streamLectureVideo`, `startLectureVideoBatch`, `finishLectureVideoBatch`
- `components/lecture/LectureScriptDrawer.jsx`:
  - "강의 영상" 섹션을 슬라이드 섹션 위로 (영상 있으면 메인, 없으면 슬라이드/오디오 폴백)
  - HTML5 `<video>` + `<track kind="captions">` + `<track kind="chapters">`
  - 자막 토글, 챕터 점프 메뉴, 다운로드 버튼
- `components/mindmap/AutoMindmapTab.jsx`:
  - 챕터 행에 🎥 (Video lucide-react) 아이콘 (생성됨 = primary 색)
  - 대단원/책 단위 "전체 영상" 버튼 (kind='video')
  - `runLectureBatch(..., 'video')` 분기 추가

### 의도적으로 빼는 것
- 마인드맵 노드 동기 하이라이트 (영상 시간 → 노드) — Phase 4.5
- mp4 안에 자막 hard-burn — soft subtitle 로 토글 가능하게 둠
- 챕터별 책 전체 단일 영상 — 챕터별 분리가 UX 상 우월
- 썸네일/포스터 이미지 자동 선정 — 첫 슬라이드 (00.png) 자동 사용
- LLM 호출 폴백 — 자막은 paragraph 그대로를 cue 로 쓰는 단순 폴백

## 구현 순서
1. DB 마이그레이션 + `lecture.captions.split` 프롬프트 INSERT
2. BE 엔티티/매퍼
3. CaptionsBuilder (LLM + WebVTT 빌드)
4. build_video.py (ffmpeg concat)
5. LectureVideoService 오케스트레이션 + Controller (Range)
6. FE lectureApi 함수
7. FE 드로워 비디오 섹션
8. FE AutoMindmapTab 일괄 UI
9. BE+FE 재기동 → 1챕터 풀파이프 검증

## 단위 테스트 계획
- 1챕터 영상 생성 → DB row, llm_call_logs 1건, 디스크 lecture.mp4 + captions.vtt + chapters.vtt
- 드로워에서 비디오 플레이어 노출 + 재생 + 자막 토글 + 챕터 점프 + 다운로드
- 일괄 (책/과목) — 진행 UI 동작

결과 → `.claude/state/evidence/2026-05-02-lecture-video-phase4/unit/notes.md`

## 회귀 테스트 계획
- Phase 1/2/3 단일·일괄 흐름 그대로
- 마인드맵 자동 생성, 파인만 챗 영향 없음
- 기존 batch.kind='script'/'audio'/'slides' 통계 무손상

결과 → `.claude/state/evidence/2026-05-02-lecture-video-phase4/regression/notes.md`
