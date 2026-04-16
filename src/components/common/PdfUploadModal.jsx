/** @fileoverview 통합 PDF 업로드 모달 — 용도(퀴즈용/RAG용) 선택 후 드래그앤드롭으로 업로드한다. */
import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, BookOpen, CheckCircle, Loader, Briefcase } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import useAppStore from '../../stores/useAppStore';
import useCertStore from '../../stores/useCertStore';
import useRagStore from '../../stores/useRagStore';
import { uploadPdf } from '../../services/certApi';
import { uploadDocument } from '../../services/ragApi';
import { DOC_STATUS } from '../../utils/constants';
import { showError, showSuccess } from '../../utils/errorHandler';

const PURPOSES = [
  { value: 'cert', label: '퀴즈용', desc: '자격증 학습 PDF', icon: FileText },
  { value: 'work', label: 'RAG용', desc: '업무 문서 PDF', icon: Briefcase },
];

export default function PdfUploadModal({ isOpen, onClose, anchorRef }) {
  const mainMode = useAppStore((s) => s.mainMode);
  const [purpose, setPurpose] = useState(mainMode === 'work' ? 'work' : 'cert');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  // cert store
  const certDocs = useCertStore((s) => s.certDocs);
  const addCertDoc = useCertStore((s) => s.addDoc);
  const updateCertStatus = useCertStore((s) => s.updateDocStatus);

  // rag store
  const ragDocs = useRagStore((s) => s.ragDocs);
  const addRagDoc = useRagStore((s) => s.addDoc);
  const updateRagStatus = useRagStore((s) => s.updateDocStatus);

  const docs = purpose === 'cert' ? certDocs : ragDocs;

  const handleFiles = useCallback(async (files) => {
    for (const file of files) {
      if (file.type !== 'application/pdf') continue;

      if (purpose === 'cert') {
        const doc = addCertDoc({ fileName: file.name });
        try {
          await uploadPdf(file);
          updateCertStatus(doc.id, 'completed', 100);
          showSuccess('교재가 업로드되었습니다');
        } catch {
          updateCertStatus(doc.id, 'error', 0);
          showError(null, 'PDF 업로드에 실패했습니다');
        }
      } else {
        const doc = addRagDoc({ fileName: file.name, pages: 0, chunks: 0 });
        try {
          const result = await uploadDocument(file);
          updateRagStatus(doc.id, 'completed', 100);
          useRagStore.setState((state) => ({
            ragDocs: state.ragDocs.map((d) =>
              d.id === doc.id ? { ...d, pages: result.pages, chunks: result.chunks } : d
            ),
          }));
          showSuccess('문서가 업로드되었습니다');
        } catch {
          updateRagStatus(doc.id, 'error', 0);
          showError(null, '문서 업로드에 실패했습니다');
        }
      }
    }
  }, [purpose, addCertDoc, updateCertStatus, addRagDoc, updateRagStatus]);

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

  // 모달 열릴 때 현재 모드에 맞게 용도 초기화
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="PDF 업로드" anchorRef={anchorRef}>
      <div className="flex flex-col gap-4">
        {/* 용도 선택 카드 */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">용도 선택</label>
          <div className="grid grid-cols-2 gap-2">
            {PURPOSES.map(({ value, label, desc, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setPurpose(value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors
                  ${purpose === value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border-light text-text-secondary hover:border-primary/30'}`}
              >
                <Icon size={24} />
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-text-tertiary">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 드래그앤드롭 영역 */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 p-8
            border-2 border-dashed rounded-xl cursor-pointer transition-colors
            ${dragging ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/50'}`}
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

        {/* 업로드된 파일 목록 */}
        {docs.length > 0 && (
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              업로드된 {purpose === 'cert' ? '교재' : '문서'}
            </label>
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {docs.map((doc) => {
                const status = DOC_STATUS[doc.status] || DOC_STATUS.processing;
                return (
                  <div key={doc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-secondary">
                    <BookOpen className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-text-primary flex-1 truncate">{doc.fileName}</span>
                    <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                      {doc.status === 'completed'
                        ? <CheckCircle className="w-3.5 h-3.5" />
                        : <Loader className="w-3.5 h-3.5 animate-spin" />}
                      {status.label}
                      {doc.status === 'processing' && ` ${doc.progress}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
