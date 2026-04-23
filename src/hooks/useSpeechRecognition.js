/**
 * @fileoverview Web Speech API(음성 → 텍스트) 래퍼 훅.
 * 브라우저 내장 webkitSpeechRecognition/SpeechRecognition을 감싸서
 * 지원 여부 · 녹음 상태 · 누적 텍스트 콜백을 컴포넌트에 노출한다.
 * 정책: continuous=true, 자동 종료 X — 사용자가 stop()을 호출해야만 멈춘다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToastStore } from '../components/common/Toast';

/**
 * 음성 인식 훅.
 * @param {object} [options]
 * @param {string} [options.lang='ko-KR'] 인식 언어.
 * @param {boolean} [options.continuous=true] 긴 발화도 이어붙여 인식.
 * @param {boolean} [options.interimResults=true] 중간 결과도 콜백에 포함.
 * @param {(transcript: string, meta: { isFinal: boolean }) => void} [options.onTranscript]
 *   콜백. 세션 누적 텍스트(final + 현재 interim)를 매번 전달. isFinal은 이번 이벤트가
 *   최종 확정 결과를 포함했는지 여부.
 * @returns {{ supported: boolean, listening: boolean, start: () => void, stop: () => void }}
 */
export default function useSpeechRecognition({
  lang = 'ko-KR',
  continuous = true,
  interimResults = true,
  onTranscript,
} = {}) {
  const recognitionRef = useRef(null);
  const finalBufferRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);
  const [listening, setListening] = useState(false);

  // 콜백은 ref로 보관 — 인식 인스턴스를 매번 재생성하지 않기 위함.
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const supported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    // 핸들러를 먼저 떼서 stop 이후 지연 도착하는 onresult/onend가 상위 상태를 오염시키지
    // 않도록 한다 (예: 전송 직후 잔여 transcript가 textarea를 다시 채우는 현상 방지).
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.stop();
    } catch {
      // 이미 멈춘 상태면 무시
    }
    recognitionRef.current = null;
    finalBufferRef.current = '';
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      useToastStore
        .getState()
        .addToast('이 브라우저는 음성 인식을 지원하지 않습니다.', 'error');
      return;
    }
    if (recognitionRef.current) return; // 중복 시작 방지

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = interimResults;

    finalBufferRef.current = '';

    rec.onresult = (event) => {
      let interim = '';
      let sawFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalBufferRef.current += text;
          sawFinal = true;
        } else {
          interim += text;
        }
      }
      const combined = (finalBufferRef.current + interim).trim();
      onTranscriptRef.current?.(combined, { isFinal: sawFinal });
    };

    rec.onerror = (event) => {
      const errType = event?.error;
      if (errType === 'not-allowed' || errType === 'service-not-allowed') {
        useToastStore.getState().addToast('마이크 권한이 필요합니다.', 'error');
      } else if (errType === 'no-speech' || errType === 'aborted') {
        // 흔하거나 사용자 중지라 조용히 무시
      } else if (errType) {
        useToastStore.getState().addToast(`음성 인식 오류: ${errType}`, 'error');
      }
    };

    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
    }
  }, [supported, lang, continuous, interimResults]);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        rec.onend = null;
        rec.onresult = null;
        rec.onerror = null;
        try {
          rec.stop();
        } catch {
          // 이미 멈춘 경우
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return { supported, listening, start, stop };
}
