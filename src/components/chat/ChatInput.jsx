import { useRef, useEffect, useCallback } from 'react';
import { Send, Square } from 'lucide-react';

export default function ChatInput({ onSend, isStreaming, onStop }) {
  const textareaRef = useRef(null);
  const valueRef = useRef('');

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const text = valueRef.current.trim();
    if (!text || isStreaming) return;
    onSend(text);
    valueRef.current = '';
    if (textareaRef.current) {
      textareaRef.current.value = '';
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  }, [onSend, isStreaming]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (e) => {
      valueRef.current = e.target.value;
      adjustHeight();
    },
    [adjustHeight],
  );

  const isEmpty = valueRef.current.trim() === '';

  return (
    <div className="border-t border-border-light bg-bg-primary px-4 py-3">
      <div className="
        flex items-end gap-2
        bg-bg-secondary rounded-xl
        border border-border-light
        px-3 py-2
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
          placeholder="메시지를 입력하세요..."
          onChange={handleChange}
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
