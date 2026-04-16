import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, Loader } from 'lucide-react';
import Button from '../common/Button';
import useRagStore from '../../stores/useRagStore';
import { uploadDocument } from '../../services/ragApi';
import { DOC_STATUS } from '../../utils/constants';

export default function RagUploader({ onDone }) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const ragDocs = useRagStore((s) => s.ragDocs);
  const addDoc = useRagStore((s) => s.addDoc);
  const updateDocStatus = useRagStore((s) => s.updateDocStatus);

  const handleFiles = async (files) => {
    for (const file of files) {
      if (file.type !== 'application/pdf') continue;
      const doc = addDoc({ fileName: file.name, pages: 0, chunks: 0 });
      try {
        const result = await uploadDocument(file);
        updateDocStatus(doc.id, 'completed', 100);
        useRagStore.setState((state) => ({
          ragDocs: state.ragDocs.map((d) =>
            d.id === doc.id ? { ...d, pages: result.pages, chunks: result.chunks } : d
          ),
        }));
      } catch {
        updateDocStatus(doc.id, 'error', 0);
      }
    }
  };

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDragging(false); };
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };
  const onFileChange = (e) => {
    if (e.target.files.length) {
      handleFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-3 p-8
          border-2 border-dashed rounded-xl cursor-pointer transition-colors
          ${dragging ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/50'}
        `}
      >
        <Upload className="w-8 h-8 text-text-tertiary" />
        <p className="text-sm text-text-secondary text-center">
          PDF 파일을 드래그하거나 클릭하여 업로드
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={onFileChange}
        />
      </div>

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
