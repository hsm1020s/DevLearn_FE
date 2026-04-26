# 설계: 2026-04-26-clarity-auto-restore

**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-26-clarity-auto-restore
**브랜치:** task/2026-04-26-clarity-auto-restore

## 목표
선명도 비밀번호 잠금 해제 시, 슬라이더를 사용자가 다시 올릴 필요 없이 **선명도를 자동으로 최대치(1.0)로 복원**한다. 자리 비웠다 돌아온 사용자가 비번만 통과하면 화면이 즉시 또렷하게 보이는 흐름이 자연스럽다.

## 변경 범위
- `src/stores/useAppStore.js` — `unlockClarityWithPassword` 가 잠금 해제와 동시에 `uiClarity` 를 `CLARITY_MAX` 로 set.
- (UI 변경 없음) — 팝업이 닫히는 흐름은 그대로. Sidebar/팝오버 컴포넌트는 손대지 않음.

## 구현 계획

```js
unlockClarityWithPassword: (pw) => {
  if (pw === TEMP_UNLOCK_PASSWORD) {
    // 비번 통과 시 잠금 해제 + 선명도 즉시 최대로 복원 (사용자가 슬라이더로 다시 끌어올릴 필요 없음).
    set({ clarityLocked: false, uiClarity: CLARITY_MAX });
    return true;
  }
  return false;
},
```

`setUiClarity` 의 자동 잠금 가드(`shouldLock = !state.clarityLocked && clamped <= CLARITY_MIN`) 와는 무관 — 여기는 `set` 으로 직접 쓰기 때문에 가드를 거치지 않는다(이중 활성화 사고 없음).

## 단위 테스트 계획
| # | 시나리오 | 기대 |
|---|---------|------|
| U1 | 잠긴 상태(uiClarity=0.4)에서 `12345` 입력 | uiClarity → 1.0, clarityLocked → false, ClarityFilm 사라짐 |
| U2 | 잠긴 상태에서 오답 비번 | uiClarity 변화 없음, 잠금 유지 |
| U3 | 새로고침 후 잠긴 상태 → 정답 비번 | persist 복원된 0.4 → 즉시 1.0 |

## 회귀 테스트 계획
- 선명도 슬라이더 정상 조작 (잠금 활성화 흐름 회귀)
- 채팅/마인드맵/사이드바 토글 비회귀
- ClarityFilm 효과 (uiClarity 변화에 정상 반응)
