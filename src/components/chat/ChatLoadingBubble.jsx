/**
 * @fileoverview 어시스턴트 응답 대기 중 표시되는 로딩 버블.
 * 아바타의 breathing + glow ring 애니메이션과 시머 텍스트, 문구 로테이션으로
 * "기다리는 시간"이 지루하지 않도록 시각적 피드백을 제공한다.
 * isStreaming=true && streamingContent==='' 구간에서만 렌더한다.
 */
import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';

/** 2.5초 주기로 순차 전환되는 대기 문구 */
const LOADING_PHRASES = [
  '생각하는 중...',
  '답변을 준비하고 있어요...',
  '거의 다 됐어요...',
];

/** 어시스턴트 응답 대기 버블 */
export default function ChatLoadingBubble() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  // 2.5초마다 다음 문구로 전환 (마지막 문구 이후에는 고정)
  useEffect(() => {
    const handle = setInterval(() => {
      setPhraseIndex((prev) => Math.min(prev + 1, LOADING_PHRASES.length - 1));
    }, 2500);
    return () => clearInterval(handle);
  }, []);

  return (
    <div className="flex gap-3 justify-start">
      {/* 어시스턴트 아바타 — glow ring + breathing */}
      <div className="relative shrink-0 w-7 h-7 mt-1">
        {/* 퍼져나가는 glow ring */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-primary/30 animate-chat-glow-ring"
        />
        {/* 아바타 본체 — 숨쉬듯 확대/축소 */}
        <div className="relative w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center animate-chat-breathe">
          <Bot size={14} className="text-primary" />
        </div>
      </div>

      {/* 대기 문구 버블 — 기존 어시스턴트 메시지와 동일한 스타일 정합 */}
      <div className="
        rounded-2xl rounded-bl-md
        bg-bg-secondary px-4 py-2.5
        text-sm leading-relaxed
        min-h-[38px] flex items-center
      ">
        <span
          key={phraseIndex}
          className="chat-shimmer-text animate-chat-fade-in font-medium"
        >
          {LOADING_PHRASES[phraseIndex]}
        </span>
      </div>
    </div>
  );
}
