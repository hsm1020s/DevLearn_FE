# 설계: 2026-05-11-disable-local-llm-on-cloud

**생성:** 2026-05-11 14:24
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-11-disable-local-llm-on-cloud
**브랜치:** task/2026-05-11-disable-local-llm-on-cloud

## 목표
네이버 클라우드 배포 환경에서는 로컬 LLM(Ollama 기반 llama-8b / exaone-32b / gpt-oss-20b)을
구동할 수 없으므로, FE에서 다음을 보장한다.

1. 클라우드 환경에서는 LLM 셀렉터의 로컬 3종이 **비활성화(disabled)** 상태로 렌더링되고,
   라벨에 "클라우드 환경에서는 지원되지 않습니다" 안내가 노출된다.
2. 어떤 경로로든(이전 대화 메타데이터 복원 등) 로컬 모델이 `selectedLLM`으로 들어오려고 하면
   가드가 작동해 첫 클라우드 모델로 자동 폴백하고, 사용자에게 Toast로 사유를 알린다.
3. 개발 환경(`VITE_DISABLE_LOCAL_LLM`이 `true`가 아님)에서는 기존 동작이 100% 유지된다.

비범위(이 태스크에서 다루지 않음):
- BE의 `OllamaProvider` 비활성화 / OpenAI 임베딩 교체 / 파이프라인 수정.
  이들은 후속 태스크에서 진행한다. 본 태스크는 **FE 단독으로 머지 가능한 안전망**이 목적이다.

## 변경 범위
| 파일 | 변경 |
|------|------|
| `src/utils/constants.js` | `LLM_OPTIONS` 각 항목에 `local: true/false` 플래그 추가. 라벨은 그대로. |
| `src/utils/llmEnvironment.js` *(신규)* | `isLocalLlmDisabled()`, `isLocalLlmValue(value)`, `firstCloudLlmValue()` 헬퍼. `import.meta.env.VITE_DISABLE_LOCAL_LLM === 'true'` 판정. |
| `src/components/common/Dropdown.jsx` | option 객체에서 `disabled`/`title`을 인식하도록 확장 (네이티브 `<option disabled>` + `title` attr). |
| `src/components/layout/Sidebar.jsx` | LLM 옵션을 빌드할 때 disable 모드면 로컬 항목에 `disabled: true` + 안내 `title` 부여. `handleSelectConversation`에서 로컬 LLM 복원 시 가드. |
| `src/stores/useAppStore.js` | `setLLM`에 가드 추가 — disable 모드 + 로컬 모델이면 첫 클라우드 모델로 폴백 후 Toast. Toast는 store가 직접 호출하지 않고, **거부된 사실을 반환**하여 호출자가 Toast를 띄우도록 책임 분리. |
| (없음) `.env.example` | 현재 레포에 .env.example이 없고 .gitignore가 `.env.*`를 차단 + `.example`만 허용함. 본 태스크에서는 신규 생성하지 않고, prod 배포 가이드는 docs에 기록. |

## 구현 계획

### 1. 상수에 `local` 플래그 부여
`LLM_OPTIONS`에 `local: false` (클라우드 3종) / `local: true` (로컬 3종) 추가.
기존 라벨 텍스트는 그대로(이미 "(로컬)" 표기됨).

### 2. 환경 판정 유틸 (`src/utils/llmEnvironment.js`)
```js
export const isLocalLlmDisabled = () =>
  import.meta.env.VITE_DISABLE_LOCAL_LLM === 'true';

export const isLocalLlmValue = (value) =>
  LLM_OPTIONS.find((o) => o.value === value)?.local === true;

export const firstCloudLlmValue = () =>
  LLM_OPTIONS.find((o) => !o.local)?.value ?? 'gpt-5.4-mini';
```

### 3. Dropdown 확장
- `options[i].disabled` 가 있으면 `<option disabled>` 로 렌더.
- `options[i].title` 이 있으면 `<option title="...">` 로 호버 안내.

### 4. Sidebar — 옵션 빌드 + 대화 복원 가드
- `LLM_OPTIONS`를 그대로 넘기지 않고, disable 모드일 때 로컬 항목에 `disabled: true` + `title: '클라우드 환경에서는 지원되지 않습니다'` 를 덧붙인 배열을 생성.
- `handleSelectConversation`에서 `conv.llm`이 로컬이고 disable 모드면 `setLLM`를 호출하되, store가 폴백 처리하므로 그대로 위임.

### 5. setLLM 가드 (`useAppStore.js`)
```js
setLLM: (llm) => {
  if (isLocalLlmDisabled() && isLocalLlmValue(llm)) {
    const fallback = firstCloudLlmValue();
    set({ selectedLLM: fallback });
    return { ok: false, fallback, reason: 'local-llm-disabled' };
  }
  set({ selectedLLM: llm });
  return { ok: true };
},
```
호출자(Sidebar)에서 반환값이 `ok: false`면 Toast.

## 단위 테스트 계획
- 환경변수 미설정(개발 모드):
  - LLM 드롭다운에서 로컬 3종 선택 가능, store에 정상 반영.
- 환경변수 `VITE_DISABLE_LOCAL_LLM=true` 설정:
  - 드롭다운에서 로컬 3종이 disabled로 렌더되어 마우스로 선택 불가.
  - 호버 시 안내 텍스트(`title` 속성) 확인.
  - 과거 로컬 모델이 저장된 대화를 선택하면 자동으로 첫 클라우드 모델(`gpt-5.4-mini`)로 폴백되고 Toast 노출.
  - `setLLM('llama-8b')`을 강제 호출해도 selectedLLM이 클라우드 모델로 머무는지 확인.

## 회귀 테스트 계획
- 일반 채팅: 클라우드 모델(`claude-sonnet-4-6`) 선택 후 메시지 송수신 정상 동작.
- 마인드맵 자동 생성 탭: 문서 리스트 페이지네이션이 직전 태스크에서 추가됨 — 페이지 전환 정상 작동 확인.
- 대화 목록에서 다른 대화 선택 시 LLM/모드 복원이 정상 동작.
- 사이드바 접기/펼치기, 모바일 사이드바 등 UI 인터랙션 회귀 없음.
