import { Paperclip } from 'lucide-react';

export default function SourceCard({ sources }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <span className="text-xs text-text-tertiary font-medium">출처</span>
      {sources.map((source, idx) => (
        <div
          key={idx}
          className="
            flex items-center gap-2 px-3 py-2
            bg-bg-secondary border border-border-light rounded-lg
            text-sm cursor-default
          "
        >
          <Paperclip size={14} className="text-text-tertiary shrink-0" />
          <span className="text-text-primary truncate">
            {source.docName}
          </span>
          {source.page != null && (
            <span className="text-text-tertiary text-xs shrink-0">
              p.{source.page}
            </span>
          )}
          {source.similarity != null && (
            <span className="
              ml-auto shrink-0 text-xs font-medium
              px-1.5 py-0.5 rounded-full
              bg-primary/10 text-primary
            ">
              {Math.round(source.similarity * 100)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
