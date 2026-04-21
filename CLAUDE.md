# 프로젝트 규칙 · 하네스 엔지니어링

## 경로
- 프론트엔드: `/Users/moon/DevLearn_FE`
- 백엔드: `/Users/moon/IdeaProjects/DevLearn_BE`
- 워크트리 루트: `/Users/moon/DevLearn_FE_wt/<task-id>` (자동 생성)
- 설계 문서: `docs/designs/<task-id>.md` (자동 템플릿)
- 증거/상태: `.claude/state/` (git 제외)

---

## 하네스 5단계 워크플로우 (강제 집행)

사용자가 **새 작업**을 지시하면 반드시 아래 5단계를 순서대로 밟는다.
순서를 어기면 `.claude/hooks/` 훅이 **exit 2**로 차단하고 직전 단계로 되돌린다.

| Step | 이름 | 게이트 | 전진 명령 |
|------|------|--------|-----------|
| **0** | 워크트리 격리 | `git worktree` 생성 + 상태파일 활성화 | `/phase-start <slug>` |
| **1** | 설계 | `docs/designs/<task-id>.md` 의 `목표` 섹션 채움 | `/phase-advance design-done` |
| **2** | 구현 + 단위 테스트 | `.claude/state/evidence/<task-id>/unit/notes.md` 에 검증 시나리오/결과 기록 | `/phase-advance unit-done` |
| **3** | 회귀(기능) 테스트 | `.claude/state/evidence/<task-id>/regression/notes.md` 에 다른 주요 기능 동작 확인 기록 | `/phase-advance regression-done` |
| **4** | 내 브랜치 병합 + 사후 검증 | 워크트리 → `master` 병합 후 **한 번 더 테스트** → 이상 없으면 커밋 & `git push` | `/phase-advance merged` → `/phase-end` |

### 단계별 차단 규칙 (훅이 자동 강제)
- **Step 0 미완:** 활성 태스크가 있는데 워크트리 밖 파일을 `Edit|Write` → 차단
- **Step 1 미완:** `phase=worktree-ready` 상태에서 `src/**` 편집 → 차단
- **Step 3 미완:** `phase<regression-tested` 상태에서 `git merge` / `git push` → 차단
- **Step 4 미완:** `phase<merged` 상태에서 `git worktree remove` → 차단

차단되면 stderr 메시지에 "어느 단계로 되돌려야 하는지" 명시된다. 지시대로 누락 작업을 완료한 뒤 다시 시도한다.

### 규칙
1. **항상 `/phase-start`로 시작** — 사용자가 "X 기능 만들어줘" 등 구체 작업을 지시하면, 제일 먼저 슬러그를 뽑아 `/phase-start <slug>` 실행.
2. **자유 편집이 필요하면 `/phase-end`** — 오탈자/문서/설정 수정 등 정식 태스크가 아닌 경우, 먼저 `/phase-end`로 활성 태스크를 종료하거나 애초에 `/phase-start`를 쓰지 않는다.
3. **단위 테스트 노트 필수** — Step 2 완료 조건은 `.claude/state/evidence/<task-id>/unit/notes.md` 파일이 존재하고 내용이 있음. 검증한 시나리오·결과를 텍스트로 간단히 기록한다(형식 자유). 스크린샷은 선택 사항.
4. **회귀 테스트 범위** — Step 3에서는 이번 변경과 무관한 주요 기능(채팅/마인드맵/문서/인증 등) 1개 이상을 실제 사용해보고 `regression/notes.md` 에 결과를 기록.
5. **상태 확인은 `/phase-status`** — 현재 어느 단계인지 헷갈리면 먼저 호출.
6. **병합 후 재검증 + 푸시** — Step 4에서 `master` 병합이 끝나면 반드시 한 번 더 주요 기능을 실제로 돌려보고(스모크 테스트), 이상 없음을 확인한 뒤 커밋 & `git push`로 원격에 반영한다. 병합만 하고 푸시를 빼먹지 말 것.
7. **작업 완료 후 워크트리/브랜치 정리** — `/phase-end` 이후 `git worktree list`로 확인하고, master에 병합이 끝난 워크트리와 task 브랜치는 `git worktree remove --force <path>` + `git branch -d task/<id>` 로 정리한다. 병합되지 않은 워크트리는 보존한다.

---

## 코드 작성 규칙

### 주석
- 모든 파일 상단에 `@fileoverview` JSDoc (파일의 역할과 의도)
- 컴포넌트 props가 있으면 `@param` JSDoc
- 비자명한 로직에는 인라인 주석 (왜 그렇게 했는지)

### 스타일링
- 색상은 CSS 변수(`globals.css :root`)로 정의 → Tailwind 유틸리티(`bg-bg-primary` 등)로만 참조. `bg-white`, `#FFFFFF` 하드코딩 금지.
- 전체 배경은 크림/베이지 톤(클로드 스타일) 유지.

### UI/UX
- 브라우저 내장 UI(`alert`, `confirm`) 사용 금지 → 커스텀 팝오버 / Toast
- 삭제 등 위험 동작은 **팝오버 > 모달** 우선
- 버튼과 관련 팝업/드롭다운은 가까이 배치
- 채팅 초기 화면은 `EmptyChatView` 공통 컴포넌트 사용 (중앙 → 입력 후 하단 이동)
- 한국어 입력(IME)은 `e.nativeEvent.isComposing` 체크 필수

### 설계 원칙
- 중복 코드 발견 시 공통 컴포넌트로 추출
- 새 스토어 추가 시 localStorage 마이그레이션(`version` + `migrate`) 고려

---

## 프로젝트 구조 참고
> 전체 파일 인덱스 및 기능별 역참조는 `docs/PROJECT_MAP.md`.

| 항목 | 위치 | 설명 |
|------|------|------|
| 모드 레지스트리 | `src/registry/modes.js` | 새 모드 추가 시 이 파일만 수정 |
| 디자인 토큰 | `src/styles/globals.css` → `tailwind.config.js` | `:root` 변수 정의 → Tailwind 참조 |
| API 전환 | `src/services/api.config.js` | `VITE_MOCK_API`로 Mock/Real 전환 |
| 스토어 (6개) | `src/stores/` | useAppStore, useAuthStore, useChatStore, useCertStore, useDocStore, useMindmapStore |
| 마인드맵 | `src/stores/useMindmapStore.js` | 모드별 독립 관리 (`maps{}` + `activeMapId` + `lastActiveByMode`) |

---

## 보조 스크립트 · 슬래시 커맨드

| 명령 | 역할 |
|------|------|
| `/phase-start <slug>` | Step 0 — 워크트리 생성 + 설계 템플릿 |
| `/phase-advance <next>` | 다음 단계로 전진 (게이트 검증) |
| `/phase-status` | 현재 활성 태스크/단계 확인 |
| `/phase-end` | 태스크 종료 (자유 편집 모드 복귀) |

직접 호출: `bash .claude/hooks/phase.sh {start|advance|status|end} [인자]`

## 완료 후 기록
- 작업 완료 시 `docs/WORK_LOG.md` 에 날짜별 요약 추가
- 기능 추가 시 해당 기능 md 파일(`docs/FEATURES.md` 등)에 내용 추가
- dev 서버가 실행 중이면 코드 변경 후 `lsof -ti:3000 | xargs kill` → 재시작
