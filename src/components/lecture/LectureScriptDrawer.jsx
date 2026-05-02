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
import { X, Loader2, Sparkles, RefreshCw, Film } from 'lucide-react';
import { fetchLectureScript, streamLectureScript } from '../../services/lectureApi';
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
 */
export default function LectureScriptDrawer({ open, onClose, docId, chapter }) {
  const [loading, setLoading] = useState(false);   // 초기 fetch 로딩
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState('');
  const [hasScript, setHasScript] = useState(false);
  const abortRef = useRef(null);

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
            <article className="prose prose-sm max-w-none text-text-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                {displayContent}
              </ReactMarkdown>
            </article>
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
