/**
 * @fileoverview AI 메시지 버블 하단에 붙는 출처 팝오버.
 *
 * 클릭 토글 방식:
 *   - 📎 아이콘 + 근거 개수 배지의 작은 버튼
 *   - 클릭하면 버튼 바로 아래로 팝오버가 열려 5개 이하의 근거 카드를 보여주고,
 *     다시 클릭하거나 외부 클릭 시 닫힌다.
 *   - 팝오버 안 카드를 클릭하면 {@link SourceDetailModal} 로 원문 전체를 본다.
 *
 * 이 컴포넌트는 메시지별로 하나씩 마운트되므로, 여러 메시지의 팝오버가 동시에
 * 열리는 것도 자연스럽다. (각자 자신의 state 를 가진다)
 */
import { useEffect, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import SourceDetailModal from './SourceDetailModal';

/** 유사도 → 배지 색상 클래스. */
function similarityClass(sim) {
  if (sim == null) return 'bg-bg-tertiary text-text-tertiary';
  if (sim >= 0.85) return 'bg-success/10 text-success';
  if (sim >= 0.7) return 'bg-warning/10 text-warning';
  return 'bg-bg-tertiary text-text-secondary';
}

/**
 * @param {object} props
 * @param {Array<object>} props.sources 근거 청크 배열. 비어있거나 null 이면 렌더하지 않는다.
 */
export default function SourcesPopover({ sources }) {
  const [isOpen, setIsOpen] = useState(false);
  const [modalSource, setModalSource] = useState(null);
  const rootRef = useRef(null);

  // 외부 클릭 시 닫기. 모달이 떠 있는 동안에는 모달 바깥 클릭으로 모달이 닫히게
  // 처리되므로 팝오버의 외부 클릭 감지는 잠시 중단한다.
  useEffect(() => {
    if (!isOpen || modalSource) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isOpen, modalSource]);

  if (!sources || sources.length === 0) return null;

  const count = sources.length;

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsOpen((v) => !v); }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`출처 ${count}개 보기`}
        className="
          inline-flex items-center gap-1 px-1.5 py-1 rounded
          text-text-secondary hover:text-text-primary hover:bg-bg-tertiary
          transition-colors
        "
      >
        <Paperclip size={14} />
        <span className="text-xs font-medium">{count}</span>
      </button>

      {isOpen && (
        <div
          className="
            absolute z-40 mt-1 right-0
            w-80 max-h-80 overflow-y-auto
            rounded-lg border border-border-light bg-bg-primary shadow-lg
            p-2
          "
          role="dialog"
          // 팝오버 내부 클릭이 버블의 기타 핸들러로 전파되지 않도록 차단.
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[11px] text-text-tertiary font-medium">
            이 답변의 근거 · {count}건 (클릭하면 원문 전체 보기)
          </div>
          <ul className="flex flex-col gap-1.5">
            {sources.map((s, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => setModalSource(s)}
                  className="
                    w-full text-left rounded-md border border-border-light
                    bg-bg-secondary hover:bg-bg-tertiary
                    p-2.5 flex flex-col gap-1 transition-colors
                  "
                >
                  <div className="flex items-start gap-2">
                    <Paperclip size={11} className="text-text-tertiary shrink-0 mt-0.5" />
                    <span className="text-xs text-text-primary break-all">
                      {s.docName || '문서명 없음'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
                    {s.page != null && <span>p.{s.page}</span>}
                    {s.similarity != null && (
                      <span
                        className={`ml-auto px-1.5 py-0.5 rounded-full font-medium ${similarityClass(s.similarity)}`}
                      >
                        {Math.round(s.similarity * 100)}%
                      </span>
                    )}
                  </div>
                  {(s.snippet || s.chunk) && (
                    <p className="text-[11px] text-text-secondary whitespace-pre-wrap break-words leading-relaxed line-clamp-3">
                      {s.snippet || s.chunk}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SourceDetailModal source={modalSource} onClose={() => setModalSource(null)} />
    </div>
  );
}
