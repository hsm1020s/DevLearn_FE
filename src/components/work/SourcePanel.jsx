/**
 * @fileoverview RAG 응답의 참고 출처(소스) 표시 패널.
 * 문서명, 페이지, 유사도 점수, 청크 미리보기를 카드 형태로 나열한다.
 */
import { Paperclip } from 'lucide-react';

/** AI 응답에 사용된 참고 출처 목록 표시 */
export default function SourcePanel({ sources }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      <span className="text-xs font-medium text-text-tertiary">참고 출처</span>

      <div className="flex flex-col gap-2">
        {sources.map((source, idx) => (
          <div
            key={`${source.docId}-${source.page}-${idx}`}
            className="
              bg-bg-secondary rounded-lg border border-border-light
              p-3 flex flex-col gap-2
            "
          >
            <div className="flex items-center gap-2">
              <Paperclip size={14} className="text-text-tertiary shrink-0" />
              <span className="text-sm text-text-primary truncate">
                {source.docName}
              </span>
              {source.page != null && (
                <span className="text-xs text-text-tertiary shrink-0">
                  (page {source.page})
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

            {source.chunk && (
              <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                {source.chunk}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
