import { useCallback } from 'react';
import { FileText, Trash2, FolderOpen } from 'lucide-react';
import useRagStore from '../../stores/useRagStore';
import { deleteDocument } from '../../services/ragApi';
import { DOC_STATUS } from '../../utils/constants';
import { useToastStore } from '../common/Toast';
import Badge from '../common/Badge';

const STATUS_BADGE_COLOR = {
  processing: 'yellow',
  indexing: 'yellow',
  completed: 'green',
  error: 'red',
};

export default function DocumentList() {
  const ragDocs = useRagStore((s) => s.ragDocs);
  const removeDoc = useRagStore((s) => s.removeDoc);
  const addToast = useToastStore((s) => s.addToast);

  const completedDocs = ragDocs.filter((d) => d.status === 'completed');
  const totalChunks = completedDocs.reduce((sum, d) => sum + (d.chunks || 0), 0);

  const handleDelete = useCallback(
    async (id) => {
      try {
        await deleteDocument(id);
        removeDoc(id);
        addToast('문서가 삭제되었습니다', 'success');
      } catch {
        addToast('문서 삭제에 실패했습니다', 'error');
      }
    },
    [removeDoc, addToast],
  );

  if (ragDocs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <FolderOpen size={40} className="text-text-tertiary mb-3" />
        <p className="text-sm text-text-secondary">
          업로드된 문서가 없습니다
        </p>
        <p className="text-xs text-text-tertiary mt-1">
          PDF 문서를 업로드하여 RAG 검색을 시작하세요
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider px-3 py-2">
        문서 목록
      </h3>

      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {ragDocs.map((doc) => {
          const status = DOC_STATUS[doc.status] || DOC_STATUS.error;
          const badgeColor = STATUS_BADGE_COLOR[doc.status] || 'gray';

          return (
            <div
              key={doc.id}
              className="
                group flex items-start gap-2 p-2 rounded-lg
                hover:bg-bg-tertiary transition-colors
              "
            >
              <FileText size={16} className="text-text-tertiary shrink-0 mt-0.5" />

              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">
                  {doc.fileName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-text-tertiary">
                    {doc.pages}p
                  </span>
                  <span className="text-xs text-text-tertiary">
                    {doc.chunks}청크
                  </span>
                  <Badge color={badgeColor}>{status.label}</Badge>
                </div>
              </div>

              <button
                onClick={() => handleDelete(doc.id)}
                className="
                  shrink-0 p-1 rounded
                  text-text-tertiary hover:text-danger
                  opacity-0 group-hover:opacity-100
                  transition-all
                "
                aria-label={`${doc.fileName} 삭제`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* 하단 요약 */}
      <div className="border-t border-border-light px-3 py-2 text-xs text-text-tertiary">
        문서: {completedDocs.length} | 청크: {totalChunks}
      </div>
    </div>
  );
}
