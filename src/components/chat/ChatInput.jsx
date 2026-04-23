/**
 * @fileoverview 채팅 입력창 컴포넌트
 * 자동 높이 조절 textarea와 전송/중지 버튼을 제공한다.
 * 비제어(uncontrolled) 방식으로 입력값을 ref로 관리하여 리렌더링을 최소화한다.
 * Web Speech API 기반 마이크 토글(음성 → 텍스트) 버튼을 포함한다.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { Send, Square, Mic, MicOff } from 'lucide-react';
import useSpeechRecognition from '../../hooks/useSpeechRecognition';

/** 메시지 입력 영역. Enter로 전송, Shift+Enter로 줄바꿈. 스트리밍 중에는 중지 버튼 표시. */
export default function ChatInput({ onSend, isStreaming, onStop }) {
  const textareaRef = useRef(null);
  const valueRef = useRef('');
  const [isEmpty, setIsEmpty] = useState(true);
  // 녹음 시작 시점의 textarea 값 — 인식 결과는 이 뒤에 이어붙인다
  const speechBaseRef = useRef('');
  // handleSend가 훅 선언보다 위에서 stop을 호출해야 해서 ref로 우회한다
  const stopSpeechRef = useRef(null);

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
    // 음성 인식이 켜져 있었으면 같이 중지 + 버퍼 리셋 — 전송 뒤 잔여 transcript가 빈
    // textarea를 다시 채우는 현상을 막는다.
    stopSpeechRef.current?.();
    speechBaseRef.current = '';
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

  // 음성 인식 결과를 비제어 textarea에 반영 — DOM value와 valueRef를 함께 갱신
  const handleTranscript = useCallback(
    (transcript) => {
      const base = speechBaseRef.current;
      const merged = base ? `${base} ${transcript}`.trimEnd() : transcript;
      valueRef.current = merged;
      if (textareaRef.current) {
        textareaRef.current.value = merged;
      }
      setIsEmpty(merged.trim() === '');
      adjustHeight();
    },
    [adjustHeight],
  );

  const { supported: speechSupported, listening, start: startSpeech, stop: stopSpeech } =
    useSpeechRecognition({ onTranscript: handleTranscript });

  useEffect(() => {
    stopSpeechRef.current = stopSpeech;
  }, [stopSpeech]);

  const handleMicToggle = useCallback(() => {
    if (listening) {
      stopSpeech();
      return;
    }
    // 현재 입력된 텍스트를 base로 고정한 뒤 녹음 시작
    speechBaseRef.current = valueRef.current ?? '';
    startSpeech();
  }, [listening, startSpeech, stopSpeech]);

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
          placeholder={listening ? '음성 인식 중...' : '메시지를 입력하세요...'}
          onChange={handleChange}
          onInput={handleChange}
          onKeyDown={handleKeyDown}
        />
        {speechSupported && (
          <button
            onClick={handleMicToggle}
            disabled={isStreaming}
            className={`
              shrink-0 p-1.5 rounded-lg transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              ${listening
                ? 'bg-danger text-white animate-pulse hover:opacity-90'
                : 'bg-bg-tertiary text-text-secondary hover:bg-border-light'}
            `}
            aria-label={listening ? '음성 인식 중지' : '음성 입력 시작'}
            title={listening ? '음성 인식 중지' : '음성 입력 시작'}
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
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
