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
 * 가운데 핸들은 드래그로 좌/우 폭 비율을 조절한다 — `useAppStore.learningSplitLeftPct`
 * 가 % 단위로 좌측 폭을 보관(20~80 클램프, persist). 마인드맵-채팅 분할 비율
 * (`splitLeftPct`)과는 독립이라 서로 영향을 주지 않는다. 인터랙션 패턴(pointer
 * capture, body userSelect 차단)은 `SplitView`와 동일.
 */
import { useRef } from 'react';
import useAppStore from '../../stores/useAppStore';
import GeneralChatPane from './GeneralChatPane';
import FeynmanChatPane from './FeynmanChatPane';

/**
 * @param {object} props
 * @param {'study'|'worklearn'} props.mode
 */
export default function SplitLearningWorkspace({ mode }) {
  const learningSplitLeftPct = useAppStore((s) => s.learningSplitLeftPct);
  const setLearningSplitLeftPct = useAppStore((s) => s.setLearningSplitLeftPct);

  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);

  // pointer capture로 포인터가 핸들 밖으로 벗어나도 드래그 추적 유지
  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    document.body.style.userSelect = 'none';
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setLearningSplitLeftPct(pct); // 스토어가 20~80으로 clamp
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.userSelect = '';
  };

  return (
    <div ref={containerRef} className="flex flex-row h-full min-h-0">
      {/* 좌측 — width로 폭 고정 */}
      <div className="h-full shrink-0 min-w-0" style={{ width: `${learningSplitLeftPct}%` }}>
        <GeneralChatPane mode={mode} />
      </div>

      {/* 가운데 리사이저 핸들 */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="일반 채팅과 파인만 채팅 크기 조절"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="shrink-0 w-px bg-border-medium hover:w-1 hover:bg-primary/60 active:bg-primary cursor-col-resize transition-all"
      />

      {/* 우측 — 잔여 공간 차지 */}
      <div className="h-full flex-1 min-w-0">
        <FeynmanChatPane mode={mode} />
      </div>
    </div>
  );
}
