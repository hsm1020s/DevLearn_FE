# 설계: 2026-04-26-clarity-pw-gate

**생성:** 2026-04-26 21:52
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-26-clarity-pw-gate
**브랜치:** task/2026-04-26-clarity-pw-gate

## 목표
화면 선명도(uiClarity) 슬라이더가 **최하치(40%)에 한 번이라도 닿은 적이 있으면**, 다시 선명도를 올리려는 시도를 차단하고 임시 비밀번호(`12345`) 통과를 요구한다. 사생활 보호 필름을 깔아둔 사용자가 자리를 비웠을 때, 옆 사람이 슬라이더만 올려서 화면 내용을 훔쳐보는 것을 막는 잠금 장치다.

테스트 단계이므로 슬라이더 옆에 임시 비밀번호와 사용 안내를 텍스트로 노출한다. (정식 배포 시 제거 예정 — 코드에 `// TODO: prod 전환 시 안내 텍스트 + 하드코딩 비번 제거` 표식)

## 변경 범위

### 수정 파일
- `src/stores/useAppStore.js` — 잠금 상태(`clarityLocked`) + 액션 추가, persist 대상 포함
- `src/components/layout/Sidebar.jsx` — 슬라이더 영역 확장 (잠금 표시, 자물쇠 아이콘, 안내 텍스트, 비밀번호 팝오버 트리거)
- `src/components/layout/ClarityPasswordPopover.jsx` **신규** — 비밀번호 입력 팝오버 컴포넌트 분리 (사용자 확정)

### 사용자 확정 사항 (2026-04-26 설계 리뷰)
1. 잠금 트리거: `CLARITY_MIN`(0.4)에 **닿는 순간** 즉시 잠금 활성화
2. persist 포함: 새로고침해도 잠금 유지 (자리비움 시나리오라 의도적)
3. 팝오버는 **별도 컴포넌트**로 분리 (`ClarityPasswordPopover.jsx`)

### 영향 범위
- `ClarityFilm.jsx` — 변경 없음 (uiClarity 값만 사용하므로 자동 반영)
- 기존 LocalStorage `app-store` 키에 `clarityLocked` 필드가 추가됨 → 구버전 사용자는 `undefined` → `false`로 폴백되도록 작성

## 구현 계획

### 1. 스토어 (`useAppStore.js`)
- 신규 상태: `clarityLocked: boolean` (기본 `false`)
- `setUiClarity(v)` 동작 변경:
  - 잠긴 상태(`clarityLocked === true`)에서 **현재값보다 큰 값**을 시도하면 `set` 하지 않고 무시 (조용히 거부 — UI에서 팝오버를 띄우는 게 정석 흐름).
  - 잠긴 상태에서 **현재값보다 작거나 같은 값**은 그대로 적용 (더 흐리게 만드는 건 자유).
  - 잠기지 않은 상태에서 새 값이 `CLARITY_MIN`(0.4)에 도달하면 `clarityLocked = true`로 같이 set.
- 신규 액션:
  - `unlockClarityWithPassword(pw: string): boolean` — `pw === '12345'`이면 `clarityLocked = false` 로 set 후 `true` 반환, 아니면 `false` 반환.
  - (보조) `getClarityLocked()` — selector로 충분, 별도 액션 불필요.
- persist `partialize`에 `clarityLocked` 추가 → 새로고침 후에도 잠금이 유지되어야 보호 의미가 있다.

```js
// 임시 단계 비밀번호. 정식 배포 시 환경변수 또는 서버 검증으로 교체.
const TEMP_UNLOCK_PASSWORD = '12345';
```

### 2. UI (`Sidebar.jsx` — 선명도 슬라이더 블록)

상태:
- `const clarityLocked = useAppStore((s) => s.clarityLocked);`
- `const unlock = useAppStore((s) => s.unlockClarityWithPassword);`
- 로컬 상태: `const [pwOpen, setPwOpen] = useState(false);`, `const [pwInput, setPwInput] = useState('');`, `const [pwError, setPwError] = useState('');`

동작:
- 슬라이더 `onChange`:
  - `const next = Number(e.target.value) / 100;`
  - `if (clarityLocked && next > uiClarity) { setPwOpen(true); return; }` — 올리려는 시도면 팝오버 오픈 + early return
  - 그 외에는 기존대로 `setUiClarity(next)`.
- 자물쇠 아이콘 표시: `clarityLocked` 일 때 슬라이더 우측에 `Lock` (lucide) 아이콘 표시 + 클릭 시 동일 팝오버 오픈.
- 안내 텍스트(테스트 단계용): 슬라이더 아래에 작은 글씨로 `<p className="text-[11px] text-text-tertiary px-2 leading-tight">선명도를 0%로 내린 뒤 다시 올리려면 임시 비밀번호 <strong>12345</strong>가 필요합니다 (테스트용).</p>`.

팝오버(`ClarityPasswordPopover.jsx` 또는 인라인):
- 슬라이더 행 우측 자물쇠 옆에 absolute로 띄움.
- input[type="password"] + "확인" / "취소" 버튼.
- 한국어 IME 안전: `onKeyDown`에서 Enter 처리 시 `e.nativeEvent.isComposing` 체크.
- 확인 버튼: `unlock(pwInput)` 결과가 `true`면 팝오버 닫고 `pwError` 비움. `false`면 `pwError = '비밀번호가 일치하지 않습니다'`로 표시. 입력값은 비움.
- 취소 / 외부 클릭 시 닫힘 + 입력값/에러 리셋.
- 브라우저 내장 alert/confirm 절대 금지 (CLAUDE.md 규칙).

### 3. 스타일
- 색상은 기존 디자인 토큰(`text-text-secondary`, `bg-bg-primary`, `border-border-light` 등)만 사용.
- 슬라이더 영역은 기존 `relative z-[200]` stacking 유지.
- 팝오버 z-index는 슬라이더와 같은 stacking context 안에 두되 `z-[210]` 정도로 살짝 위에.

## 단위 테스트 계획
실제 브라우저에서 손으로 검증하고 `evidence/unit/notes.md`에 결과 기록.

| # | 시나리오 | 기대 결과 |
|---|---------|----------|
| 1 | 슬라이더를 100% → 40%로 끝까지 내림 | uiClarity=0.4 적용, 잠금 활성화(자물쇠 아이콘 등장) |
| 2 | 잠금 상태에서 슬라이더를 위로 드래그 | 값이 변하지 않고 비밀번호 팝오버가 뜸 |
| 3 | 잠금 상태에서 슬라이더를 더 아래(이미 40%) / 동일값 시도 | 거부되지 않음 (조용히 무시됨, 팝오버 안 뜸) |
| 4 | 팝오버에 잘못된 비밀번호(`9999`) 입력 후 확인 | "비밀번호가 일치하지 않습니다" 표시, 잠금 유지, 입력 필드 비워짐 |
| 5 | 팝오버에 `12345` 입력 후 Enter 또는 확인 | 잠금 해제, 자물쇠 아이콘 사라짐, 슬라이더로 다시 올릴 수 있음 |
| 6 | 잠긴 상태로 새로고침(F5) | 잠금이 유지됨 (persist 동작 확인) |
| 7 | 한글 IME로 비밀번호 입력 중 Enter | `isComposing` 가드로 조합 중 Enter 무시 |
| 8 | 자물쇠 아이콘 직접 클릭 | 동일한 비밀번호 팝오버 오픈 |

## 회귀 테스트 계획
이번 변경과 무관하지만 흐름상 자주 쓰는 기능이 깨지지 않았는지 확인. 결과는 `evidence/regression/notes.md`에 기록.

- **채팅 모드**: General 모드에서 메시지 1회 송수신 → 정상 동작
- **마인드맵 패널**: 마인드맵 토글 on/off → 분할 비율 정상, 패널 표시
- **사이드바 접기/펼치기**: 사이드바 토글 → 선명도 슬라이더 블록이 펼친 상태에서만 보이는지 (collapsed 시 숨김 유지)
- **선명도 + 모드 전환 동시성**: 선명도 60% 상태에서 study↔general 전환 → 값 유지, 잠금 상태도 유지
