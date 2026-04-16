/**
 * @fileoverview RAG 문서 업로더 컴포넌트.
 * 드래그 앤 드롭 또는 클릭으로 PDF를 업로드하고, 업로드 상태를 실시간 표시한다.
 */
import { FileText, CheckCircle, Loader } from 'lucide-react';
import Button from '../common/Button';
import FileDropZone from '../common/FileDropZone';
import useRagStore from '../../stores/useRagStore';
import { uploadDocument } from '../../services/ragApi';
import { DOC_STATUS } from '../../utils/constants';
import { showError, showSuccess } from '../../utils/errorHandler';

/** PDF 파일 드래그 앤 드롭/클릭 업로드 컴포넌트 */
export default function RagUploader({ onDone }) {
  const ragDocs = useRagStore((s) => s.ragDocs);
  const addDoc = useRagStore((s) => s.addDoc);
  const updateDocStatus = useRagStore((s) => s.updateDocStatus);
  const updateDocInfo = useRagStore((s) => s.updateDocInfo);

  // PDF 파일 목록을 순회하며 업로드 후 스토어에 결과 반영
  const handleFiles = async (files) => {
    for (const file of files) {
      if (file.type !== 'application/pdf') continue;
      const doc = addDoc({ fileName: file.name, pages: 0, chunks: 0 });
      try {
        const result = await uploadDocument(file);
        updateDocStatus(doc.id, 'completed', 100);
        // 업로드 완료 후 페이지/청크 수를 action으로 갱신
        updateDocInfo(doc.id, { pages: result.pages, chunks: result.chunks });
        showSuccess('문서가 업로드되었습니다');
      } catch {
        updateDocStatus(doc.id, 'error', 0);
        showError(null, '문서 업로드에 실패했습니다');
      }
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 공통 드래그앤드롭 영역 */}
      <FileDropZone onFiles={handleFiles} />

      {ragDocs.length > 0 && (
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
          {ragDocs.map((doc) => {
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
