/** @fileoverview PDF 업로드 모달 — 용도 구분 없이 단일 경로로 업로드하고, 문서 목록을 관리한다. */
import { useCallback } from 'react';
import { BookOpen, CheckCircle, Loader, Trash2 } from 'lucide-react';
import Modal from './Modal';
import FileDropZone from './FileDropZone';
import useDocStore from '../../stores/useDocStore';
import { uploadDocument } from '../../services/ragApi';
import { DOC_STATUS } from '../../utils/constants';
import { showError, showSuccess } from '../../utils/errorHandler';

/**
 * PDF 업로드 및 문서 관리 모달
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {Function} onClose - 모달 닫기 핸들러
 * @param {React.RefObject} [anchorRef] - 팝오버 앵커 위치 참조
 */
export default function PdfUploadModal({ isOpen, onClose, anchorRef }) {
  const docs = useDocStore((s) => s.docs);
  const addDoc = useDocStore((s) => s.addDoc);
  const updateDocStatus = useDocStore((s) => s.updateDocStatus);
  const updateDocInfo = useDocStore((s) => s.updateDocInfo);
  const removeDoc = useDocStore((s) => s.removeDoc);
  const pollDocStatus = useDocStore((s) => s.pollDocStatus);

  // 파일 업로드 처리 (타입/크기 검증 포함)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const handleFiles = useCallback(async (files) => {
    for (const file of files) {
      if (file.type !== 'application/pdf') {
        showError(null, 'PDF 파일만 업로드 가능합니다');
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        showError(null, `파일 크기는 50MB 이하여야 합니다 (현재: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        continue;
      }
      const doc = addDoc({ fileName: file.name.slice(0, 255) });
      try {
        const result = await uploadDocument(file);
        // 서버가 부여한 실제 docId로 교체 + 결과 정보 반영
        updateDocInfo(doc.id, {
          id: result.docId ?? doc.id,
          pages: result.pages,
          chunks: result.chunks,
        });
        const serverDocId = result.docId ?? doc.id;
        if (result.status === 'processing') {
          // 비동기 처리 중 — 폴링으로 완료 감지
          updateDocStatus(serverDocId, 'processing', result.progress ?? 0);
          pollDocStatus(serverDocId);
          showSuccess('문서 업로드가 시작되었습니다');
        } else {
          // 즉시 완료 — 기존 동작 유지
          updateDocStatus(serverDocId, 'completed', 100);
          showSuccess('문서가 업로드되었습니다');
        }
      } catch {
        updateDocStatus(doc.id, 'error', 0);
        showError(null, '문서 업로드에 실패했습니다');
      }
    }
  }, [addDoc, updateDocStatus, updateDocInfo, pollDocStatus]);

  // 문서 삭제 처리
  const handleDelete = useCallback((id) => {
    removeDoc(id);
    showSuccess('문서가 삭제되었습니다');
  }, [removeDoc]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="PDF 업로드" anchorRef={anchorRef}>
      <div className="flex flex-col gap-4">
        {/* 드래그앤드롭 업로드 영역 */}
        <FileDropZone onFiles={handleFiles} />

        {/* 문서 관리 목록 */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">
            문서 관리 ({docs.length})
          </label>
          {docs.length === 0 ? (
            <p className="text-xs text-text-tertiary text-center py-3">
              업로드된 문서가 없습니다
            </p>
          ) : (
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
                        {doc.pages > 0 && (
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
          )}
        </div>
      </div>
    </Modal>
  );
}
