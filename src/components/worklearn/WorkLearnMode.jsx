/**
 * @fileoverview 업무학습 모드 진입점.
 *
 * 공부 모드와 동일한 좌우 분할 학습 워크스페이스(SplitLearningWorkspace)를
 * 업무학습 모드(`mode="worklearn"`)로 렌더한다. 좌측 일반 채팅은 업무 질의응답에,
 * 우측 파인만 채팅은 업무 자료의 챕터 단위 점검에 쓰인다. 좌·우는 각각 독립
 * 대화 슬롯(`splitConversationIds.worklearn.left/right`)을 사용한다.
 */
import SplitLearningWorkspace from '../study/SplitLearningWorkspace';

/** 업무학습 모드 컨테이너 — 학습 워크스페이스(좌우 분할)로 위임. */
export default function WorkLearnMode() {
  return <SplitLearningWorkspace mode="worklearn" />;
}
