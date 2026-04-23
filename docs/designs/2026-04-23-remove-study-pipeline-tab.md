# 설계: 2026-04-23-remove-study-pipeline-tab

**생성:** 2026-04-23 12:46
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-04-23-remove-study-pipeline-tab
**브랜치:** task/2026-04-23-remove-study-pipeline-tab

## 목표
자격증(study) 모드 상단 서브 탭에서 "파이프라인" 탭을 제거한다. 사이드바 "문서
파이프라인" 모달이 동일 기능을 제공하므로 중복 경로를 정리해 UX를 단순화한다.
`FeynmanPipelineTab` 컴포넌트 자체는 사이드바 모달에서 계속 쓰므로 **삭제하지 않는다**.

## 변경 범위 (프론트만)

1. **`src/components/study/StudySubTabs.jsx`**
   - `TABS` 배열에서 `{ value: 'pipeline', label: '파이프라인', icon: Cpu }` 엔트리 제거.
   - `lucide-react` import 에서 `Cpu` 제거.
2. **`src/components/study/StudyWorkspace.jsx`**
   - `FeynmanPipelineTab` import 제거.
   - `{studySubTab === 'pipeline' && <FeynmanPipelineTab />}` 라인 제거.
   - persist 잔재 대응: `useEffect` 로 현재 `studySubTab` 이 허용값(`'chat'|'quiz'|'record'`)
     가 아니면 `'chat'` 으로 1회 보정 (과거 사용자가 파이프라인 탭에 머문 상태로 저장된
     경우 빈 화면이 뜨는 것을 방지).

## 불변
- `src/components/feynman/FeynmanPipelineTab.jsx` — 그대로 유지 (사이드바 모달에서 사용).
- `FeynmanPipelineModal.jsx` · `feynmanApi` · 백엔드 경로 전부 건드리지 않음.

## 구현 계획
1. `StudySubTabs.jsx` 에서 `Cpu` import, `TABS` 엔트리 제거.
2. `StudyWorkspace.jsx` 에서 import·조건 렌더 제거, 방어 `useEffect` 추가.
3. `vite build` 성공 확인.
4. dev 서버 3100 에서 headless Chrome DOM 에 "파이프라인" 텍스트가 없음 확인.

## 단위 테스트 계획 (evidence/unit/notes.md)
자동:
1. `vite build` 성공.
2. 번들 응답에서 `StudySubTabs` 에 `Cpu`/"파이프라인" 미포함.
3. headless Chrome DOM 에서 "파이프라인" 탭 렌더 0건.

수동:
4. 자격증 모드 상단에 [학습 채팅][퀴즈][기록] 세 탭만 노출.
5. 사이드바 "문서 파이프라인" 팝업은 정상 동작.

## 회귀 테스트 계획
1. 자격증 모드 학습 채팅/퀴즈/기록 탭 전환 정상.
2. 파인만 파이프라인 기능(업로드·실행·목록)은 사이드바 모달에서 그대로 동작.
3. 파인만 학습 채팅(대화형 학습) 정상 (문서 선택 드롭다운도 사용자별 격리 유지).
