/**
 * @fileoverview RAG 문서 업로더 컴포넌트.
 * 드래그 앤 드롭 또는 클릭으로 PDF를 업로드하고, 업로드 상태를 실시간 표시한다.
 */
import { FileText, CheckCircle, Loader } from 'lucide-react';
import Button from '../common/Button';
import useDocStore from '../../stores/useDocStore';
import { DOC_STATUS } from '../../utils/constants';

/** 업로드된 문서 목록 표시 컴포넌트 (업로드는 사이드바 PDF 업로드 모달에서 수행) */
export default function RagUploader({ onDone }) {
  const docs = useDocStore((s) => s.docs);

  return (
    <div className="flex flex-col gap-5">
      {docs.length > 0 && (
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
          {docs.map((doc) => {
            const status = DOC_STATUS[doc.status] || DOC_STATUS.processing;
            return (
              <div key={doc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-secondary">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-text-primary flex-1 truncate">{doc.fileName}</span>
                <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                  {doc.status === 'completed'
                    ? <CheckCircle className="w-3.5 h-3.5" />
                    : <Loader className="w-3.5 h-3.5 animate-spin" />
                  }
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {onDone && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onDone}>완료</Button>
        </div>
      )}
    </div>
  );
}
