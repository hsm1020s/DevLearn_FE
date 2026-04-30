# 설계: 2026-04-22-worklearn-mode-split

**생성:** 2026-04-22 10:36
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-22-worklearn-mode-split
**브랜치:** task/2026-04-22-worklearn-mode-split

## 목표
회사업무학습을 `worklearn` 별도 모드로 분리한다. 학습(자격증) 모드의 "PDF→퀴즈→오답→통계" 루프를 그대로 재활용하려다 어긋나는 문제(업무학습은 정답이 있는 문제 풀이가 아님)를 구조적으로 해결한다.

`worklearn`은 **업무 지식 기록 + 사용자 정의 체크리스트 + 학습 채팅**의 3-탭으로 구성하며, 학습(자격증) 모드와 공유 가능한 부품(스타일 칩·채팅 훅·체크리스트 UI)은 컴포넌트 재사용으로 풀고, 독립 관리가 필요한 부분(업무노트·완료 기준)만 `useWorkLearnStore`에 분리한다.

이 태스크의 스코프는 **모드 뼈대 + 업무노트 + 공유 체크리스트 + 채팅 탭**까지. 고급 기능(태그 필터, 관련 문서 업로드, 노트 간 링크)은 후속.

### 비(非)목표
- 백엔드 API 신설. 업무노트·체크리스트는 FE 로컬 persist만.
- 학습(자격증) 모드 기능 삭제/변경. 모드 레지스트리에 라벨만 "학습 → 자격증"으로 조정(업무학습과 구분 명확화).
- 기존 서브태스크 1에서 `worklearn` 슬롯 준비가 안 된 스토어의 대대적 리팩터. 최소한의 슬롯 추가(`useChatStore.lastActiveByMode`)만 수행.

---

## 설계 결정

### A. 모드 레지스트리에 `worklearn` 추가

```js
// src/registry/modes.js
export const MODES = {
  general:   { value: 'general',   label: '일반',     icon: Search,         component: ChatContainer },
  study:     { value: 'study',     label: '자격증',   icon: GraduationCap,  component: StudyMode },
  worklearn: { value: 'worklearn', label: '업무학습', icon: Briefcase,      component: WorkLearnMode },
};
```

- `study` 라벨을 "학습 → 자격증"으로 변경 (업무학습 추가로 의미 충돌 회피).
- 아이콘은 `lucide-react`에서 `GraduationCap`(자격증) / `Briefcase`(업무학습)로 시각 분리.

### B. `worklearn` 모드 3-탭 구조

```
[💬 학습 채팅] [📝 업무노트] [✅ 체크리스트]
```

| 탭 | 역할 | 구현 |
|----|------|------|
| 학습 채팅 | 스타일 칩(일반/파인만/요약) + 채팅 본문 | `StudyChatTab`을 `mode` prop 받도록 일반화해 공유 |
| 업무노트 | 제목·본문·태그 카드 리스트 + 편집 모달 | 신규 `WorkNotePanel` + `WorkNoteEditor` |
| 체크리스트 | 사용자 정의 프로젝트별 체크리스트 | 일반화된 `ChecklistPanel` (items prop + onToggle prop) |

### C. 공유 컴포넌트 일반화 전략

**학습 채팅 탭 재사용:**
현재 `StudyChatTab`은 `useStreamingChat('study')` 하드코딩 + `useActiveSubjectMeta`로 예시 질문을 받는다. worklearn에서도 쓰려면:

- **옵션 1 (선택)**: `StudyChatTab`에 `mode` prop 추가 + 예시 질문 소스를 prop으로. `WorkLearnMode`는 이 컴포넌트를 `mode="worklearn" examples={WORKLEARN_EXAMPLES}`로 직접 사용.
- **옵션 2 (기각)**: 별도 `WorkLearnChatTab` 신설. 코드 복제 부담.

→ **옵션 1** 채택. 이름도 단순하게 유지하되, 내부에서 과목/모드별 분기를 prop으로 받는다.

**체크리스트 패널 일반화:**
현재 `ChecklistPanel`은 `useStudyStore.subjects[active].checklist`를 직접 구독한다. worklearn도 쓰려면:

- `ChecklistPanel({ items, onToggleChapter })` 로 바꾸고, 호출부(학습 모드)에서 스토어 연결 어댑터를 제공한다.
- 학습(자격증) 모드: `<ChecklistPanel items={...} onToggleChapter={...} />` 로 주입.
- 업무학습 모드: `useWorkLearnStore`의 checklist + toggle 액션을 주입.

### D. 업무노트 데이터 모델

```ts
type WorkNote = {
  id: string;            // UUID
  title: string;         // 노트 제목 (필수)
  body: string;          // 마크다운 본문
  tags: string[];        // ['회의', '기획안', 'QA']
  createdAt: string;     // ISO
  updatedAt: string;     // ISO
};
```

- 간단한 CRUD만 제공 (생성·수정·삭제).
- 검색/필터는 태그 기반 간단 필터만 (쿼리 입력 UI 후속).
- 삭제 시 팝오버 확인(기존 UI 규칙).

### E. 사용자 정의 체크리스트 (업무학습)

```ts
type WorkChecklist = {
  id: string;            // 프로젝트 id
  title: string;         // 프로젝트/카테고리 이름
  chapters: { id: string; label: string; done: boolean }[];
};
```

- 학습 모드 체크리스트와 동일 shape(재사용 때문). 다만 카탈로그 시드 없이 빈 배열로 시작.
- "프로젝트 추가" / "항목 추가" 버튼으로 사용자가 직접 구성.
- 이번 태스크에서는 **추가/토글/삭제**까지. 순서 변경(드래그) 등은 후속.

### F. 스타일 칩은 worklearn에서도 유효

스타일 칩(파인만/요약)은 업무학습에도 적용된다(개념 이해 필요). `useStreamingChat`에서 현재 `mode === 'study'`만 체크하던 부분을 "학습 계열 모드"로 확장.

```js
// src/registry/modes.js
export const LEARNING_MODES = new Set(['study', 'worklearn']);
export const isLearningMode = (mode) => LEARNING_MODES.has(mode);
```

`chatStyle` 자체는 `useStudyStore`의 전역 필드인데, 모드마다 독립 관리가 필요할까? → 현재로선 학습 채팅 전체 공용으로 묶어도 사용자 혼란이 적다. 성격상 "스타일"은 일회성·턴당 프리픽스이고 📌 고정은 드물다.

→ 이번 태스크에서는 **`useStudyStore.chatStyle` 을 그대로 공유**한다. 모드 간 스타일 독립이 필요해지면 후속에서 분리.

### G. 신규 스토어 `useWorkLearnStore`

```js
{
  notes: WorkNote[],
  checklist: WorkChecklist[],

  addNote({ title, body, tags }),
  updateNote(id, patch),
  removeNote(id),

  addChecklistProject({ title }),
  addChecklistItem(projectId, label),
  toggleChecklistChapter(projectId, chapterId),
  removeChecklistItem(projectId, chapterId),
  removeChecklistProject(projectId),

  reset(),
}
```

- `persist` name: `worklearn-store`, version: 1.
- `resetUserStores`에 리셋 + localStorage 제거 추가.

### H. lastActiveByMode에 worklearn 슬롯

`useChatStore.lastActiveByMode` 가 `{ general, study }` 고정 키를 쓰는 구조라, `worklearn: null` 을 추가해야 모드 전환 시 대화 복원이 정상 동작.

- `chat-store` v3 → v4 마이그레이션: 기존 `lastActiveByMode`에 `worklearn: null` 키 주입.
- reset() 초기값에도 `worklearn: null` 추가.

`useMindmapStore.lastActiveByMode`는 동적 객체 키라 별도 마이그레이션 불필요.

### I. Mock 데이터

- `chatMock.js`의 `mode === 'study'` 분기는 style 프리픽스 기반이라 `worklearn`도 그대로 처리된다. 별도 수정 불필요.
- adminMock의 `recentConversations`에 worklearn 예시 2~3건 추가 (라벨 노출 확인용).

### J. 어드민 라벨

`RecentConversations` 컴포넌트의 `MODE_LABELS`에 `worklearn: '업무학습'` 추가. (학습 모드 라벨 변경("자격증")도 함께 반영)

---

## 변경 범위

### 신규 파일

| 경로 | 역할 |
|------|------|
| `src/components/worklearn/WorkLearnMode.jsx` | 업무학습 모드 진입점 (3-탭 워크스페이스) |
| `src/components/worklearn/WorkLearnSubTabs.jsx` | 상단 탭 바 |
| `src/components/worklearn/WorkNotePanel.jsx` | 업무노트 카드 리스트 + 필터 |
| `src/components/worklearn/WorkNoteEditor.jsx` | 노트 편집 모달(제목/본문/태그) |
| `src/components/worklearn/WorkLearnChecklistPanel.jsx` | 사용자 정의 체크리스트 편집 UI (일반화된 ChecklistPanel 위에 추가 버튼) |
| `src/stores/useWorkLearnStore.js` | 업무노트 + 체크리스트 스토어 (persist v1) |

### 수정 파일

| 경로 | 변경 |
|------|------|
| `src/registry/modes.js` | `worklearn` 엔트리 + `study` 라벨 "자격증"으로 + `isLearningMode` 헬퍼 export |
| `src/stores/useChatStore.js` | `lastActiveByMode`에 `worklearn` 슬롯 추가 + v3→v4 migrate |
| `src/utils/resetUserStores.js` | `useWorkLearnStore.reset()` + `localStorage.removeItem('worklearn-store')` |
| `src/components/study/StudyChatTab.jsx` | `mode`, `examples`, `title`, `subtitle` prop 받아 일반화 — 기본값은 학습 모드 동작 |
| `src/components/study/ChecklistPanel.jsx` | `items`, `onToggleChapter` prop 기반으로 일반화 |
| `src/components/study/StudyRecordTab.jsx` | 일반화된 `ChecklistPanel`에 스토어 어댑터 주입 |
| `src/hooks/useStreamingChat.js` | `isLearningMode(mode)` 기준으로 스타일 반영 분기 교체 (3개 지점) |
| `src/components/chat/ChatMessage.jsx` | 요약 액션 조건 `mainMode === 'study'` → `isLearningMode(mainMode)` |
| `src/components/admin/RecentConversations.jsx` | `MODE_LABELS`에 `worklearn: '업무학습'` 추가 + study 라벨 "자격증"으로 |
| `src/services/mock/adminMock.js` | worklearn 예시 대화 2건 추가 |

### 영향 범위

- **레이아웃/사이드바**: 모드 3개 표시로 확장. 사이드바가 3개를 수용하는지 확인(현재 `MODE_LIST.map(...)` 로 렌더하므로 자동 대응).
- **어드민 페이지**: 모드 라벨 표기 2곳 ("자격증", "업무학습") 변경 반영.
- **마인드맵**: `lastActiveByMode` 동적 키라 영향 없음. worklearn에서도 마인드맵 사용 가능.
- **기존 localStorage**: `chat-store` v3 → v4 마이그레이션. `study-store`는 이번 태스크와 무관.

---

## 구현 계획

**Phase 1 — 뼈대 (직렬)**
1. `src/registry/modes.js` — `worklearn` 엔트리 + 아이콘 + `isLearningMode` 헬퍼 + study 라벨 "자격증"
2. `src/stores/useWorkLearnStore.js` — notes + checklist + 액션들 + persist v1
3. `src/stores/useChatStore.js` — lastActiveByMode 슬롯 추가 + v3→v4 migrate
4. `src/utils/resetUserStores.js` — worklearn 스토어 초기화 추가

**Phase 2 — UI (직렬)**
5. `src/components/worklearn/WorkLearnMode.jsx` + `WorkLearnSubTabs.jsx` 스켈레톤
6. `src/components/worklearn/WorkNotePanel.jsx` + `WorkNoteEditor.jsx` (카드 리스트 + 편집 모달 + 삭제 팝오버)
7. `src/components/study/ChecklistPanel.jsx` 일반화 (items + onToggleChapter prop)
8. `src/components/worklearn/WorkLearnChecklistPanel.jsx` (사용자 정의 추가/삭제 버튼 포함, 내부에서 `ChecklistPanel` 재사용)
9. 학습 모드의 `ChecklistPanel` 호출부를 일반화 API로 이행

**Phase 3 — 학습 채팅 재사용 + 스타일 확장**
10. `StudyChatTab`에 `mode` / `examples` prop 도입
11. `useStreamingChat`의 style 분기를 `isLearningMode(mode)`로 교체
12. `ChatMessage`의 요약 액션 조건도 동일하게 확장
13. `WorkLearnMode`에서 `StudyChatTab`을 `mode="worklearn"` 예시 질문과 함께 사용

**Phase 4 — 라벨/mock**
14. `admin/RecentConversations`의 `MODE_LABELS` 갱신
15. `adminMock` 소폭 업데이트

**Phase 5 — 문서/QA**
16. 단위 테스트 노트 (아래 시나리오)
17. 회귀 테스트 노트

---

## 단위 테스트 계획

dev 서버(`npm run dev`) 기반 수동 검증. 기록: `.claude/state/evidence/2026-04-22-worklearn-mode-split/unit/notes.md`

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | 사이드바 | 모드가 `일반 / 자격증 / 업무학습` 3개 표시 (아이콘 각각 다름) |
| 2 | 업무학습 모드 진입 | 상단 탭 `[💬 학습 채팅] [📝 업무노트] [✅ 체크리스트]`. 초기는 채팅 탭 |
| 3 | 학습 채팅 | 파인만/요약 스타일 칩 동작. 메시지 전송 시 `[파인만 모드]` 프리픽스가 mock 응답에 반영 |
| 4 | 요약 액션(호버) | worklearn 모드에서도 메시지 호버 시 "✂️ 요약" 버튼 노출 (`isLearningMode`) |
| 5 | 업무노트 — 생성 | "노트 추가" 버튼 → 에디터 모달 → 제목/본문/태그 입력 → 저장 → 카드 리스트에 추가 |
| 6 | 업무노트 — 편집 | 카드 클릭 → 에디터 모달 → 내용 수정 → 저장 → updatedAt 갱신 |
| 7 | 업무노트 — 삭제 | 카드 🗑 → 팝오버 확인 → 삭제 |
| 8 | 체크리스트 — 프로젝트 추가 | "프로젝트 추가" 입력 → 빈 프로젝트 카드 생성 |
| 9 | 체크리스트 — 항목 추가/토글 | 프로젝트 카드 내 "항목 추가" → 체크박스 토글 |
| 10 | 새로고침 후 | 업무노트·체크리스트 persist 복원 |
| 11 | 모드 전환 격리 | 일반 ↔ 자격증 ↔ 업무학습 간 대화 복원 (`lastActiveByMode[worklearn]` 동작) |
| 12 | 마인드맵 | 업무학습에서도 마인드맵 토글 가능 |
| 13 | 로그아웃 | `resetUserStores()`로 worklearn 스토어 + localStorage 정리 |
| 14 | 어드민 페이지 | 최근 대화에 "자격증" / "업무학습" 라벨 표기 |
| 15 | 기존 v3 `chat-store` 마이그레이션 | `lastActiveByMode`에 `worklearn: null` 주입 |

## 회귀 테스트 계획

이번 변경과 무관한 기능 확인. 기록: `.claude/state/evidence/2026-04-22-worklearn-mode-split/regression/notes.md`

- **일반 모드 채팅** — 메시지 송수신, 즐겨찾기, 삭제
- **자격증 모드(study)** — 과목 드롭다운(SQLP/DAP/정보관리기술사/custom), 퀴즈 풀이, 오답노트, 체크리스트(기존 과목별 분리 유지), 통계
- **마인드맵** — 자격증 모드와 일반 모드에서 토글 on/off
- **문서 업로드(사이드바)** — 모달 동작
- **로그인/로그아웃** — resetUserStores 정상
- **사이드바 접기/펼치기**
- **모드 전환** — 일반 ↔ 자격증 ↔ 업무학습 간 lastActiveByMode 복원
