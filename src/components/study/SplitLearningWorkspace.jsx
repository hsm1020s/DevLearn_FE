/**
 * @fileoverview 학습 계열 모드(공부/업무학습)의 좌우 분할 채팅 워크스페이스.
 *
 * 좌측 = 일반 채팅 (`GeneralChatPane`)
 * 우측 = 파인만 채팅 (`FeynmanChatPane`, 시작 전/진행 중 두 상태)
 *
 * 좌·우 두 패널은 서로 다른 대화(splitConversationIds[mode].left/right)를 사용하므로
 * 같은 화면에서 동시에 메시지를 주고받을 수 있다. 좌측의 일반 대화는 우측의 파인만
 * 세션 시작/종료에 영향을 받지 않는다.
 *
 * 가운데 세로선은 단순 시각적 구분선 (드래그 리사이즈는 후속 단계에서 추가 가능).
 */
import GeneralChatPane from './GeneralChatPane';
import FeynmanChatPane from './FeynmanChatPane';

/**
 * @param {object} props
 * @param {'study'|'worklearn'} props.mode
 */
export default function SplitLearningWorkspace({ mode }) {
  return (
    <div className="flex flex-row h-full min-h-0">
      <div className="flex-1 min-w-0 border-r border-border-light">
        <GeneralChatPane mode={mode} />
      </div>
      <div className="flex-1 min-w-0">
        <FeynmanChatPane mode={mode} />
      </div>
    </div>
  );
}
