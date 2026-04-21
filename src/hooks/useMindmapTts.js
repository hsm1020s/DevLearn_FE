/**
 * @fileoverview 마인드맵 TTS(음성 읽기) 재생 엔진 훅.
 * - 브라우저 내장 SpeechSynthesis API 래핑
 * - buildTtsScript(nodes) 로 얻은 스크립트를 순차 발화
 * - 각 utterance onstart 시점에 스토어 playingNodeId 갱신 → 노드 하이라이트 이동
 * - 재생/일시정지/정지 + 맵 전환/노드 삭제 시 자동 정지
 */
import { useCallback, useEffect, useRef } from 'react';
import useMindmapStore from '../stores/useMindmapStore';
import { buildTtsScript } from '../utils/mindmapTts';

/** 낭독 속도 — 너무 빠르면 한국어가 뭉개지고 1.0 이 가장 자연스러움 */
const TTS_RATE = 1.0;
const TTS_PITCH = 1.0;
const TTS_LANG = 'ko-KR';

/** 브라우저가 SpeechSynthesis를 지원하는가? */
const isSpeechSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * 마인드맵 TTS 재생 훅.
 *
 * @returns {{
 *   play: () => void,
 *   pause: () => void,
 *   stop: () => void,
 *   status: 'idle'|'playing'|'paused',
 *   supported: boolean,
 *   hasReadableContent: boolean,
 * }}
 */
export function useMindmapTts() {
  const supported = isSpeechSupported();

  const activeMapId = useMindmapStore((s) => s.activeMapId);
  const nodes = useMindmapStore((s) => {
    const m = s.maps[s.activeMapId];
    return m ? m.nodes : [];
  });
  const playingNodeId = useMindmapStore((s) => s.playingNodeId);
  const ttsStatus = useMindmapStore((s) => s.ttsStatus);
  const setPlayingNode = useMindmapStore((s) => s.setPlayingNode);
  const setTtsStatus = useMindmapStore((s) => s.setTtsStatus);
  const resetTts = useMindmapStore((s) => s.resetTts);

  /** 현재 재생 중인 스크립트 배열 (정지 시 클리어) */
  const scriptRef = useRef([]);
  /** 현재 재생 중인 스크립트 인덱스 */
  const indexRef = useRef(0);
  /** 캐시된 한국어 voice */
  const koVoiceRef = useRef(null);
  /**
   * stop() 실행 직후 일부 브라우저에서 pending utterance의 onend가 뒤늦게
   * 발화하는 문제를 차단하기 위한 플래그. speakAt()의 onend에서 이 값이
   * true면 다음 엔트리 재생을 건너뛴다.
   */
  const cancellingRef = useRef(false);

  // 한국어 voice 비동기 로드 — Chrome은 첫 호출 시 getVoices()가 빈 배열을
  // 반환하고 voiceschanged 이벤트가 뒤따른다.
  useEffect(() => {
    if (!supported) return undefined;
    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const ko = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('ko'));
      if (ko) koVoiceRef.current = ko;
    };
    loadVoice();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoice);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoice);
  }, [supported]);

  /** 재생 상태 완전 초기화 — speechSynthesis 큐 비우고 하이라이트 제거 */
  const stop = useCallback(() => {
    if (!supported) return;
    cancellingRef.current = true;
    window.speechSynthesis.cancel();
    scriptRef.current = [];
    indexRef.current = 0;
    resetTts();
    // cancel()은 비동기로 onend를 밀어낼 수 있어 다음 tick까지 flag 유지
    setTimeout(() => { cancellingRef.current = false; }, 0);
  }, [supported, resetTts]);

  /** idx 번째 스크립트 엔트리를 발화. 끝나면 재귀적으로 다음 엔트리 진행. */
  const speakAt = useCallback((idx) => {
    if (!supported) return;
    const entry = scriptRef.current[idx];
    if (!entry) {
      // 모든 엔트리 소진 → 깔끔히 idle로 복귀
      scriptRef.current = [];
      indexRef.current = 0;
      resetTts();
      return;
    }
    indexRef.current = idx;
    const utter = new SpeechSynthesisUtterance(entry.text);
    utter.lang = TTS_LANG;
    utter.rate = TTS_RATE;
    utter.pitch = TTS_PITCH;
    if (koVoiceRef.current) utter.voice = koVoiceRef.current;

    utter.onstart = () => {
      // nodeId가 null이면 안내 문장 낭독 중 — 하이라이트 없음
      setPlayingNode(entry.nodeId);
    };
    utter.onend = () => {
      if (cancellingRef.current) return;
      speakAt(idx + 1);
    };
    utter.onerror = (e) => {
      // stop()/맵 전환으로 인한 interrupt는 정상 경로 — 조용히 무시
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      // 그 외 음성 엔진 에러는 로그만 남기고 종료
      console.warn('[mindmap-tts] utterance error:', e.error);
      resetTts();
    };
    window.speechSynthesis.speak(utter);
  }, [supported, setPlayingNode, resetTts]);

  /** 재생 시작 또는 일시정지 상태에서 재개 */
  const play = useCallback(() => {
    if (!supported) return;

    if (ttsStatus === 'paused') {
      window.speechSynthesis.resume();
      setTtsStatus('playing');
      return;
    }
    // 이미 재생 중이면 중복 호출 무시
    if (ttsStatus === 'playing') return;

    const script = buildTtsScript(nodes);
    if (script.length === 0) return;

    cancellingRef.current = false;
    scriptRef.current = script;
    indexRef.current = 0;
    setTtsStatus('playing');
    speakAt(0);
  }, [supported, ttsStatus, nodes, setTtsStatus, speakAt]);

  /** 현재 문장 끝까지 말하지 않고 즉시 pause — 하이라이트는 유지 */
  const pause = useCallback(() => {
    if (!supported) return;
    if (ttsStatus !== 'playing') return;
    window.speechSynthesis.pause();
    setTtsStatus('paused');
  }, [supported, ttsStatus, setTtsStatus]);

  // 활성 맵이 바뀌면 무조건 정지 — 이전 맵의 노드를 계속 읽는 일 없도록
  useEffect(() => {
    stop();
    // activeMapId 변화시에만 실행 (stop은 useCallback으로 안정)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMapId]);

  // 언마운트 시 safeguard — 재생 중이었다면 브라우저에 잔여 발화 남지 않도록
  useEffect(() => () => {
    if (isSpeechSupported()) window.speechSynthesis.cancel();
  }, []);

  // 재생 중인 노드가 삭제되면 정지 (safety net)
  useEffect(() => {
    if (!playingNodeId) return;
    if (!nodes.some((n) => n.id === playingNodeId)) {
      stop();
    }
  }, [playingNodeId, nodes, stop]);

  // 낭독할 스크립트가 실제로 있는지 (빈 맵에서는 버튼 disable)
  const hasReadableContent = nodes.some((n) => n.label && n.label.trim());

  return { play, pause, stop, status: ttsStatus, supported, hasReadableContent };
}
