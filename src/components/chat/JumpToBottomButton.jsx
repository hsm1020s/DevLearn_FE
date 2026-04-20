/**
 * @fileoverview 대화창 플로팅 "맨 아래로" 버튼.
 * 사용자가 위로 스크롤한 상태(isAtBottom=false)에서만 노출되며,
 * 위에 있는 동안 새 답변이 도착하면 "새 답변" 뱃지 라벨로 강조한다.
 */
import { ArrowDown } from 'lucide-react';

/**
 * @param {object} props
 * @param {boolean} props.visible - 버튼 노출 여부 (하단 근접이 아닐 때 true)
 * @param {boolean} props.hasNew - 위에 있는 동안 새 답변이 도착했는지
 * @param {() => void} props.onClick - 클릭 시 맨 아래로 스크롤
 */
export default function JumpToBottomButton({ visible, hasNew, onClick }) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hasNew ? '새 답변으로 이동' : '맨 아래로 이동'}
      className={`
        absolute left-1/2 -translate-x-1/2 bottom-4
        flex items-center gap-1.5 pl-3 pr-3.5 py-1.5
        rounded-full shadow-md border
        text-sm font-medium transition-all
        ${hasNew
          ? 'bg-primary text-white border-primary hover:brightness-110'
          : 'bg-bg-primary text-text-primary border-border-medium hover:bg-bg-secondary'}
      `}
    >
      <ArrowDown size={14} />
      {hasNew ? <span>새 답변</span> : <span className="hidden sm:inline">맨 아래로</span>}
    </button>
  );
}
