# 설계: 2026-04-21-mindmap-tts

**생성:** 2026-04-21 14:17
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-21-mindmap-tts
**브랜치:** task/2026-04-21-mindmap-tts

## 목표
마인드맵의 모든 노드 텍스트를 브라우저 내장 음성 합성(`window.speechSynthesis`)으로 읽어주고, 현재 읽고 있는 노드를 시각적으로 하이라이트한다.

### 기능 요구사항

1. **BFS 순회로 읽기** — 루트 → 1뎁스(전체) → 2뎁스(전체) 순.
2. **부모 컨텍스트 안내** — 각 뎁스 진입 시 "X의 하위 내용은 A, B, C가 있습니다" 식으로 자식 목록을 먼저 읽고, 이어서 각 자식의 `label` 을 순차 낭독.
3. **시각적 하이라이트** — 현재 읽고 있는 노드에 기존 `selected` 스타일과 구분되는 색(예: `--color-highlight-tts`)으로 테두리+배경 강조. 낭독이 끝난 노드는 원상복구.
4. **재생 제어** — 재생 / 일시정지 / 정지 3단 토글. 정지 시 하이라이트 즉시 제거.
5. **접힌 노드 스킵** — `collapsed=true` 인 노드의 후손은 읽지 않고 건너뜀. (사용자가 의도적으로 접은 것)
6. **비어있는 label 스킵** — `label` 이 빈 문자열인 노드는 건너뛰되, 하위 노드는 읽기.
7. **재생 중 맵 전환 차단 안 함** — 단, 맵이 바뀌거나 노드가 삭제되면 즉시 정지.

### 비-목표 (이번 작업에선 안 함)
- 노드 `description` 읽기 (1차에서는 `label` 만)
- 속도/목소리 선택 UI (기본값 rate=1.0, 한국어 음성 자동 선택)
- 일시정지 후 다른 노드로 점프하는 UI
- 오디오 파일 다운로드

### 낭독 문구 포맷 (확정 — 옵션 B)

```
[루트]       "{rootLabel}"
[1뎁스 진입] "{rootLabel}의 하위 내용은 {child1}, {child2}, {child3}"
[1뎁스 낭독] 각 자식 label을 한 번씩
[2뎁스 진입] (자식 노드별로 분리 낭독)
            "{child1}의 하위 내용은 {grandchild1}, {grandchild2}"
            각 손자 label 낭독
            "{child2}의 하위 내용은 ..." → 반복
```

- 자식이 없는 노드는 "하위 내용" 문장을 말하지 않고 넘어간다.
- 조사 처리 불필요. "X의 하위 내용은 A, B, C" 에서 끊고 끝. "이 있습니다" / "이(가)" 등 종결 조사 생략 → 종성 판별 로직 필요 없음.

## 변경 범위

### 수정할 파일

| 파일 | 변경 |
|------|------|
| `src/stores/useMindmapStore.js` | TTS 상태 필드 추가: `playingNodeId`, `ttsStatus` (`'idle' \| 'playing' \| 'paused'`), setter 3개 (`setPlayingNode`, `setTtsStatus`, `resetTts`). localStorage 마이그레이션 영향 없음(FE-only, persist 제외 가능하지만 어차피 전환 시 idle로 리셋하면 됨 → 일단 persist에 포함시키되 스토어 rehydrate 직후 `resetTts()` 호출). |
| `src/styles/globals.css` | `--color-highlight-tts` 변수 추가 (라이트/다크 모두) |
| `src/components/mindmap/MindmapNode.jsx` | `isPlaying` prop 기반 하이라이트 클래스 추가. `selected` 보다 우선순위 높게. |
| `src/components/mindmap/MindmapCanvas.jsx` | 노드 data에 `isPlaying` 주입 (`playingNodeId === n.id`). ReactFlow 노드 재생성 최소화 위해 useMemo deps에 `playingNodeId` 추가. |
| `src/components/mindmap/MindmapControls.jsx` | 우측 하단 컨트롤에 TTS 버튼 그룹 (재생/일시정지/정지) 추가 |
| `src/components/mindmap/MindmapPanel.jsx` | 맵 전환 / 맵 삭제 시 `resetTts()` 호출 |

### 새로 만들 파일

| 파일 | 역할 |
|------|------|
| `src/utils/mindmapTts.js` | **순수 로직**: BFS 순회로 낭독 스크립트 배열 생성. 입력=nodes, 출력=`[{ text, nodeId }]` 배열. 하이라이트할 노드 ID를 각 문장에 매핑. 테스트 가능하도록 분리. |
| `src/hooks/useMindmapTts.js` | **실행 엔진**: 스크립트 배열을 받아 `SpeechSynthesisUtterance` 를 순차 재생. `onstart`/`onend` 콜백으로 스토어의 `playingNodeId` 업데이트. 재생/일시정지/정지/cleanup 로직. |

## 구현 계획

### 단계 1 — 낭독 스크립트 생성 로직 (`src/utils/mindmapTts.js`)

```javascript
/**
 * @fileoverview 마인드맵 노드 배열 → TTS 낭독 스크립트 변환.
 * BFS 순회 + 부모 컨텍스트 안내 문구 삽입.
 */

/**
 * @param {Array} nodes - flat node array ({ id, label, parentId, collapsed })
 * @returns {Array<{ text: string, nodeId: string|null }>}
 *   nodeId=null 이면 "하위 내용은 ..." 안내 문장 (하이라이트 없음)
 *   nodeId!=null 이면 해당 노드 label 낭독 중 → 하이라이트 대상
 */
export function buildTtsScript(nodes) { ... }
```

로직:
1. `childrenMap = Map<parentId, Array<node>>` 구축. `collapsed=true` 인 노드의 children은 childrenMap에 넣지 않음 (skip 효과).
2. root = `nodes.find(n => n.parentId == null)`. 없으면 빈 배열 반환.
3. BFS 큐: `[root]` 에서 시작.
4. 현재 노드 꺼낼 때마다:
   - (루트는 예외) 부모 컨텍스트 안내는 **이미 부모 처리 시점에 삽입됨**.
   - 본인 label 낭독 엔트리 push: `{ text: label, nodeId: id }`.
   - children이 있으면: `{ text: "${label}의 하위 내용은 ${children.map(c=>c.label).join(', ')}", nodeId: null }` push. 이어서 children을 큐 끝에 추가.
5. 빈 label인 노드는 label 낭독 엔트리는 생략하되, 부모 컨텍스트 안내 문구에서는 label이 비어있으면 "(이름 없음)" 으로 표기.

**주의**: 사용자가 원한 "1뎁스 쫙 → 2뎁스 쫙" 순서를 지키려면 **순수 BFS** 여야 한다. DFS 로 하면 "1의 자식들 먼저, 그 다음 2의 자식들" 이 되어 2뎁스가 섞여 읽힘. 사용자 기대와 맞도록 순수 BFS 큐 사용.

단, "부모 컨텍스트 안내 문구" 는 각 노드 처리 시 함께 들어가므로, 실제 재생 순서는:
```
루트 → "루트의 하위 내용은 ..." → 1뎁스[1] → 1뎁스[2] → ... → 1뎁스[1]의 하위 안내 → 2뎁스[1-1], 2뎁스[1-2] → 1뎁스[2]의 하위 안내 → 2뎁스[2-1] ...
```

이게 사용자가 말한 "1뎁스 쫙 읽고 2뎁스 쫙 읽고, 대신 2뎁스 읽을 때는 1뎁스의 하위내용은 7이 있고 이런식으로" 와 부합.

### 단계 2 — 재생 엔진 훅 (`src/hooks/useMindmapTts.js`)

```javascript
/**
 * @fileoverview 마인드맵 TTS 재생 훅. 브라우저 SpeechSynthesis API 래핑.
 */
export function useMindmapTts() {
  const { activeMapId, getActiveMap, setPlayingNode, setTtsStatus, ttsStatus } = useMindmapStore(...);
  const scriptRef = useRef([]);
  const indexRef = useRef(0);
  const utteranceRef = useRef(null);

  const play = useCallback(() => { ... });  // idle→playing 또는 paused→playing (resume)
  const pause = useCallback(() => { ... }); // speechSynthesis.pause()
  const stop = useCallback(() => { ... });  // speechSynthesis.cancel(), resetTts()
  
  // cleanup: 언마운트 / 맵 변경 / 탭 숨김 시 stop
  useEffect(() => () => stop(), []);
  useEffect(() => { stop(); }, [activeMapId]);
  
  return { play, pause, stop, status: ttsStatus };
}
```

핵심 로직:
- `play()`:
  - `ttsStatus === 'paused'` 면 `speechSynthesis.resume()` 호출.
  - `ttsStatus === 'idle'` 면 script 빌드 후 재생 시작.
  - 한국어 voice 탐색: `speechSynthesis.getVoices().find(v => v.lang.startsWith('ko'))`, 없으면 default.
  - 각 utterance에 `onstart`/`onend` 달아서 `setPlayingNode(entry.nodeId)` / 다음 문장으로 진행.
  - 마지막 문장 끝나면 `resetTts()`.
- `pause()`: `speechSynthesis.pause()` + `setTtsStatus('paused')`. 하이라이트는 **유지** (재개 시 연속성).
- `stop()`: `speechSynthesis.cancel()` + `setPlayingNode(null)` + `setTtsStatus('idle')` + `indexRef.current = 0`.

**Chrome 특이사항**: `speechSynthesis` 는 탭이 백그라운드로 가면 pause됨. 복귀 시 자동 재개되지만, 긴 시리즈에서는 ~15초 후 자동 중단되는 버그가 있음 → **각 utterance를 개별 발화로 쪼개서 이미 대응됨** (이 전략이 우회 방법).

**voice 로딩 비동기**: Chrome은 `getVoices()` 가 처음 빈 배열 반환 → `voiceschanged` 이벤트 대기. 훅에서 한 번 초기화 후 캐시.

### 단계 3 — 스토어 확장 (`useMindmapStore.js`)

```javascript
// 추가할 상태
playingNodeId: null,
ttsStatus: 'idle',

// 추가할 액션
setPlayingNode: (nodeId) => set({ playingNodeId: nodeId }),
setTtsStatus: (status) => set({ ttsStatus: status }),
resetTts: () => set({ playingNodeId: null, ttsStatus: 'idle' }),
```

persist 설정에서 `playingNodeId`, `ttsStatus` 는 제외(`partialize`)하거나, 포함시키더라도 rehydrate 후 명시적으로 초기화. → **persist 제외 권장** (세션 간 이어지는 상태 아님).

맵 변경/삭제 시 `resetTts()` 호출:
- `setActiveMapId()` 내부 시작 시
- `deleteMap()` 내부 시작 시
- `deleteNode()` 에서 현재 재생 중인 노드가 삭제되면 stop

### 단계 4 — 노드 하이라이트 스타일 (`globals.css`, `MindmapNode.jsx`)

`globals.css`:
```css
:root {
  --color-highlight-tts-bg: rgba(255, 200, 80, 0.25);
  --color-highlight-tts-border: #E8A33C;
}
[data-theme="dark"] {
  --color-highlight-tts-bg: rgba(255, 200, 80, 0.20);
  --color-highlight-tts-border: #F0B858;
}
```

따뜻한 앰버 톤 → 기존 `selected` (파랑 primary) 와 명확히 구분.

Tailwind config에 커스텀 색 추가 or 인라인 style 사용. **인라인 style 로 CSS 변수 직접 참조** 가 간단.

`MindmapNode.jsx` 수정:
```javascript
// data에서 isPlaying 받기
const { label, color, childCount, isCollapsed, description, isPlaying } = data;

// 스타일 조합
const playingStyle = isPlaying ? {
  borderColor: 'var(--color-highlight-tts-border)',
  backgroundColor: 'var(--color-highlight-tts-bg)',
  boxShadow: '0 0 0 3px var(--color-highlight-tts-border)',
} : {};

// 기존 className + style 병합
<div
  className={`... ${selected ? '...' : '...'} ...`}
  style={playingStyle}  // isPlaying일 때 selected 스타일을 덮어씀
>
```

### 단계 5 — MindmapCanvas에 playingNodeId 주입

```javascript
// MindmapCanvas.jsx
const playingNodeId = useMindmapStore((s) => s.playingNodeId);

const flowNodes = useMemo(() => ... .map((n) => ({
  ...기존,
  data: {
    ...기존 data,
    isPlaying: n.id === playingNodeId,
  },
})), [nodes, childrenMap, hiddenSet, playingNodeId]);  // deps 추가
```

### 단계 6 — 컨트롤 UI (`MindmapControls.jsx`)

재생/일시정지/정지 버튼 그룹. 기존 PDF 버튼 왼쪽에 구분선(`<span className="w-px h-5 bg-border-light mx-1" />`)과 함께 배치.

```jsx
import { Play, Pause, Square, Volume2 } from 'lucide-react';
import { useMindmapTts } from '@/hooks/useMindmapTts';

const { play, pause, stop, status } = useMindmapTts();

{status === 'playing' ? (
  <button onClick={pause} title="일시정지"><Pause /></button>
) : (
  <button onClick={play} title={status === 'paused' ? '이어서 재생' : '음성으로 읽기'}>
    {status === 'paused' ? <Play /> : <Volume2 />}
  </button>
)}
<button 
  onClick={stop} 
  title="정지" 
  disabled={status === 'idle'}
  className={status === 'idle' ? 'opacity-40 cursor-not-allowed' : ''}
>
  <Square />
</button>
```

**브라우저 미지원 대응**: `'speechSynthesis' in window` 체크 후 미지원이면 버튼 비활성화 + 툴팁 "이 브라우저는 음성 읽기를 지원하지 않습니다".

### 단계 7 — cleanup 포인트

- `MindmapPanel` 언마운트 시 `stop()` (useMindmapTts 훅이 이미 cleanup 포함)
- `activeMapId` 변경 시 stop (훅 내부 useEffect)
- `deleteNode` 액션 내부: 삭제 노드가 재생 중이면 stop
- 페이지 이탈(`beforeunload`): 브라우저가 자동 처리 (speechSynthesis는 navigation 시 자동 cancel)

## 단위 테스트 계획

### 1. `buildTtsScript()` 순수 함수 — 수동 확인 (별도 유닛 테스트 프레임워크 없음)
- **케이스 A** (단일 루트): `nodes = [{ id:'r', label:'Root' }]` → script 길이 1, text='Root'
- **케이스 B** (1뎁스 3개):
  ```
  r(asd) ─ 1
         ├ 2
         └ 3
  ```
  → 순서: "asd" → "asd의 하위 내용은 1, 2, 3이 있습니다." → "1" → "2" → "3"
- **케이스 C** (2뎁스 혼합):
  ```
  r ─ 1 ─ 1-a
        └ 1-b
    └ 2
  ```
  → 순서: "r" → "r의 하위 내용은 1, 2이 있습니다." → "1" → "2" → "1의 하위 내용은 1-a, 1-b이 있습니다." → "1-a" → "1-b"
  - 사용자 의도(BFS) 부합 확인
- **케이스 D** (빈 label): `label: ''` 노드는 낭독 스크립트에서 스킵. 부모 안내 문구에서는 "(이름 없음)" 표기.
- **케이스 E** (접힌 노드): `collapsed: true` 인 노드는 본인까지는 읽되 자식은 스킵. 부모 안내 문구에 자식 나열되지 않음.
- **케이스 F** (빈 배열 / 루트 없음): 빈 script 반환.

### 2. 재생 엔진 (`useMindmapTts`) — 브라우저 수동 테스트
- 재생 버튼 클릭 → 음성 들리고 첫 노드 하이라이트(앰버) 들어오는지
- 문장 진행에 따라 하이라이트가 다음 노드로 이동하는지
- 일시정지 → 중간에 멈춤 + 하이라이트 유지
- 이어서 재생 → 멈춘 문장부터 재개 + 하이라이트 이동 재개
- 정지 → 즉시 끊기고 하이라이트 사라짐
- 맵 탭 전환 → 자동 정지
- 노드 삭제(재생 중인 노드 포함) → 정지
- 접힌 노드 → 해당 자식 스킵
- 빈 label 노드 → 낭독 스킵되지만 흐름 유지

### 3. UI/하이라이트
- 라이트/다크 테마 모두에서 하이라이트 색이 readable한지
- `selected` 상태와 `isPlaying` 상태 동시 적용 시 isPlaying이 시각적으로 우세한지
- 브라우저 미지원(Firefox 일부 구버전 등) 시 버튼 disabled + 툴팁 노출

### 4. IME/키보드
- TTS 컨트롤은 버튼 클릭만 지원 → IME 이슈 없음. (키보드 단축키는 비-목표)

## 회귀 테스트 계획

변경 파일이 마인드맵 코어(`MindmapCanvas`, `MindmapNode`, `useMindmapStore`)를 건드리므로 **마인드맵 기본 동작**과 **인접 기능**을 확인.

- [ ] 마인드맵: 노드 생성/편집/삭제가 정상 작동
- [ ] 마인드맵: 노드 선택(`selected` 스타일) 정상 표시 — isPlaying 하이라이트와 공존 시 시각 혼란 없음
- [ ] 마인드맵: 접기/펼치기 정상
- [ ] 마인드맵: 설명 툴팁/편집 모달 (최근 fix된 portal 렌더링) — 재생 중에도 툴팁 정상 표시
- [ ] 마인드맵: PDF 다운로드 버튼 정상 (컨트롤 UI가 같은 컨테이너)
- [ ] 마인드맵: 맵 생성/삭제/전환 — TTS 자동 정지
- [ ] 채팅: 메시지 송수신 정상 (전역 스토어 영향 없음 확인)
- [ ] 인증/문서: 기본 네비게이션 정상

---

## 리스크 및 주의사항

1. **Chrome SpeechSynthesis 백그라운드 탭 이슈** — 긴 낭독 중 탭 전환 시 ~15초 후 끊김. 각 문장을 개별 utterance로 쪼개는 현재 설계로 대부분 우회 가능하나, 완전 해결 아님. 사용자 귀가 이상한 곳에서 끊긴 것처럼 들릴 수 있음 → 일단 수용, 필요 시 후속 작업.
2. **voice 로딩 race** — 첫 재생 시 `getVoices()` 가 빈 배열 반환할 수 있음. `voiceschanged` 이벤트 한 번 대기 후 재시도. 훅에서 방어.
3. **localStorage persist 충돌** — `playingNodeId`, `ttsStatus` 는 persist 제외 필수. 포함하면 새로고침 후 하이라이트가 남은 채로 뜨는 버그 발생 가능.
4. **zustand selector 최적화** — `playingNodeId` 가 자주 바뀌므로 이를 구독하는 컴포넌트가 과도하게 리렌더 안 되도록 selector 세밀화. 특히 `MindmapNode` 는 이미 많은 인스턴스가 있으니 `data.isPlaying` 으로 전달 후 `React.memo` 비교 확인.
5. **낭독 문구 결정 (옵션 B 확정)** — "X의 하위 내용은 A, B, C" 에서 끊기. 종결 조사 없이 명사 나열로 마무리 → 종성 판별 불필요, 어색함 없음.
