/**
 * @fileoverview 채팅 입력창 컴포넌트
 * 자동 높이 조절 textarea와 전송/중지 버튼을 제공한다.
 * 비제어(uncontrolled) 방식으로 입력값을 ref로 관리하여 리렌더링을 최소화한다.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { Send, Square } from 'lucide-react';

/** 메시지 입력 영역. Enter로 전송, Shift+Enter로 줄바꿈. 스트리밍 중에는 중지 버튼 표시. */
export default function ChatInput({ onSend, isStreaming, onStop }) {
  const textareaRef = useRef(null);
  const valueRef = useRef('');
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // textarea 높이를 내용에 맞게 자동 조절 (최대 140px)
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, []);

  // 메시지 전송 후 입력창 초기화
  const handleSend = useCallback(() => {
    const text = valueRef.current.trim();
    if (!text || isStreaming) return;
    onSend(text);
    valueRef.current = '';
    setIsEmpty(true);
    if (textareaRef.current) {
      textareaRef.current.value = '';
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  }, [onSend, isStreaming]);

  // Enter 키로 전송, Shift+Enter는 줄바꿈 허용
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (e) => {
      valueRef.current = e.target.value;
      setIsEmpty(e.target.value.trim() === '');
      adjustHeight();
    },
    [adjustHeight],
  );

  return (
    <div className="border-t border-border-light bg-bg-primary px-2 md:px-4 py-2 md:py-3">
      <div className="
        flex items-end gap-1.5 md:gap-2
        bg-bg-secondary rounded-xl
        border border-border-light
        px-2 md:px-3 py-2
      ">
        <textarea
          ref={textareaRef}
          className="
            flex-1 resize-none bg-transparent
            text-text-primary placeholder-text-secondary
            text-sm leading-relaxed
            outline-none
            max-h-[140px]
          "
          rows={1}
          maxLength={10000}
          placeholder="메시지를 입력하세요..."
          onChange={handleChange}
          onInput={handleChange}
          onKeyDown={handleKeyDown}
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="
              shrink-0 p-1.5 rounded-lg
              bg-danger text-white
              hover:opacity-90 transition-colors
            "
            aria-label="스트리밍 중지"
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={isEmpty}
            className="
              shrink-0 p-1.5 rounded-lg
              bg-primary text-white
              hover:bg-primary-hover transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
            "
            aria-label="메시지 전송"
          >
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
