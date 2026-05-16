# 설계: 2026-05-16-feynman-rebuild-progress

**생성:** 2026-05-16 14:24
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-16-feynman-rebuild-progress
**브랜치:** task/2026-05-16-feynman-rebuild-progress

## 목표
[1줄 요약] 직전 태스크의 [지식 재구축] 버튼을 누른 뒤 진행 상태를 `FeynmanPipelineTab` 문서 행 안에서 **실시간 시각화**한다. 버튼 라벨이 `재구축 중... (m/N)` 으로 바뀌고 행 하단에 작은 진행 바가 노출되며, 완료 시 토스트 + 행이 정상 상태로 자동 복귀한다. BE 변경 0 — 기존 `GET /api/feynman/mindmap/chapters/{docId}` 의 챕터별 status 를 폴링해 진행률을 계산한다.

### 본 태스크가 해결하는 사용자 의도
- "재구축 누르고 나면 뭐가 도는지 안 보여서 답답하다" — 백그라운드 작업이 끝났는지 사용자가 채팅 진입해서야 확인 가능한 상태.
- F5 / 탭 전환에도 진행 상태가 유지되어 추적이 끊기지 않음.

### 본 태스크가 다루지 않는 것 (의도적 스코프 축소)
- **`chapter_questions` 합성 단계 별도 추적** — 마인드맵 완료 hook 으로 같은 비동기 큐 안에서 거의 즉시 이어 도므로 마인드맵 100% 를 사실상 "재구축 거의 끝" 으로 본다. 마인드맵 완료 후 grace 5초 + 안내 문구로 처리.
- **챕터 질문 합성용 별도 BE 진행률 API** — 현재 운영에서 단위 시간 짧음. 본 단계에서는 추가하지 않음.
- **다른 사용자/관리자 화면에서 진행률 공유** — 본인 세션 한정. localStorage 만.
- **재구축 취소/롤백** — 본 단계 스코프 외.

## 변경 범위

### FE (`/Users/moon/DevLearn_FE`)

**1. 신규 훅 — `src/hooks/useRebuildProgress.js`**
- 책임: 활성 재구축 docId 들과 진행률을 단일 진실의 출처로 관리.
- 상태 구조:
  ```ts
  type RebuildEntry = {
    docId: string;
    startedAt: number;
    mindmapsReady: number;
    totalChapters: number;
    phase: 'wiping' | 'generating' | 'finalizing' | 'done';
  };
  // Map<docId, RebuildEntry>
  ```
- localStorage 키: `feynman.rebuild.active.v1`. F5 후에도 복원.
- 노출 함수: `startRebuild(docId)`, `getProgress(docId)`, `isActive(docId)`.
- 내부 폴링:
  - 활성 엔트리 1개 이상일 때만 3초 인터벌로 `fetchChapterStatuses(docId)` 호출.
  - 진행률 계산: `mindmapsReady = chapters.filter(c => c.status === 'completed').length`, `totalChapters = chapters.length`.
  - 100% 도달 시 `phase = 'finalizing'`, 5초 후 `phase = 'done'` → 엔트리 제거.
  - 30분 stale 가드.

**2. 신규 컴포넌트 — `src/components/feynman/RebuildProgressInline.jsx`**
- props: `progress` (훅 결과 또는 null).
- 렌더 분기:
  - null → 안 그림.
  - `wiping` → 회전 아이콘 + "재구축 준비 중..."
  - `generating` → 가로 진행 바(width=m/N*100%) + "마인드맵 재합성 중 — m/N 챕터 완료"
  - `finalizing` → 바 100% + "면접 질문 합성 중... (~5초)"
- 스타일: `text-xs`, 진행 바 `bg-primary`, 트랙 `bg-bg-secondary`. globals.css 토큰 사용.

**3. `FeynmanPipelineTab.jsx` 통합**
- `runRebuildKnowledge(docId)` API 호출 직후 `startRebuild(docId)` 호출.
- [지식 재구축] 버튼:
  - `isActive(doc.id)` 이면 라벨 `재구축 중... (m/N)` 또는 `정리 중...`, 아이콘 `animate-spin`, `disabled`.
  - 동일 문서의 다른 위험 액션 버튼(재실행/임베딩/TOC/삭제) 도 `isActive` 일 때 disabled.
- 행 본문에 `<RebuildProgressInline progress={getProgress(doc.id)} />` 슬롯 추가.
- 완료 토스트 1회: "[재구축 완료] '{fileName}' 의 학습 데이터가 새로 준비되었어요."
  - 훅 옵션 `{ onComplete }` 콜백으로 처리.

**4. 다른 탭/모드 재진입 시 자동 복원**
- 훅이 마운트 시 localStorage 읽어 활성 엔트리 복원 + 폴링 시작.

### BE
변경 없음.

## 구현 계획

### Step A — 훅
1. `src/hooks/useRebuildProgress.js` 작성 — Map 상태 + localStorage + 폴링 useEffect + onComplete 콜백.

### Step B — 인라인 컴포넌트
2. `src/components/feynman/RebuildProgressInline.jsx` 작성 — props 기반 분기 렌더.

### Step C — Pipeline 탭 통합
3. `FeynmanPipelineTab.jsx`:
   - 훅 hook in.
   - `runRebuildKnowledge` 안에서 `startRebuild` 호출.
   - 버튼 라벨/disabled 분기.
   - 행 안에 `<RebuildProgressInline />` 슬롯.
   - onComplete 핸들러에서 토스트.

### Step D — 검증
4. 정적 검증 + 병합 후 메인 dev 서버에서 실제 클릭.

## 단위 테스트 계획

증거: `.claude/state/evidence/2026-05-16-feynman-rebuild-progress/unit/notes.md`

**시나리오 A — 즉시 인디케이터**: 버튼 클릭 → API 200 → 행에 "재구축 준비 중..." + 버튼 disabled. 첫 폴링 후 "0/N" 으로 갱신.
**시나리오 B — 진행률 갱신**: 폴링마다 m 증가, 바 width 증가.
**시나리오 C — 완료**: 모든 챕터 completed → finalizing 5초 → done → 토스트 1회 + 라벨 원복.
**시나리오 D — F5 복원**: 진행 중 새로고침 → localStorage 에서 복원 → 폴링 재개.
**시나리오 E — 다중 문서**: 두 문서 동시 재구축 → 행 각각 독립 진행.
**시나리오 F — 30분 타임아웃**: stale 엔트리 강제 제거 + console.warn.
**시나리오 G — 다른 위험 버튼 잠금**: isActive 동안 재실행/임베딩/TOC/삭제/재구축 모두 disabled.

## 회귀 테스트 계획

증거: `.claude/state/evidence/2026-05-16-feynman-rebuild-progress/regression/notes.md`

- **회귀 1 — `AutoMindmapTab`**: 같은 `fetchChapterStatuses` 사용. 함수 시그니처 불변. 영향 없음.
- **회귀 2 — Pipeline 탭 다른 액션**: disabled 분기에 isActive 조건만 추가. 비활성 시 기존 분기 그대로.
- **회귀 3 — Pipeline 탭 3초 폴링(docs 목록)**: 별도 useEffect 라 충돌 없음.
- **회귀 4 — 일반 채팅/마인드맵 캔버스/인증**: 변경 없음.
- **회귀 5 — localStorage 충돌**: 신규 키 분리. 기존 키 그대로.

## 위험 / 함정

- **첫 폴링 totalChapters 0 (toc 로딩 지연)** — phase 를 `wiping` 으로 유지하고 다음 폴링까지 대기.
- **wipe 직후 mindmaps 가 비어 진행률 0** — 자연스러운 0/N 상태.
- **5초 grace 만으로 chapter_questions 합성 보장 어려움** — 토스트 문구에 "수 초 내 출제 풀이 준비됩니다" 안내. 100% 보장은 후속 BE 통합 진행률 API 가 필요.
- **localStorage 차단 브라우저** — try/catch + 메모리 보관만으로 폴백. 동작 영향 없음.
- **중복 클릭** — 버튼 disabled 라 차단.
- **다른 경로의 마인드맵 합성** — `AutoMindmapTab` "선택 챕터만 생성" 흐름은 `startRebuild` 를 호출하지 않으므로 본 컴포넌트가 표시 안 함. 자연 분리.
