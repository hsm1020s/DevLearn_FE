# 설계: 2026-04-22-study-subject-axis-work-split

**생성:** 2026-04-22 10:01
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-22-study-subject-axis-work-split
**브랜치:** task/2026-04-22-study-subject-axis-work-split

## 목표
학습모드의 4가지 KPI 타겟(SQLP · DAP · 정보관리기술사 · 회사업무학습)이 **하나의 단일 파이프라인에 눌려 있는** 현 구조를 두 축으로 갈라낸다.

1. **자격증 3종(SQLP · DAP · 정보관리기술사)은 `subject` 축으로 추상화** — 학습 모드 내부에 과목 레이어를 도입해 오답노트·체크리스트·통계·예시질문·모의고사 프리셋이 과목별로 분리되도록 한다. 퀴즈/오답/통계 루프는 그대로 재사용.
2. **회사업무학습은 별도 모드(`worklearn`)로 분리** — 본질이 "자격시험 문제 풀이"가 아니라 "실무 지식 정리·반복 학습"이므로, 퀴즈 탭 대신 **업무노트 + 사용자 정의 체크리스트**를 중심 탭으로 가진다. 스타일 칩(파인만/요약)과 학습 채팅은 공유.

**이 태스크의 스코프는 "설계 + 뼈대"까지**. 실제 데이터 이관·버그 수정·세부 튜닝은 후속 태스크에서 통합 처리한다. (사용자 지시: "버그는 나중에 통채로 수정")

### 비(非)목표
- 백엔드 API의 `subject` 파라미터 실제 구현. 이번엔 FE만 보내고 BE는 무시해도 되도록 **선택 파라미터**로 둠. BE 스키마는 다음 태스크.
- 자격증 실제 기출 데이터베이스 구축. 과목별 메타(프리셋·예시질문·기본 체크리스트)만 정의.
- 데이터 마이그레이션 UX. 기존 localStorage `study-store`는 `custom` 과목으로 흡수하는 자동 마이그레이션만 제공.

---

## 설계 결정 (핵심 방향)

### A. Subject 축 — 학습 모드 내부 추상화

**핵심 아이디어:** "학습 모드"는 컨테이너, "과목(subject)"은 그 안의 세션 네임스페이스.

```
useAppStore.mode = 'general' | 'study' | 'worklearn'
useStudyStore.activeSubject = 'sqlp' | 'dap' | 'eng' | 'custom'
useStudyStore.subjects = {
  sqlp: { studyDocs, wrongAnswers, checklist, stats, currentQuiz, ... },
  dap:  { ... },
  eng:  { ... },  // 정보관리기술사
  custom: { ... }, // 사용자 업로드 PDF 기타
}
```

- **현재 루트에 흩어진 필드**(`studyDocs`, `wrongAnswers`, `checklist`, `stats`, `currentQuiz`, `currentQuestionIndex`, `answers`, `studyStep`, `quizPaused`, `quizSeed`, `quizTimerSec`)를 **과목별 네임스페이스 안으로 이동**.
- **과목 독립 필드** — `chatStyle`, `chatStyleLocked`는 학습 모드 전역(과목 공유).
- **셀렉터 헬퍼 제공** — `useActiveSubject()`, `getSubject(id)`. 기존 호출 지점은 `store.wrongAnswers` → `store.subjects[active].wrongAnswers` 로 바뀌는데, 호출부 수정 비용을 줄이기 위해 **shallow selector 훅**을 제공.
- **모의고사 프리셋·예시질문·기본 체크리스트**는 과목 카탈로그(`SUBJECT_CATALOG`)에 정의하고 subject 스토어가 참조.

**왜 모드 분리가 아니라 과목 축인가?**
자격증 3종은 "PDF → 퀴즈 → 오답 → 통계" 루프가 동일. 모드로 쪼개면 코드 3중 복사. 네임스페이스 한 겹만 추가하는 편이 유지·확장·추가 자격증 대응에 유리.

### B. 업무학습(`worklearn`) — 별도 모드로 분리

**왜 분리인가?**
- 업무학습은 정답이 있는 문제 풀이가 아니라 **실무 지식 기록 + 반복 학습 + 체크리스트**. 퀴즈 탭이 구조적으로 어색함.
- 평가 메트릭이 "정답률"이 아니라 "완료율·재방문·메모 누적"에 가까움.
- 자격증 과목 축에 `work`를 추가하면 퀴즈 UI가 불필요하게 노출되고 통계 스키마가 오염됨.

**`worklearn` 모드 구성:**

```
[💬 학습 채팅] [📝 업무노트] [✅ 체크리스트]
```

| 탭 | 역할 |
|------|------|
| 학습 채팅 | 학습 모드와 동일한 스타일 칩(일반/파인만/요약). 공통 컴포넌트 `StudyChatTab` 재사용 — `mode` prop만 다름 |
| 업무노트 | 업무별 노트 카드 리스트 — 제목·본문(마크다운)·태그·링크·첨부. 사용자가 자유롭게 추가/편집 |
| 체크리스트 | 업무별 체크리스트 — 사용자 정의 프로젝트·단계별 할 일. 자격증 체크리스트와 동일 UI 재사용(`ChecklistPanel`) |

**공유 컴포넌트:**
- `StudyStyleChips`, `StudyChatTab`(스타일 칩은 모드에 무관하게 재사용)
- `ChecklistPanel`(데이터 소스만 다른 스토어)
- 빈 화면 3카드 런처(`StudyHomeCards` 일반화)

**신규 스토어:** `useWorkLearnStore` — 업무노트·체크리스트·문서 링크 관리.

### C. 모드 레지스트리 변경

```js
// src/registry/modes.js
export const MODES = {
  general:   { value: 'general',   label: '일반',     icon: Search,   component: ChatContainer },
  study:     { value: 'study',     label: '자격증',   icon: GraduationCap, component: StudyMode },
  worklearn: { value: 'worklearn', label: '업무학습', icon: Briefcase,     component: WorkLearnMode },
};
```

- 현재 `study` 라벨이 "학습"인데, 업무학습과 구분하기 위해 **"자격증"으로 다시 변경**. (4/21 rename의 일부를 되돌리는 셈이지만 의도가 명확해짐)
- `worklearn` key는 과거 삭제된 `work`(RAG 업로드 모드)와 의미가 다름을 드러내기 위해 다른 이름을 씀. localStorage 충돌도 회피.

### D. 과목 카탈로그

```js
// src/registry/subjects.js (신규)
export const SUBJECT_CATALOG = {
  sqlp: {
    id: 'sqlp',
    label: 'SQLP',
    description: 'SQL 전문가',
    examPreset:    { count: 40, difficulty: 'mixed', timerSec: 90 * 60 }, // 90분
    examples: [
      '옵티마이저 실행 계획 읽는 법 알려줘',
      'B-Tree 인덱스와 비트맵 인덱스 차이 설명해줘',
      '조인 수행 원리 정리해줘',
    ],
    checklist: [ /* SQLP 기본 챕터 시드 */ ],
  },
  dap: {
    id: 'dap',
    label: 'DAP',
    description: '데이터아키텍처 전문가',
    examPreset:    { count: 50, difficulty: 'mixed', timerSec: 100 * 60 }, // 100분
    examples: [
      '정규화와 반정규화 판단 기준',
      '데이터 표준화 절차',
      '주제영역 도출 방법',
    ],
    checklist: [ /* DAP 기본 챕터 시드 */ ],
  },
  eng: {
    id: 'eng',
    label: '정보관리기술사',
    description: '정보관리기술사(논술·면접)',
    // 교시제 시험이므로 과목별 타이머 설정 없음. 모의고사 프리셋은 논술 1교시 기준.
    examPreset: { count: 4, difficulty: 'hard', timerSec: 100 * 60 },
    examples: [
      'MSA 전환 전략 논술 개요 잡아줘',
      '데이터 거버넌스 체계 핵심 토픽',
      'AI 전환(AX) 단계별 접근법',
    ],
    checklist: [ /* 정보관리기술사 토픽 시드 */ ],
  },
  custom: {
    id: 'custom',
    label: '기타/사용자 정의',
    description: '사용자가 직접 업로드한 PDF 기반 학습',
    examPreset: { count: 30, difficulty: 'mixed', timerSec: 30 * 60 }, // 기존 기본값
    examples: [
      '핵심 개념 3개로 요약해줘',
      '이 문서의 토픽을 트리로 정리해줘',
    ],
    checklist: [], // 사용자가 직접 만든다
  },
};
```

상수는 `constants.js`가 아닌 **별도 레지스트리**로 분리 (모드 레지스트리와 같은 패턴 — 과목 추가 시 이 파일만 수정).

### E. 데이터 마이그레이션 (기존 study-store → subject 축)

```js
// useStudyStore persist version: 2 → 3
migrate(persisted, version) {
  if (version < 3) {
    const legacy = persisted || {};
    return {
      activeSubject: 'custom',
      subjects: {
        sqlp:   emptySubjectState(),
        dap:    emptySubjectState(),
        eng:    emptySubjectState(),
        custom: {
          studyDocs:    legacy.studyDocs    || [],
          wrongAnswers: legacy.wrongAnswers || [],
          checklist:    legacy.checklist    || [],
          stats:        legacy.stats        || defaultStats(),
        },
      },
      chatStyleLocked: legacy.chatStyleLocked ?? false,
    };
  }
  return persisted;
}
```

- 기존 사용자 데이터는 `custom` 과목 버킷으로 이동 → 데이터 소실 없음
- 최초 진입 시 `activeSubject = 'custom'`으로 시작 (사용자가 과목 선택기에서 교체)

### F. UI 통합 — 과목 선택기 위치

- **`StudySubTabs` 좌측에 과목 드롭다운** 배치. 탭 바와 같은 row.
  ```
  [SQLP ▼]  [💬 학습 채팅] [🎯 퀴즈] [📚 기록]
  ```
- 과목 전환 시 현재 퀴즈 세션이 있으면 **경고 팝오버**("진행 중 퀴즈는 유지됩니다" — 과목별 독립 관리이므로 실제로는 문제 없음).
- 빈 화면(`StudyHomeCards`)에서는 3카드 위에 **과목 선택 가이드**.

---

## 변경 범위

### 신규 파일

| 경로 | 역할 |
|------|------|
| `src/registry/subjects.js` | 과목 카탈로그 — 프리셋·예시질문·기본 체크리스트 |
| `src/components/study/SubjectSelector.jsx` | 과목 드롭다운 (StudySubTabs 좌측) |
| `src/components/worklearn/WorkLearnMode.jsx` | 업무학습 모드 루트 |
| `src/components/worklearn/WorkLearnSubTabs.jsx` | 상단 탭 바 (채팅/노트/체크리스트) |
| `src/components/worklearn/WorkNotePanel.jsx` | 업무노트 카드 리스트 + 편집 |
| `src/components/worklearn/WorkNoteEditor.jsx` | 노트 편집 모달(제목·본문·태그) |
| `src/stores/useWorkLearnStore.js` | 업무학습 전용 스토어 (notes, checklist) |
| `src/hooks/useActiveSubject.js` | 현재 과목 상태 조회 셀렉터 훅 |

### 수정 파일

| 경로 | 변경 |
|------|------|
| `src/registry/modes.js` | `worklearn` 엔트리 추가, `study` 라벨 "자격증"으로 변경, 아이콘 분리 |
| `src/stores/useStudyStore.js` | **subject 축으로 구조 변경** — `subjects[id]` 네임스페이스, 모든 액션을 active subject에 대해 동작하도록 수정, persist v3 migrate |
| `src/components/study/StudySubTabs.jsx` | 좌측에 `SubjectSelector` 삽입 |
| `src/components/study/StudyWorkspace.jsx` | 과목 없을 때 빈 상태 처리 (과목 선택 안내) |
| `src/components/study/StudyQuizTab.jsx` | `generateQuiz` 호출 시 `subject` 파라미터 추가, 프리셋을 `SUBJECT_CATALOG[active].examPreset`에서 로드 |
| `src/components/study/QuizSettings.jsx` | 모의고사 프리셋 버튼이 과목별 설정 반영 |
| `src/components/study/ChecklistPanel.jsx` | 체크리스트 소스를 prop으로 받도록 일반화 (study/worklearn 공용) |
| `src/components/study/WrongAnswerPanel.jsx` | 현재 과목 오답만 표시 |
| `src/components/study/StudyStatsPanel.jsx` | 현재 과목 통계만 표시, 헤더에 과목명 |
| `src/components/study/StudyChatTab.jsx` | 예시 질문을 `SUBJECT_CATALOG[active].examples`에서 로드. `mode` prop 받아 worklearn에서도 재사용 가능 |
| `src/components/study/StudyHomeCards.jsx` | "과목을 먼저 선택하세요" 배너 + 3카드 |
| `src/components/layout/MainContent.jsx` | `worklearn` 모드 컴포넌트 dynamic import |
| `src/services/studyApi.js` | 모든 함수에 `subject` 선택 파라미터 추가 (`generateQuiz`, `getStudyStats`, `submitAnswer`) |
| `src/services/mock/studyMock.js` | `subject` 파라미터 받아 응답에 에코. 문제 텍스트에 과목 라벨 포함 (시연용) |
| `src/utils/constants.js` | `EXAM_PRESET` 삭제(과목별로 분산). 다른 상수는 유지 |
| `src/utils/resetUserStores.js` | `worklearn-store` 초기화 추가, legacy `study-store` v2 키 자동 마이그레이션 보장 |

### 영향 범위

- **학습 모드 내부 대규모 변경**이지만 **기능 삭제 없음**. 구조만 재배치.
- 마인드맵·사이드바·일반 모드·로그인/어드민: 영향 없음 (사이드바 모드 목록이 3개가 됨 → 사이드바 레이아웃 확인 필요).
- 기존 localStorage 데이터는 `custom` 과목으로 흡수 → 데이터 소실 없음.

---

## 구현 계획

규모가 크므로 **2개 서브태스크로 분할 권장**:

### 서브태스크 1 — Subject 축 추상화 (학습 모드 내부) ✅ 우선
1. `SUBJECT_CATALOG` 정의 (`src/registry/subjects.js`)
2. `useStudyStore` 구조 변경 + v3 마이그레이션 + 셀렉터 훅
3. `SubjectSelector` UI + `StudySubTabs` 통합
4. 탭·패널들을 active subject 기반으로 리팩터 (`StudyChatTab`, `StudyQuizTab`, `StudyRecordTab` 산하 전부)
5. `studyApi`에 `subject` 파라미터 추가 + mock 에코
6. 단위 테스트 (아래 표)

### 서브태스크 2 — 업무학습 모드 분리
1. `useWorkLearnStore` 생성 (notes + checklist)
2. `WorkLearnMode` + `WorkLearnSubTabs` + `WorkNotePanel` + `WorkNoteEditor`
3. `ChecklistPanel` 일반화 (데이터 소스 prop 화)
4. `StudyChatTab` 재사용 (mode prop)
5. `modes.js` + `MainContent.jsx` 에 엔트리 추가
6. 단위 테스트

**이번 태스크에서는 설계 문서 확정 + 서브태스크 1 구현**까지 진행. 서브태스크 2는 다음 태스크로 분리해 별도 `phase-start`.

### 단계별 순서 (서브태스크 1 기준)

**Phase 1 — 스토어/레지스트리 스켈레톤 (직렬)**
1. `src/registry/subjects.js` 작성 (카탈로그 4종)
2. `useStudyStore` 구조 변경 + v3 migrate + 기존 액션을 active subject 대상으로 수정
3. `useActiveSubject` 훅 작성
4. `resetUserStores.js` 업데이트

**Phase 2 — UI 통합 (직렬 위주, 독립 컴포넌트는 병렬 가능)**
1. `SubjectSelector` 컴포넌트
2. `StudySubTabs` 좌측에 셀렉터 삽입
3. 각 패널을 active subject 데이터로 구독하도록 수정
   - `StudyChatTab` (예시 질문)
   - `StudyQuizTab` + `QuizSettings` (프리셋)
   - `WrongAnswerPanel`, `ChecklistPanel`, `StudyStatsPanel` (데이터 소스)
4. `StudyHomeCards` 안내 배너

**Phase 3 — API 파라미터 (직렬)**
1. `studyApi` 함수 시그니처에 `subject` 추가 (backwards-compatible)
2. `studyMock` 에코 구현
3. 호출부(`StudyQuizTab`, `StudyStatsPanel` 등)에서 `subject` 전달

**Phase 4 — 문서/테스트**
1. `PROJECT_MAP.md`, `FEATURES.md` 업데이트
2. 단위 테스트 노트 작성

---

## 단위 테스트 계획

dev 서버(`npm run dev`) 기반 수동 검증. 기록 위치: `.claude/state/evidence/2026-04-22-study-subject-axis-work-split/unit/notes.md`

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | 신규 사용자로 학습 모드 진입 | 과목 드롭다운이 `SQLP`(또는 기본값)로 초기화. 빈 상태 3카드 표시 |
| 2 | 기존 localStorage(v2)가 있는 사용자 | `custom` 과목으로 마이그레이션되어 기존 오답·체크리스트·통계 유지 |
| 3 | 과목을 SQLP → DAP로 전환 | 오답노트/체크리스트/통계가 DAP 네임스페이스로 즉시 교체 |
| 4 | SQLP에서 퀴즈 세션 진행 중 → DAP로 전환 → 다시 SQLP | SQLP 퀴즈 세션 그대로 재개 |
| 5 | 과목별 모의고사 프리셋 클릭 (SQLP) | `count=40, timerSec=90*60`으로 퀴즈 시작 |
| 6 | 과목별 모의고사 프리셋 (DAP) | `count=50, timerSec=100*60` |
| 7 | 각 과목에서 빈 상태의 예시 질문 | SQLP면 "옵티마이저…", DAP면 "정규화와…" 표시 |
| 8 | 체크리스트 토글을 SQLP·DAP 각각에서 수행 | 독립 관리됨 (교차 오염 없음) |
| 9 | 퀴즈 완료 후 통계 반영 | 해당 과목 통계에만 누적. 다른 과목 통계 불변 |
| 10 | 네트워크 탭에서 `generateQuiz` 요청 | `subject` 필드가 payload에 포함 |
| 11 | 새로고침 후 | `activeSubject`, 각 과목 상태 모두 persist에서 복원 |
| 12 | 로그아웃 → 다른 계정 로그인 | 과목 상태 초기화(`reset()` 호출) |

---

## 회귀 테스트 계획

이번 변경과 무관한 기능 확인. 기록: `.claude/state/evidence/2026-04-22-study-subject-axis-work-split/regression/notes.md`

- **일반 모드 채팅** — 메시지 송수신, 즐겨찾기/삭제, 스트리밍 정상
- **마인드맵** — 학습 모드 마인드맵이 과목과 독립적으로 유지되는지 (기존 `useMindmapStore`가 `mode` 축만 사용 — 과목 축과 충돌 없음 확인)
- **문서 업로드(사이드바)** — 모달·업로드·진행률
- **로그인/로그아웃** — `resetUserStores()`가 v3 스토어 구조에서도 정상 초기화
- **사이드바 접기/펼치기** — 모드 3개 상태에서 레이아웃 안정
- **모드 전환** — 일반 ↔ 학습 ↔ (업무학습은 서브태스크 2 이후) 간 전환 시 채팅 격리 유지(`lastActiveByMode` 패턴)
- **어드민 페이지** — 최근 대화 목록에 `학습(자격증)` 라벨 정상 노출
