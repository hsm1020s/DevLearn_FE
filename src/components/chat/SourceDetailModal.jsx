/**
 * @fileoverview 출처 원문 상세 모달.
 * SourcesPopover 의 카드를 클릭했을 때 띄우는 풀 본문 뷰.
 * backdrop / ESC / X 버튼 어느 것으로도 닫을 수 있다.
 */
import { useEffect } from 'react';
import { X, FileText } from 'lucide-react';

/** 유사도 → 색상 클래스 (SourcesPopover 와 동일 규칙). */
function similarityClass(sim) {
  if (sim == null) return 'bg-bg-tertiary text-text-tertiary';
  if (sim >= 0.85) return 'bg-success/10 text-success';
  if (sim >= 0.7) return 'bg-warning/10 text-warning';
  return 'bg-bg-tertiary text-text-secondary';
}

/**
 * @param {object} props
 * @param {object|null} props.source source=null 이면 아무것도 렌더하지 않는다.
 * @param {() => void} props.onClose 닫기 콜백
 */
export default function SourceDetailModal({ source, onClose }) {
  // ESC 키 닫기 — source 있을 때만 바인딩해서 불필요한 글로벌 리스너 방지.
  useEffect(() => {
    if (!source) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [source, onClose]);

  if (!source) return null;

  const body = source.chunk || source.snippet || '(원문이 저장되지 않았습니다)';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-bg-primary border border-border-light rounded-xl shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 px-5 py-4 border-b border-border-light">
          <FileText size={16} className="text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary break-all">
              {source.docName || '문서명 없음'}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-text-tertiary">
              {source.page != null && <span>p.{source.page}</span>}
              {source.similarity != null && (
                <span className={`px-1.5 py-0.5 rounded-full font-medium ${similarityClass(source.similarity)}`}>
                  유사도 {Math.round(source.similarity * 100)}%
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm text-text-primary whitespace-pre-wrap break-words leading-relaxed">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}
