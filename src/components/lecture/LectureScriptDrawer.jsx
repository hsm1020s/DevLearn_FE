/**
 * @fileoverview 강의 대본(Phase 1) 드로워.
 *
 * 마인드맵이 완료된 챕터에서 "📺 강의" 버튼으로 열리며,
 * 저장된 대본이 있으면 즉시 표시, 없으면 "생성" 버튼 노출.
 * 생성 시 SSE 로 토큰을 누적해 실시간 렌더하고, 완료되면 디스크에 저장된다.
 *
 * `[SLIDE: ...]` 마커 라인은 본문에서 시각적으로 강조 표시한다.
 */
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { X, Loader2, Sparkles, RefreshCw, Film, Music, Presentation, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchLectureScript, streamLectureScript,
  lectureAudioUrl, lectureAudioExists, streamLectureAudio,
  fetchLectureSlides, fetchLectureSlideTimings, lectureSlideImageUrl, streamLectureSlides,
} from '../../services/lectureApi';
import { showError } from '../../utils/errorHandler';

/** [SLIDE: ...] 라인을 별도 배지 컴포넌트로 분리. */
function transformSlideMarkers(text) {
  if (!text) return '';
  // 라인 단위로 [SLIDE: ...] 를 마크다운 인용구 + 강조 형태로 치환.
  return text.replace(/^\[SLIDE:\s*(.+?)\]\s*$/gm, (_m, title) => `> 🎬 **슬라이드:** ${title.trim()}`);
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {Function} props.onClose
 * @param {string} props.docId
 * @param {string} props.chapter
 * @param {boolean} [props.audioExistsHint] - 부모가 알려준 오디오 존재 여부 (즉시 player 노출).
 * @param {boolean} [props.slidesExistsHint] - 부모가 알려준 슬라이드 존재 여부.
 */
export default function LectureScriptDrawer({ open, onClose, docId, chapter, audioExistsHint, slidesExistsHint }) {
  const [loading, setLoading] = useState(false);   // 초기 fetch 로딩
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState('');
  const [hasScript, setHasScript] = useState(false);
  const abortRef = useRef(null);

  // 오디오 (Phase 2)
  const [audioUrl, setAudioUrl] = useState(null);   // Blob URL 또는 null
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [audioStartedAt, setAudioStartedAt] = useState(0);
  const [, setAudioTick] = useState(0);
  const audioAbortRef = useRef(null);

  // 생성 중 1초 tick (elapsed 표시)
  useEffect(() => {
    if (!audioGenerating) return undefined;
    const id = setInterval(() => setAudioTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [audioGenerating]);

  // 슬라이드 (Phase 3)
  const [slidesData, setSlidesData] = useState(null);   // {totalChars, slides: [{index,title,bullets,...}]}
  const [slideTimings, setSlideTimings] = useState(null); // {totalChars, slides: [{index,startCharRatio,endCharRatio}]}
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [slidesGenerating, setSlidesGenerating] = useState(false);
  const [slidesStartedAt, setSlidesStartedAt] = useState(0);
  const [, setSlidesTick] = useState(0);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [autoSync, setAutoSync] = useState(true);
  const audioRef = useRef(null);
  const slidesAbortRef = useRef(null);

  useEffect(() => {
    if (!slidesGenerating) return undefined;
    const id = setInterval(() => setSlidesTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [slidesGenerating]);

  // 드로워 열릴 때 저장된 대본 조회
  useEffect(() => {
    if (!open || !docId || !chapter) return;
    let cancelled = false;
    setLoading(true);
    setContent('');
    setHasScript(false);
    fetchLectureScript(docId, chapter)
      .then((text) => {
        if (cancelled) return;
        if (text) {
          setContent(text);
          setHasScript(true);
        }
      })
      .catch((err) => {
        if (!cancelled) showError(err, '강의 대본을 불러올 수 없습니다');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, docId, chapter]);

  // 진행 중이던 스트림 정리
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setGenerating(false);
    }
  }, [open]);

  // 드로워 열릴 때 audio.mp3 존재 여부 확인 → 있으면 직접 URL 셋.
  // 부모가 audioExistsHint=true 로 알려주면 즉시 player 노출(존재 확인 fetch 스킵).
  useEffect(() => {
    if (!open || !docId || !chapter) return undefined;
    let cancelled = false;
    if (audioExistsHint === true) {
      setAudioUrl(lectureAudioUrl(docId, chapter));
      setAudioLoading(false);
      return () => { cancelled = true; };
    }
    setAudioLoading(true);
    setAudioUrl(null);
    lectureAudioExists(docId, chapter)
      .then((exists) => {
        if (cancelled) return;
        if (exists) setAudioUrl(lectureAudioUrl(docId, chapter));
      })
      .finally(() => { if (!cancelled) setAudioLoading(false); });
    return () => { cancelled = true; };
  }, [open, docId, chapter, audioExistsHint]);

  // 드로워 닫힐 때 audio 진행 중 abort
  useEffect(() => {
    if (!open && audioAbortRef.current) {
      audioAbortRef.current.abort();
      audioAbortRef.current = null;
      setAudioGenerating(false);
    }
  }, [open]);

  const handleGenerateAudio = async () => {
    if (audioGenerating || !hasScript) return;
    setAudioGenerating(true);
    setAudioStartedAt(Date.now());
    setAudioUrl(null);
    const controller = new AbortController();
    audioAbortRef.current = controller;
    try {
      await streamLectureAudio({
        docId,
        chapter,
        onDone: () => {
          if (controller.signal.aborted) return;
          // 생성 완료 → 직접 URL 로 셋. 토큰 만료 가능성 작아 query param 형태로 충분.
          setAudioUrl(lectureAudioUrl(docId, chapter));
        },
        signal: controller.signal,
      });
    } catch (err) {
      if (!controller.signal.aborted) showError(err, '오디오 생성 실패');
    } finally {
      audioAbortRef.current = null;
      setAudioGenerating(false);
    }
  };

  const handleAudioAbort = () => {
    if (audioAbortRef.current) {
      audioAbortRef.current.abort();
      audioAbortRef.current = null;
      setAudioGenerating(false);
    }
  };

  // 슬라이드 데이터 로드
  const loadSlides = async (cancelledRef) => {
    setSlidesLoading(true);
    try {
      const [data, timings] = await Promise.all([
        fetchLectureSlides(docId, chapter),
        fetchLectureSlideTimings(docId, chapter),
      ]);
      if (cancelledRef.current) return;
      setSlidesData(data);
      setSlideTimings(timings);
      setCurrentSlideIdx(0);
    } catch { /* 비치명 */ }
    finally { if (!cancelledRef.current) setSlidesLoading(false); }
  };

  useEffect(() => {
    if (!open || !docId || !chapter) return undefined;
    const cancelled = { current: false };
    if (slidesExistsHint === false) {
      // 부모가 명시적으로 없다고 알려준 경우만 fetch 스킵
      setSlidesData(null); setSlideTimings(null); setSlidesLoading(false);
      return () => { cancelled.current = true; };
    }
    loadSlides(cancelled);
    return () => { cancelled.current = true; };
  }, [open, docId, chapter, slidesExistsHint]);

  const handleGenerateSlides = async () => {
    if (slidesGenerating || !hasScript) return;
    setSlidesGenerating(true);
    setSlidesStartedAt(Date.now());
    setSlidesData(null); setSlideTimings(null);
    const controller = new AbortController();
    slidesAbortRef.current = controller;
    try {
      await streamLectureSlides({
        docId, chapter,
        onDone: () => {
          if (controller.signal.aborted) return;
          loadSlides({ current: false });
        },
        signal: controller.signal,
      });
    } catch (err) {
      if (!controller.signal.aborted) showError(err, '슬라이드 생성 실패');
    } finally {
      slidesAbortRef.current = null;
      setSlidesGenerating(false);
    }
  };

  const handleSlidesAbort = () => {
    if (slidesAbortRef.current) {
      slidesAbortRef.current.abort();
      slidesAbortRef.current = null;
      setSlidesGenerating(false);
    }
  };

  // audio.currentTime → slide index 자동 sync
  useEffect(() => {
    if (!autoSync || !audioRef.current || !slideTimings?.slides?.length) return undefined;
    const audio = audioRef.current;
    const handler = () => {
      const ratio = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
      const idx = slideTimings.slides.findIndex(
        (s) => ratio >= s.startCharRatio && ratio < s.endCharRatio,
      );
      if (idx >= 0 && idx !== currentSlideIdx) setCurrentSlideIdx(idx);
    };
    audio.addEventListener('timeupdate', handler);
    return () => audio.removeEventListener('timeupdate', handler);
  }, [autoSync, slideTimings, currentSlideIdx]);

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setContent('');
    setHasScript(false);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamLectureScript({
        docId,
        chapter,
        onToken: (acc) => {
          if (!controller.signal.aborted) setContent(acc);
        },
        onDone: ({ content: finalText }) => {
          if (!controller.signal.aborted) {
            setContent(finalText);
            setHasScript(true);
          }
        },
        signal: controller.signal,
      });
    } catch (err) {
      if (!controller.signal.aborted) showError(err, '강의 대본 생성 실패');
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  };

  const handleAbort = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setGenerating(false);
    }
  };

  if (!open) return null;

  const displayContent = transformSlideMarkers(content);

  return (
    <>
      {/* 백드롭 */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      {/* 드로워 */}
      <aside
        className="fixed top-0 right-0 z-50 h-full w-full sm:w-[600px]
          bg-bg-primary border-l border-border-light shadow-xl
          flex flex-col"
        role="dialog"
        aria-label="강의 대본"
      >
        {/* 헤더 */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border-light shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Film size={18} className="text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text-primary truncate">강의 대본</div>
              <div className="text-xs text-text-tertiary truncate">{chapter}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasScript && !generating && (
              <button
                onClick={handleGenerate}
                className="p-2 rounded-md hover:bg-bg-secondary transition-colors text-text-secondary"
                aria-label="다시 생성"
                title="다시 생성"
              >
                <RefreshCw size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-bg-secondary transition-colors text-text-tertiary"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          ) : !hasScript && !generating && !content ? (
            // 빈 상태 — 생성 버튼
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles size={26} className="text-primary" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-text-primary">아직 강의 대본이 없습니다</div>
                <div className="text-xs text-text-tertiary">
                  마인드맵 + 챕터 본문으로 8~15분 분량 대본을 만듭니다 (1~3분 소요)
                </div>
              </div>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90
                  transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Sparkles size={14} />
                강의 대본 생성
              </button>
            </div>
          ) : (
            <>
              {/* 슬라이드 섹션 — 스크립트가 있을 때만 노출 */}
              <section className="mb-4 p-3 rounded-lg border border-border-light bg-bg-secondary/30">
                <div className="flex items-center gap-2 mb-2">
                  <Presentation size={14} className="text-primary shrink-0" />
                  <div className="text-xs font-semibold text-text-primary flex-1">강의 슬라이드</div>
                  {slidesData && !slidesGenerating && (
                    <>
                      <label className="text-[11px] text-text-tertiary flex items-center gap-1 cursor-pointer select-none">
                        <input type="checkbox" checked={autoSync}
                          onChange={(e) => setAutoSync(e.target.checked)}
                          className="w-3 h-3 accent-primary" />
                        재생 sync
                      </label>
                      <button
                        onClick={handleGenerateSlides}
                        className="text-[11px] text-text-tertiary hover:text-primary transition-colors flex items-center gap-1"
                        title="슬라이드 다시 생성"
                      >
                        <RefreshCw size={11} />재생성
                      </button>
                    </>
                  )}
                </div>

                {slidesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-text-tertiary">
                    <Loader2 size={12} className="animate-spin" />슬라이드 확인 중...
                  </div>
                ) : slidesGenerating ? (
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="flex-1">
                      슬라이드 생성 중... ({Math.floor((Date.now() - slidesStartedAt) / 1000)}초)
                    </span>
                    <button onClick={handleSlidesAbort}
                      className="text-text-tertiary hover:text-text-primary transition-colors">중단</button>
                  </div>
                ) : slidesData && slidesData.slides?.length > 0 ? (
                  <div className="space-y-2">
                    <div className="relative w-full aspect-[16/9] rounded overflow-hidden bg-bg-tertiary border border-border-light">
                      <img
                        key={currentSlideIdx}
                        src={lectureSlideImageUrl(docId, chapter, currentSlideIdx)}
                        alt={`슬라이드 ${currentSlideIdx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentSlideIdx((i) => Math.max(0, i - 1))}
                        disabled={currentSlideIdx === 0}
                        className="p-1 rounded hover:bg-bg-tertiary disabled:opacity-30 transition-colors"
                      ><ChevronLeft size={16} /></button>
                      <span className="flex-1 text-center text-xs text-text-secondary">
                        {currentSlideIdx + 1} / {slidesData.slides.length}
                        {slidesData.slides[currentSlideIdx]?.title && (
                          <span className="ml-2 text-text-tertiary truncate">
                            · {slidesData.slides[currentSlideIdx].title}
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => setCurrentSlideIdx((i) => Math.min(slidesData.slides.length - 1, i + 1))}
                        disabled={currentSlideIdx >= slidesData.slides.length - 1}
                        className="p-1 rounded hover:bg-bg-tertiary disabled:opacity-30 transition-colors"
                      ><ChevronRight size={16} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-text-tertiary">
                      gpt-5.4-mini 로 bullet 추출 + Playwright 캡처 (~30~60초)
                    </div>
                    <button
                      onClick={handleGenerateSlides}
                      className="px-3 py-1.5 rounded text-xs font-medium text-white bg-primary
                        hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                    >
                      <Presentation size={12} />슬라이드 생성
                    </button>
                  </div>
                )}
              </section>

              {/* 오디오 섹션 — 스크립트가 있을 때만 노출 */}
              <section className="mb-4 p-3 rounded-lg border border-border-light bg-bg-secondary/30">
                <div className="flex items-center gap-2 mb-2">
                  <Music size={14} className="text-primary shrink-0" />
                  <div className="text-xs font-semibold text-text-primary flex-1">강의 오디오 (TTS)</div>
                  {audioUrl && !audioGenerating && (
                    <button
                      onClick={handleGenerateAudio}
                      className="text-[11px] text-text-tertiary hover:text-primary transition-colors flex items-center gap-1"
                      title="오디오 다시 생성"
                    >
                      <RefreshCw size={11} />
                      재생성
                    </button>
                  )}
                </div>

                {audioLoading ? (
                  <div className="flex items-center gap-2 text-xs text-text-tertiary">
                    <Loader2 size={12} className="animate-spin" />
                    오디오 확인 중...
                  </div>
                ) : audioGenerating ? (
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="flex-1">
                      오디오 생성 중... ({Math.floor((Date.now() - audioStartedAt) / 1000)}초)
                    </span>
                    <button
                      onClick={handleAudioAbort}
                      className="text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      중단
                    </button>
                  </div>
                ) : audioUrl ? (
                  <audio
                    ref={audioRef}
                    controls
                    preload="auto"
                    src={audioUrl}
                    className="w-full"
                    onError={(e) => {
                      const el = e.currentTarget;
                      const err = el.error;
                      // eslint-disable-next-line no-console
                      console.error('[Lecture Audio] error', {
                        audioUrl,
                        networkState: el.networkState,
                        readyState: el.readyState,
                        currentSrc: el.currentSrc,
                        error: err ? { code: err.code, message: err.message } : null,
                      });
                      showError(new Error(`오디오 로드 실패 (network=${el.networkState}, ready=${el.readyState})`),
                        '오디오 재생 오류 — DevTools 콘솔 확인');
                    }}
                    onLoadedMetadata={(e) => {
                      // eslint-disable-next-line no-console
                      console.log('[Lecture Audio] loadedmetadata', { duration: e.currentTarget.duration });
                    }}
                  >
                    브라우저가 오디오 재생을 지원하지 않습니다.
                  </audio>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-text-tertiary">
                      OpenAI TTS (nova) · 챕터당 1~2분, ~$0.075
                    </div>
                    <button
                      onClick={handleGenerateAudio}
                      className="px-3 py-1.5 rounded text-xs font-medium text-white bg-primary
                        hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                    >
                      <Music size={12} />
                      오디오 생성
                    </button>
                  </div>
                )}
              </section>

              <article className="prose prose-sm max-w-none text-text-primary">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                  {displayContent}
                </ReactMarkdown>
              </article>
            </>
          )}
        </div>

        {/* 푸터 — 스트리밍 상태 */}
        {generating && (
          <footer className="border-t border-border-light px-4 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs text-primary">
              <Loader2 size={12} className="animate-spin" />
              생성 중... ({content.length}자)
            </div>
            <button
              onClick={handleAbort}
              className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
            >
              중단
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
