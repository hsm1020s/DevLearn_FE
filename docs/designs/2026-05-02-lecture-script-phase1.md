# 설계: 2026-05-02-lecture-script-phase1

**생성:** 2026-05-02 13:26
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-02-lecture-script-phase1
**브랜치:** task/2026-05-02-lecture-script-phase1

## 목표
챕터별 마인드맵 + 챕터 본문을 입력으로 **유튜브 강의 스타일의 한국어 내레이션 대본(markdown)** 을 LLM 으로 생성하고, 사용자가 마인드맵 패널에서 즉시 읽을 수 있게 한다. Phase 1 은 텍스트 대본까지만 — TTS / 슬라이드 / 영상은 후속 Phase.

## 사용 데이터
- `output/<docId>/chapters/<folder>/<file>.md` — 챕터 본문 (frontmatter 제외)
- `mindmap_nodes` 테이블 — label / description / depth / seq / parentId
- (선택, 후속) `mindmaps.pass1_analysis` — 대본 윤문 단계에서

## 변경 범위

### 백엔드 (DevLearn_BE)
- 신규 패키지 `com.moon.devlearn.lecture/`
  - `service/LectureScriptService.java`
    - `Optional<String> findExisting(docId, chapter)` — 디스크에서 `output/<docId>/lectures/<safeChapter>/script.md` 읽기
    - `void streamGenerate(userId, docId, chapter, SseEmitter)` — 컨텍스트 로드 → LLM 스트림 → 토큰 SSE → 완료 시 디스크 저장 + done 이벤트
  - `controller/LectureController.java`
    - `GET /api/lectures/{docId}/{chapter}/script` → 200 (text) 또는 404
    - `POST /api/lectures/{docId}/{chapter}/script/stream` (SSE) → 토큰 스트림
- 새 시스템 프롬프트 `lecture.script` (DB `system_prompts` insert):
  - 변수: `{{chapter}}`, `{{mindmapText}}`, `{{chapterBody}}`
  - 출력 규칙: 인트로(훅) → depth1 섹션별 단락 → 마무리 요약, 각 단락 앞에 `[SLIDE: 노드 라벨 또는 키워드]` 마커, 한국어 내레이션 톤(친근체)
- 마인드맵 컨텍스트는 `FeynmanService.buildMindmapContext` 와 같은 형태(`[N] 라벨: 설명`) 재사용 — 새 헬퍼 `MindmapPromptBuilder` 로 추출해 두 서비스가 공유.
  - 단, 이번 task 에서는 작은 범위 유지를 위해 `LectureScriptService` 가 자체 헬퍼로 유사 구현(중복 OK). 공통화는 후속 정리.
- 소유자 검증: `assertDocOwner(userId, docId)` 재사용 (FeynmanService의 패턴 그대로 헬퍼 추출 또는 같은 식 작성).
- 파일 경로: `output/<docId>/lectures/<chapterIdSafe>/script.md`. `chapterIdSafe` = 챕터 타이틀의 안전화(특수문자 제거) — 마인드맵 폴더 명명 규칙과 통일.
- 모델: `gpt-oss-20b` (기본). 요청 파라미터 `llm` 으로 오버라이드 허용.

### 프론트 (DevLearn_FE)
- 신규 서비스 `src/services/lectureApi.js`
  - `fetchLectureScript(docId, chapter)` — GET, 404 시 null
  - `streamLectureScript({docId, chapter, llm, signal, onToken, onDone, onError})` — POST SSE, 토큰 누적 + done 후 콜백
- `src/components/mindmap/AutoMindmapTab.jsx`
  - 완료된 챕터(`status==='completed'`) 행 우측에 "📺 강의" 아이콘 버튼 추가
  - 클릭 → `LectureScriptDrawer` 열기 (현재 챕터/docId 전달)
- 신규 컴포넌트 `src/components/lecture/LectureScriptDrawer.jsx`
  - 사이드 드로워(또는 모달) 형태로 강의 대본 표시
  - 진입 시 `fetchLectureScript` → 있으면 ReactMarkdown 으로 렌더, 없으면 "강의 대본 생성" 버튼
  - 생성 버튼 클릭 → `streamLectureScript` → 실시간으로 본문에 토큰 누적, 도중 취소(AbortController) 가능
  - `[SLIDE: ...]` 라인은 시각적으로 강조(배지 스타일) — 마크다운 커스텀 컴포넌트로 처리
- 의도적으로 빼는 것
  - 별도 라우트(/lectures/...) 페이지 — 마인드맵 패널 안에서만 열림
  - 다중 버전 / 재생성 히스토리 — 한 챕터당 최신 1개 파일 유지(덮어쓰기). 후속 task 에서 DB 메타 추가.

## 구현 계획
1. BE: 패키지 생성, 컨트롤러+서비스 골격, 디스크 read/write, SSE.
2. DB: `lecture.script` 시스템 프롬프트 INSERT.
3. FE: `lectureApi.js` + `LectureScriptDrawer.jsx`.
4. FE: `AutoMindmapTab.jsx` 의 챕터 행에 강의 버튼 추가.
5. BE 재기동 + FE dev 재기동, 마인드맵 챕터 1개에서 생성·읽기 사이클 확인.

## 단위 테스트 계획
- 마인드맵 있는 챕터 1개 선택 → "📺 강의" 클릭 → 처음엔 "생성" 버튼 노출.
- 생성 버튼 클릭 → 토큰이 실시간으로 본문에 쌓이고, `[SLIDE: ...]` 마커가 배지로 표시되는지.
- 완료 후 디스크에 `script.md` 저장됐는지(BE 로그 + 파일 시스템 확인).
- 다시 같은 챕터 진입 → 재생성 없이 저장본 즉시 표시되는지.
- 다른 챕터 진입 → 별도 파일로 분리되어 저장되는지.

결과는 `.claude/state/evidence/2026-05-02-lecture-script-phase1/unit/notes.md`.

## 회귀 테스트 계획
- 자동 마인드맵 탭 챕터 트리/그룹핑/체크박스/생성 흐름 그대로 동작.
- 파인만 채팅(`feynman.chat.mindmap`) 그대로 동작 — 새 시스템 프롬프트 추가가 기존 프롬프트 키를 건드리지 않음.
- 일반 채팅 / 마인드맵 캔버스 영향 없음.

결과는 `.claude/state/evidence/2026-05-02-lecture-script-phase1/regression/notes.md`.
