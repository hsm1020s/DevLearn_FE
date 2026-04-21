/**
 * @fileoverview 학습 채팅 스타일 칩 바.
 * 일반/파인만/한줄요약 세 가지 스타일 중 "다음 턴에 적용할" 프리셋을 선택한다.
 * 📌 고정 토글 on이면 전송 후에도 리셋되지 않고 유지된다.
 */
import { Pin, PinOff } from 'lucide-react';
import useStudyStore from '../../stores/useStudyStore';
import { CHAT_STYLES } from '../../utils/constants';

/** 채팅 탭 상단에 놓이는 스타일 칩 + 고정 토글. */
export default function StudyStyleChips() {
  const chatStyle = useStudyStore((s) => s.chatStyle);
  const chatStyleLocked = useStudyStore((s) => s.chatStyleLocked);
  const setChatStyle = useStudyStore((s) => s.setChatStyle);
  const setChatStyleLocked = useStudyStore((s) => s.setChatStyleLocked);

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-border-light bg-bg-primary">
      <span className="text-xs text-text-tertiary mr-1">학습 스타일</span>
      <div className="flex items-center gap-1">
        {CHAT_STYLES.map(({ value, label, short, description }) => {
          const active = chatStyle === value;
          return (
            <button
              key={value}
              onClick={() => setChatStyle(value)}
              title={description}
              className={`
                flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
                border transition-colors
                ${active
                  ? 'bg-primary text-white border-primary'
                  : 'bg-bg-primary text-text-secondary border-border-light hover:border-primary/50'}
              `}
            >
              <span className="text-sm leading-none">{short}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {/* 고정 토글 — on이면 턴 후에도 스타일 유지 */}
      <button
        onClick={() => setChatStyleLocked(!chatStyleLocked)}
        title={chatStyleLocked ? '스타일 고정 해제 (턴당 리셋)' : '스타일 고정 (리셋 안 함)'}
        className={`
          ml-1 p-1 rounded transition-colors
          ${chatStyleLocked
            ? 'text-primary bg-primary/10'
            : 'text-text-tertiary hover:text-text-primary hover:bg-bg-secondary'}
        `}
      >
        {chatStyleLocked ? <Pin size={14} /> : <PinOff size={14} />}
      </button>
    </div>
  );
}
