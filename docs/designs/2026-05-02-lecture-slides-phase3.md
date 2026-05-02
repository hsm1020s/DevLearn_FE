# 설계: 2026-05-02-lecture-slides-phase3
**생성:** 2026-05-02 15:26
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-lecture-slides-phase3
**브랜치:** task/2026-05-02-lecture-slides-phase3

## 목표
챕터별 강의 대본(`script.md`) + 마인드맵으로 1280×720 PNG 슬라이드 시퀀스를 자동 생성하고 재생 위치 sync 가능한 뷰어를 제공한다. Phase 4 영상 합성의 입력 자료가 되는 동시에 단독으로도 가치 있음.

## 산출물 (챕터당)
```
output/<docId>/lectures/<chapter>/
├── script.md            # Phase 1
├── audio.mp3            # Phase 2
├── deck.html            # ⊕ Phase 3 — 단일 HTML 데크
├── slides/00.png ...    # ⊕ Phase 3 — PNG 시퀀스 (1280x720)
├── slides.json          # ⊕ Phase 3 — title/bullets/narrationCharRange 메타
└── slide_timings.json   # ⊕ Phase 3 — char→sec 환산 (Phase 4 + FE sync 입력)
```

## LLM 사용
- **gpt-5.4-mini 한 번 호출 / 챕터** — 모든 slide segment 의 bullet 일괄 추출
- 신규 시스템 프롬프트 `lecture.slides.bullets`: JSON 배열 반환 강제, 슬라이드별 3~4 bullet 명사구
- 비용 ~$0.006/챕터, +3~5초

## 슬라이드 디자인 (Template A — Minimal)
- 1280×720, 챕터명(헤더, 작게) + N 배지 + 제목 + bullet 3~4 + 푸터
- 기존 디자인 토큰(클로드 크림 톤) 재사용, 한글 Pretendard CDN
- 정적 (애니메이션 X)

## 변경 범위

### DB
- `lecture_batch_runs.kind` enum 에 `'slides'` 추가 (validation 만 — 실제 컬럼은 그대로)
- 신규 `lecture_slides_runs`:
  ```
  id, user_id, doc_id, chapter, batch_id (NULL),
  status (running|completed|failed),
  slide_count, deck_html_path, slides_dir,
  llm_model, input_tokens, output_tokens, cost_usd,
  synth_ms, capture_ms, duration_ms,
  error_code, error_msg,
  started_at, finished_at, created_at
  ```
  인덱스: `(doc_id, chapter, started_at DESC)`, `(user_id, created_at DESC)`, `(batch_id)`
- `system_prompts` 신규 row `lecture.slides.bullets`

### 백엔드 (DevLearn_BE)
- `lecture/mapper/LectureSlidesRunEntity` + `Mapper` + XML
- `lecture/service/SlideSynthesisService` — script 파싱(`[SLIDE: ...]` split, char offset 계산) + LLM 1회 호출 → `slides.json` 생성
- `lecture/service/SlideDeckBuilder` — `slides.json` → `deck.html` (인라인 CSS, JS 최소)
- `lecture/service/SlideCaptureService` — ProcessBuilder 로 Python `capture_slides.py` 호출
- `lecture/service/LectureSlidesService` — synthesize → buildDeck → capture → updateTimings 오케스트레이션 + DB INSERT/UPDATE + llm_call_logs 기록 + startBatch/finishBatch
- `lecture/controller/LectureSlidesController`:
  - GET  `/lectures/{doc}/{chapter}/slides`         — `slides.json` 반환
  - GET  `/lectures/{doc}/{chapter}/slides/{n}.png` — PNG 파일 stream
  - GET  `/lectures/{doc}/{chapter}/slide-timings`  — `slide_timings.json`
  - POST `/lectures/{doc}/{chapter}/slides/stream`  — SSE 생성
  - GET  `/lectures/{doc}/slides/status`            — 생성 챕터 safe-name Set
  - POST `/lectures/{doc}/slides/batches`           — kind='slides' 배치 시작
  - POST `/lectures/slides/batches/{id}/finish`     — 종료
- 디스크 파일 인증: 미디어 태그용 query token 폴백(`?access_token=`)은 Phase 2 의 JwtAuthFilter 변경 그대로 재사용

### Python 파이프라인
- 신규 `scripts/lecture_pipeline/capture_slides.py` (Playwright)
- `requirements.txt` 또는 새 `lecture_pipeline/requirements.txt` 에 playwright 추가
- 첫 사용 시 `playwright install chromium` 필요 (가이드 README)

### 프론트 (DevLearn_FE)
- `services/lectureApi.js`:
  - `fetchLectureSlidesStatus`, `startLectureSlidesBatch`, `finishLectureSlidesBatch`, `streamLectureSlides`
  - `lectureSlidesUrl(docId, chapter)` (slides.json fetch)
  - `lectureSlideImageUrl(docId, chapter, n)` (token query 포함 직접 URL)
  - `lectureSlideTimingsUrl(docId, chapter)`
- `components/lecture/LectureScriptDrawer.jsx`:
  - 본문 위 "강의 슬라이드" 섹션 (오디오 섹션 옆/아래)
  - PNG `<img>` 표시 + `◀ N/M ▶` 페이징
  - "재생 sync" 토글: 켜면 `audio.ontimeupdate` → `slide_timings.json` 보고 자동 슬라이드 전환
- `components/mindmap/AutoMindmapTab.jsx`:
  - 챕터 행에 🎬 (Presentation 아이콘) — 슬라이드 생성됨 = primary 색
  - 대단원/책 헤더에 슬라이드 일괄 버튼 (kind='slides')
  - `runLectureBatch(..., 'slides')` 분기 추가 (Phase 1·2 패턴 재사용)

### 의도적으로 빼는 것
- PDF 페이지 임베드 — v1.5
- 휴리스틱 fallback (LLM 실패 시 첫 두 문장으로 폴백) — 실용상 LLM 실패율 낮음, 후속에서 추가
- 슬라이드 디자인 B (마인드맵 임베드) / C (PDF 페이지) — v2

## 구현 순서
1. DB 마이그레이션 + `lecture.slides.bullets` 프롬프트 INSERT
2. BE 엔티티/매퍼
3. SlideSynthesisService (script 파싱 + LLM 호출)
4. SlideDeckBuilder (HTML 빌드)
5. capture_slides.py (Python + Playwright)
6. LectureSlidesService 오케스트레이션 + Controller
7. FE lectureApi 함수
8. FE 드로워 슬라이드 섹션 + 자동 sync
9. FE AutoMindmapTab 일괄 UI 분기 추가
10. BE+FE 재기동 → 1챕터로 풀 사이클 검증

## 단위 테스트 계획
- 1챕터 생성 → DB row 1, llm_call_logs 1, slides.json + deck.html + slides/*.png 디스크 존재
- 드로워에서 슬라이드 섹션 노출 + ◀▶ 동작
- "재생 sync" 토글 켜고 audio 재생 → 슬라이드 자동 전환
- 일괄 생성 (책/과목) — Phase 1/2 와 같은 진행 UI 동작 확인

결과 → `.claude/state/evidence/2026-05-02-lecture-slides-phase3/unit/notes.md`

## 회귀 테스트 계획
- Phase 1 (script) / Phase 2 (audio) 단일·일괄 동작 그대로
- 마인드맵 자동 생성, 파인만 챗 영향 없음
- 기존 batch.kind='script'/'audio' 통계 무손상

결과 → `.claude/state/evidence/2026-05-02-lecture-slides-phase3/regression/notes.md`
