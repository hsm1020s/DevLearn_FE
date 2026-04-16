import { useState, useRef } from 'react';
import { FileText, Upload, BookOpen, CheckCircle, Loader } from 'lucide-react';
import Button from '../common/Button';
import useCertStore from '../../stores/useCertStore';
import { uploadPdf } from '../../services/certApi';
import { DOC_STATUS } from '../../utils/constants';

export default function PdfUploader() {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const certDocs = useCertStore((s) => s.certDocs);
  const addDoc = useCertStore((s) => s.addDoc);
  const updateDocStatus = useCertStore((s) => s.updateDocStatus);
  const setCertStep = useCertStore((s) => s.setCertStep);

  const hasCompleted = certDocs.some((d) => d.status === 'completed');

  const handleFiles = async (files) => {
    for (const file of files) {
      if (file.type !== 'application/pdf') continue;
      const doc = addDoc({ fileName: file.name });
      try {
        const result = await uploadPdf(file);
        updateDocStatus(doc.id, 'completed', 100);
      } catch {
        updateDocStatus(doc.id, 'error', 0);
      }
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setDragging(false);
  };

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
    <div className="flex flex-col gap-6">
      {/* Drop Zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-3 p-10
          border-2 border-dashed rounded-xl cursor-pointer transition-colors
          ${dragging
            ? 'border-primary bg-primary/5'
            : 'border-border-light hover:border-primary/50'
          }
        `}
      >
        <Upload className="w-10 h-10 text-text-tertiary" />
        <p className="text-sm text-text-secondary text-center">
          PDF 파일을 드래그하거나 클릭하여 업로드
        </p>
        <Button variant="secondary" size="sm" onClick={(e) => e.stopPropagation()}>
          파일 선택
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {/* Uploaded Docs List */}
      {certDocs.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-text-secondary">업로드된 교재</h3>
          {certDocs.map((doc) => {
            const status = DOC_STATUS[doc.status] || DOC_STATUS.processing;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-secondary"
              >
                <BookOpen className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm text-text-primary flex-1 truncate">
                  {doc.fileName}
                </span>
                <span className={`flex items-center gap-1.5 text-xs ${status.color}`}>
                  {doc.status === 'completed' ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {status.label}
                  {doc.status === 'processing' && ` ${doc.progress}%`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Next Button */}
      <div className="flex justify-end">
        <Button disabled={!hasCompleted} onClick={() => setCertStep('settings')}>
          다음: 퀴즈 설정
        </Button>
      </div>
    </div>
  );
}
