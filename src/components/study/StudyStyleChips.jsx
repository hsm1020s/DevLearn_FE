/**
 * @fileoverview 학습 채팅 스타일 칩 바.
 * 일반/파인만 중 "다음 턴에 적용할" 프리셋을 선택한다.
 * 파인만 칩 클릭 시 챕터 선택 패널이 열리고, 챕터를 선택하면 대화형 학습이 시작된다.
 * 📌 고정 토글 on이면 전송 후에도 리셋되지 않고 유지된다.
 */
import { useState } from 'react';
import { Pin, PinOff, X } from 'lucide-react';
import useStudyStore from '../../stores/useStudyStore';
import { CHAT_STYLES } from '../../utils/constants';
import FeynmanChapterPicker from '../feynman/FeynmanChapterPicker';

/** 채팅 탭 상단에 놓이는 스타일 칩 + 고정 토글. */
export default function StudyStyleChips() {
  const chatStyle = useStudyStore((s) => s.chatStyle);
  const chatStyleLocked = useStudyStore((s) => s.chatStyleLocked);
  const setChatStyle = useStudyStore((s) => s.setChatStyle);
  const setChatStyleLocked = useStudyStore((s) => s.setChatStyleLocked);
  const feynmanChapter = useStudyStore((s) => s.feynmanChapter);
  const setFeynmanSession = useStudyStore((s) => s.setFeynmanSession);
  const clearFeynmanSession = useStudyStore((s) => s.clearFeynmanSession);

  const [showChapterPicker, setShowChapterPicker] = useState(false);

  const handleChipClick = (value) => {
    if (value === 'feynman') {
      // 이미 파인만 세션이 활성 → 해제
      if (feynmanChapter) {
        clearFeynmanSession();
        setChatStyle('general');
        return;
      }
      // 챕터 선택 패널 토글
      setShowChapterPicker((prev) => !prev);
      return;
    }
    // 파인만 외 스타일 선택 시 파인만 세션 해제
    if (feynmanChapter) clearFeynmanSession();
    setShowChapterPicker(false);
    setChatStyle(value);
  };

  const handleChapterSelect = (docId, chapter) => {
    setFeynmanSession(docId, chapter);
    setChatStyle('feynman');
    setChatStyleLocked(true); // 파인만 세션 중에는 스타일 고정
    setShowChapterPicker(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-border-light bg-bg-primary">
        <span className="text-xs text-text-tertiary mr-1">학습 스타일</span>
        <div className="flex items-center gap-1">
          {CHAT_STYLES.map(({ value, label, short, description }) => {
            const isFeynmanActive = value === 'feynman' && feynmanChapter;
            const active = isFeynmanActive || (chatStyle === value && !feynmanChapter);
            return (
              <button
                key={value}
                onClick={() => handleChipClick(value)}
                title={isFeynmanActive ? `파인만 · ${feynmanChapter}` : description}
                className={`
                  flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
                  border transition-colors
                  ${active
                    ? 'bg-primary text-white border-primary'
                    : 'bg-bg-primary text-text-secondary border-border-light hover:border-primary/50'}
                `}
              >
                <span className="text-sm leading-none">{short}</span>
                <span>{isFeynmanActive ? `파인만 · ${feynmanChapter}` : label}</span>
                {isFeynmanActive && (
                  <X size={12} className="ml-0.5 opacity-70" />
                )}
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

      {/* 파인만 챕터 선택 패널 */}
      {showChapterPicker && (
        <FeynmanChapterPicker
          onClose={() => setShowChapterPicker(false)}
          onSelect={handleChapterSelect}
        />
      )}
    </div>
  );
}
