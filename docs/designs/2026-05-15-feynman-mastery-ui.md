# 설계: 2026-05-15-feynman-mastery-ui

**생성:** 2026-05-15 17:28
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-15-feynman-mastery-ui
**브랜치:** task/2026-05-15-feynman-mastery-ui

## 목표
[1줄 요약] 2단계에서 BE 가 SSE done 페이로드에 동봉하기 시작한 챕터 마스터리 진행도(`meta.progress = {total, mastered, complete, currentNodeId, currentNodeLabel}`) 를 FE 가 실제로 화면에 표시한다. 파인만 채팅 패널 헤더에 진행 바(`m/N 노드 통과`) 를 그려서 사용자가 챕터 학습이 얼마나 남았는지 한눈에 보게 하고, 모든 노드를 통과(`complete=true`) 했을 때 "🎉 챕터 마스터 완료" 카드 + 다음 행동 버튼(다른 챕터 / 같은 챕터 계속) 을 띄운다.

### 본 태스크가 해결하는 사용자 의도
- "챕터를 다 익히는 과정처럼 만들고 싶다" — 진행도 시각화로 학습 의식이 살아남.
- 마스터 도달 시 명확한 "끝났다" 신호 제공 — 끝없이 같은 질문이 도는 것이 아니라 분명한 완료 경험.

### 본 태스크가 다루지 않는 것 (의도적 스코프 축소)
- **마인드맵 노드 ✓ 마커 / 현재 노드 펄스 하이라이트** — 마인드맵 패널은 파인만 채팅과 다른 탭에 있어서 진행도 store 분리 + 노드 컬러 패치 등 변경이 분산됨. 후속 `feynman-mindmap-mastery-overlay` 로 분리.
- **챕터 진행도 영구 표시 (사이드바 챕터 목록 옆 진행 바)** — 현재 메시지 메타에 진행도가 들어오는 구조라, 현재 활성 챕터 외에는 데이터가 없음. 별도 `getMasteryProgress` REST 엔드포인트가 생기면 후속에서.
- **"재도전" 버튼의 점수 reset** — BE 측 `answer_attempts` 삭제가 필요한 운영 액션. 본 단계의 "재도전" 은 단순 카드 닫기 + 같은 챕터 계속(이미 통과한 노드는 더 안 나옴).

## 변경 범위

### FE (`/Users/moon/DevLearn_FE`)

**1. 신규 훅 — `src/hooks/useFeynmanProgress.js`**
- 활성 파인만 conversation 의 마지막 assistant 메시지에서 `meta.progress` 를 추출해 반환.
- 반환 형태:
  ```ts
  {
    total: number,
    mastered: number,
    complete: boolean,
    currentNodeId: string | null,
    currentNodeLabel: string | null,
  } | null   // 진행도 데이터가 없거나 폴백 챕터(total=0) 면 null
  ```
- 입력: `conversationId` (또는 현재 패널의 conversation id). null 이면 null 반환.
- 구현: `useChatStore` 셀렉터로 `messages` 가져온 뒤 마지막 assistant 의 `meta.progress` 반환. `total === 0` 이면 진행도 표시 의미 없으니 null 반환.

**2. 신규 컴포넌트 — `src/components/feynman/MasteryProgressBar.jsx`**
- props: `progress` (위 훅 반환값 또는 null).
- 렌더:
  - `progress == null` → 렌더 자체 안 함.
  - `complete=true` → 작은 트로피 아이콘 + "🎉 챕터 마스터 (N/N)" 텍스트, 바 100% 채움(success 색).
  - 그 외 → "m/N 노드 통과" 텍스트 + 가로 progress bar (`width: (m/N*100)%`).
  - 현재 출제 중인 노드 라벨 (`currentNodeLabel`) 이 있으면 작은 회색 텍스트로 옆에 노출 ("· 현재: 트랜잭션 격리 수준").
- 색상: `bg-primary` (진행), `bg-success` (완료). 폰트 `text-xs`. globals.css 의 디자인 토큰 사용.

**3. 신규 컴포넌트 — `src/components/feynman/MasteryCompleteCard.jsx`**
- props: `progress`, `onReset` (다른 챕터 선택 콜백), `onDismiss` (카드 닫기 콜백).
- 렌더 조건: 상위에서 `progress?.complete === true && !dismissed` 일 때만 mount.
- 내용:
  - 큰 🎉 + "챕터 마스터 완료!" + "N개 핵심 개념을 모두 통과했어요."
  - 버튼 2개:
    - "다른 챕터 선택" → `onReset()` (FeynmanChatPane 에서 `setFeynmanSession(mode, null, null)` 호출)
    - "이 챕터 계속" → `onDismiss()` (카드 닫기, 채팅 계속 가능)
- 카드는 채팅 본문 위에 오버레이 (absolute, semi-transparent 배경), 클릭 시 닫힘.

**4. `FeynmanChatPane` 통합** — `src/components/study/FeynmanChatPane.jsx`
- 패널 헤더 바로 아래에 `<MasteryProgressBar progress={progress} />` 한 줄 추가.
- 채팅 영역 위에 `<MasteryCompleteCard ... />` 조건부 오버레이.
- `progress` 는 `useFeynmanProgress(feynmanConversationId)` 로 구독.
- `dismissed` 는 로컬 useState — 챕터 변경 시 자동 reset (`useEffect [feynmanChapter]`).
- "다른 챕터 선택" 시 기존 `setFeynmanSession(mode, null, null)` + 채팅 리스트는 그대로 두고 챕터만 해제.

**5. 메시지 카드 안에 작은 진행도 뱃지 (선택)**
- 본 단계에서는 헤더 진행 바로 충분 — 메시지마다 뱃지 표시는 시야 분산. 스킵.

### BE
변경 없음. 본 태스크는 FE 시각화만.

## 구현 계획

### Step A — 훅
1. `useFeynmanProgress.js` 작성 + JSDoc. `useChatStore` 의 selector 로 메시지 배열을 받아 마지막 assistant 의 meta.progress 반환.

### Step B — 컴포넌트
2. `MasteryProgressBar.jsx` — 진행 바 + 텍스트.
3. `MasteryCompleteCard.jsx` — 완료 카드 + 두 버튼.

### Step C — 통합
4. `FeynmanChatPane.jsx`
   - `useFeynmanProgress(feynmanConversationId)` 구독.
   - 헤더 아래 `MasteryProgressBar` 추가.
   - 채팅 영역에 `MasteryCompleteCard` 조건부 오버레이 + dismiss 상태 관리.
   - 챕터 변경 시 `dismissed` reset.

### Step D — 검증
5. `npm run dev` 가 살아있으면 Vite HMR 로 자동 반영. 죽었으면 `lsof -ti:3000 | xargs kill && npm run dev` 재기동.
6. 브라우저에서 파인만 채팅 진입 → 진행 바 노출 + 더미 시나리오로 progress 변화 확인.

## 단위 테스트 계획

증거: `.claude/state/evidence/2026-05-15-feynman-mastery-ui/unit/notes.md`

**시나리오 A — 진행 바 첫 렌더**
- 노드 매핑된 챕터(예: DAP 의 한 챕터, 마인드맵 보강 완료된 것)로 진입 후 채팅 시작.
- 첫 응답 도착 시 헤더 아래 진행 바가 "0/N 노드 통과" 로 표시.

**시나리오 B — 진행 카운터 증가**
- 같은 챕터에서 70+ 점수로 답변 → 다음 응답에서 진행 바가 "1/N 노드 통과" + width 가 1/N% 로 증가.

**시나리오 C — 챕터 마스터 카드**
- 모든 노드를 70+ 통과 → 진행 바가 "🎉 챕터 마스터 (N/N)" 표시 + 채팅 영역 위 오버레이 카드.
- "이 챕터 계속" 클릭 → 카드 닫힘, 헤더 진행 바는 그대로.
- "다른 챕터 선택" 클릭 → 챕터 picker 화면 (sessionActive=false) 로 전환.

**시나리오 D — 폴백 챕터 (total=0)**
- node_id 가 모두 NULL 인 챕터로 진입 후 답변.
- `useFeynmanProgress` 가 null 반환 → 진행 바 비표시.
- 기존 채팅 UX 100% 동일 (회귀 0).

**시나리오 E — 챕터 전환 시 dismiss 리셋**
- 챕터 A 마스터 → 카드 dismiss → 챕터 B 로 변경.
- 챕터 B 가 다시 마스터 상태가 되면 카드가 다시 표시 (dismissed 상태가 챕터별로 리셋).

## 회귀 테스트 계획

증거: `.claude/state/evidence/2026-05-15-feynman-mastery-ui/regression/notes.md`

**회귀 대상 1**: `GeneralChatPane` (좌측 일반 채팅) — 본 변경은 FeynmanChatPane 만 손댐. 좌측 패널 영향 없음.
**회귀 대상 2**: 일반 채팅 store 의 messages — `meta.progress` 가 추가됐지만 selector/setter 변경 없음. 기존 메시지 렌더 영향 없음.
**회귀 대상 3**: 폴백 챕터 파인만 학습 — `useFeynmanProgress` 가 total=0 이면 null 반환하므로 진행 바 미표시. 기존 UX 유지.
**회귀 대상 4**: 마인드맵 자동 생성 / 채팅 / 문서 업로드 / 인증 — 본 태스크는 FE feynman 패널만, 무관 기능 무영향.

## 위험 / 함정

- **`useFeynmanProgress` 의 selector 비효율**: messages 배열 끝에서 마지막 assistant 만 찾으면 되니 O(n) 이지만 매 렌더마다 reverse scan 은 부담 없음. 큰 conversation 도 100~ 메시지 수준이라 영향 미미.
- **dismissed 상태가 새로고침 시 사라짐**: useState 라서 의도된 동작. 마스터 완료 카드는 챕터별로 한 번씩 보면 충분. localStorage 영구화 불필요.
- **complete=true 인데 사용자가 카드를 닫고 답변 계속 — BE 가 nextQ=null 로 응답하면 추가 진행 안 됨**: 현재 BE 가 complete 시 nextQ=null + "🎉 챕터 마스터 완료" 본문 송출. 사용자가 그 뒤로 메시지를 보내면 streamPreGen 이 또 들어와서 진행도만 다시 가져오고 nextQ=null 그대로 — 본문이 같은 완료 멘트 반복. 거슬릴 수 있으니 카드의 "이 챕터 계속" 보다 "닫기" 의미로 라벨 변경 검토. 본 단계에서는 "이 챕터 계속" 유지하고 후속 UX 보강에 위임.
- **`currentNodeLabel` 가 노드의 `concept` 컬럼값 (= 노드 label)**: 기존 마인드맵 노드와 일관됨. 폴백(concept-based) 질문이면 BE 가 `currentNodeLabel = concept = "Pass1 추출 concept"` 을 보낼 수 있음. 사용자 입장에서도 의미 있는 문자열이라 OK.
