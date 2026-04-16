/** @fileoverview 통합 PDF 업로드 모달 — 용도(퀴즈용/RAG용) 선택 후 드래그앤드롭으로 업로드한다. */
import { useState, useCallback } from 'react';
import { FileText, BookOpen, CheckCircle, Loader, Briefcase, Trash2 } from 'lucide-react';
import Modal from './Modal';
import FileDropZone from './FileDropZone';
import useAppStore from '../../stores/useAppStore';
import useCertStore from '../../stores/useCertStore';
import useRagStore from '../../stores/useRagStore';
import { uploadPdf } from '../../services/certApi';
import { uploadDocument, deleteDocument } from '../../services/ragApi';
import { DOC_STATUS } from '../../utils/constants';
import { showError, showSuccess } from '../../utils/errorHandler';

const PURPOSES = [
  { value: 'cert', label: '퀴즈용', desc: '자격증 학습 PDF', icon: FileText },
  { value: 'work', label: 'RAG용', desc: '업무 문서 PDF', icon: Briefcase },
];

export default function PdfUploadModal({ isOpen, onClose, anchorRef }) {
  const mainMode = useAppStore((s) => s.mainMode);
  const [purpose, setPurpose] = useState(mainMode === 'work' ? 'work' : 'cert');

  // cert store
  const certDocs = useCertStore((s) => s.certDocs);
  const addCertDoc = useCertStore((s) => s.addDoc);
  const updateCertStatus = useCertStore((s) => s.updateDocStatus);
  const removeCertDoc = useCertStore((s) => s.removeDoc);

  // rag store
  const ragDocs = useRagStore((s) => s.ragDocs);
  const addRagDoc = useRagStore((s) => s.addDoc);
  const updateRagStatus = useRagStore((s) => s.updateDocStatus);
  const updateRagDocInfo = useRagStore((s) => s.updateDocInfo);
  const removeRagDoc = useRagStore((s) => s.removeDoc);

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
          // action을 통해 페이지/청크 수 갱신 (setState 직접 호출 제거)
          updateRagDocInfo(doc.id, { pages: result.pages, chunks: result.chunks });
          showSuccess('문서가 업로드되었습니다');
        } catch {
          updateRagStatus(doc.id, 'error', 0);
          showError(null, '문서 업로드에 실패했습니다');
        }
      }
    }
  }, [purpose, addCertDoc, updateCertStatus, addRagDoc, updateRagStatus, updateRagDocInfo]);

  // 문서 삭제 핸들러
  const handleDelete = useCallback(async (id) => {
    if (purpose === 'cert') {
      removeCertDoc(id);
      showSuccess('교재가 삭제되었습니다');
    } else {
      try {
        await deleteDocument(id);
        removeRagDoc(id);
        showSuccess('문서가 삭제되었습니다');
      } catch {
        showError(null, '문서 삭제에 실패했습니다');
      }
    }
  }, [purpose, removeCertDoc, removeRagDoc]);

  // 모달 닫기
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

        {/* 공통 드래그앤드롭 영역 */}
        <FileDropZone onFiles={handleFiles} />

        {/* 문서 관리 목록 */}
        {docs.length > 0 && (
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              {purpose === 'cert' ? '교재' : '문서'} 관리 ({docs.length})
            </label>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {docs.map((doc) => {
                const status = DOC_STATUS[doc.status] || DOC_STATUS.processing;
                return (
                  <div key={doc.id} className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-secondary">
                    <BookOpen className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{doc.fileName}</p>
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 text-[10px] ${status.color}`}>
                          {doc.status === 'completed'
                            ? <CheckCircle className="w-3 h-3" />
                            : <Loader className="w-3 h-3 animate-spin" />}
                          {status.label}
                          {doc.status === 'processing' && ` ${doc.progress}%`}
                        </span>
                        {/* RAG 문서 상세 정보 */}
                        {purpose === 'work' && doc.pages > 0 && (
                          <span className="text-[10px] text-text-tertiary">
                            {doc.pages}p · {doc.chunks}청크
                          </span>
                        )}
                      </div>
                    </div>
                    {/* 삭제 버튼 — 호버 시 표시 */}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="shrink-0 p-1 rounded text-text-tertiary hover:text-danger
                                 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label={`${doc.fileName} 삭제`}
                    >
                      <Trash2 size={13} />
                    </button>
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
