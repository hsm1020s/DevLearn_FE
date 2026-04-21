/**
 * @fileoverview 문서 업로드 모달 — 사이드바에서 PDF를 업로드하고 업로드 현황을 관리한다.
 * FileDropZone으로 드래그앤드롭/클릭 업로드를 받고, useDocStore에 문서 메타를 저장한다.
 * 실제 업로드는 studyApi.uploadPdf(file)을 통해 처리되며 Mock 모드도 지원된다.
 */
import { useCallback } from 'react';
import { FileText, Trash2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import FileDropZone from './FileDropZone';
import { useToastStore } from './Toast';
import useDocStore from '../../stores/useDocStore';
import { uploadPdf } from '../../services/studyApi';

/** PDF 파일 단일 최대 크기 (1GB) */
const MAX_FILE_SIZE = 1024 * 1024 * 1024;

/** 바이트를 사람이 읽기 쉬운 단위로 변환 */
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 문서 상태별 시각적 뱃지 (아이콘 + 색상 + 라벨) */
function StatusBadge({ status }) {
  if (status === 'completed') {
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <CheckCircle2 size={12} /> 완료
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-xs text-danger">
        <AlertCircle size={12} /> 실패
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-text-tertiary">
      <Loader2 size={12} className="animate-spin" /> 처리 중
    </span>
  );
}

/**
 * 문서 업로드 모달
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {Function} onClose - 모달 닫기 콜백
 * @param {React.RefObject} [anchorRef] - 팝오버 앵커 위치 참조
 */
export default function DocumentUploadModal({ isOpen, onClose, anchorRef }) {
  const addToast = useToastStore((s) => s.addToast);
  const docs = useDocStore((s) => s.docs);
  const addDoc = useDocStore((s) => s.addDoc);
  const updateDocStatus = useDocStore((s) => s.updateDocStatus);
  const updateDocInfo = useDocStore((s) => s.updateDocInfo);
  const removeDoc = useDocStore((s) => s.removeDoc);

  // 파일 1개 업로드 — 스토어에 즉시 등록해 목록에 표시한 뒤 API 호출
  const uploadOne = useCallback(
    async (file) => {
      const newDoc = addDoc({
        fileName: file.name,
        size: file.size,
        status: 'processing',
        progress: 0,
      });
      try {
        const result = await uploadPdf(file);
        updateDocStatus(newDoc.id, 'completed', 100);
        updateDocInfo(newDoc.id, {
          docId: result.docId,
          pages: result.pages ?? 0,
          chunks: result.chunks ?? 0,
        });
        addToast(`${file.name} 업로드 완료`, 'success');
      } catch (err) {
        updateDocStatus(newDoc.id, 'error', 0);
        addToast(`${file.name} 업로드 실패: ${err?.message ?? '알 수 없는 오류'}`, 'error');
      }
    },
    [addDoc, updateDocStatus, updateDocInfo, addToast],
  );

  // 드롭존에서 받은 파일 배열을 필터링한 뒤 순차 업로드
  const handleFiles = useCallback(
    async (files) => {
      const valid = [];
      for (const f of files) {
        const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
          addToast(`${f.name}: PDF 파일만 업로드할 수 있습니다.`, 'error');
          continue;
        }
        if (f.size > MAX_FILE_SIZE) {
          addToast(`${f.name}: 1GB 이하 파일만 업로드할 수 있습니다.`, 'error');
          continue;
        }
        valid.push(f);
      }
      // 여러 파일을 병렬로 업로드하되, 실패해도 다른 파일은 계속 진행되도록 Promise.allSettled
      await Promise.allSettled(valid.map((f) => uploadOne(f)));
    },
    [uploadOne, addToast],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="문서 업로드" anchorRef={anchorRef} offsetVh={0.15}>
      <div className="flex flex-col gap-4">
        <FileDropZone
          onFiles={handleFiles}
          accept=".pdf,application/pdf"
          multiple
          label="PDF 파일을 드래그하거나 클릭하여 업로드 (최대 1GB)"
        />

        {/* 업로드된 문서 목록 */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">
            업로드된 문서 ({docs.length})
          </label>
          {docs.length === 0 ? (
            <div className="text-xs text-text-tertiary py-6 text-center border border-dashed border-border-light rounded-lg">
              업로드된 문서가 없습니다
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border-light bg-bg-primary"
                >
                  <FileText size={14} className="shrink-0 text-text-tertiary" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-primary truncate" title={doc.fileName}>
                        {doc.fileName}
                      </span>
                      <StatusBadge status={doc.status} />
                    </div>
                    <div className="text-[11px] text-text-tertiary truncate">
                      {formatSize(doc.size)}
                      {doc.status === 'completed' && doc.pages > 0 && (
                        <> · {doc.pages}페이지 · {doc.chunks} 청크</>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeDoc(doc.id)}
                    className="shrink-0 p-1 rounded hover:bg-danger/10 text-text-tertiary hover:text-danger transition-colors"
                    aria-label={`${doc.fileName} 삭제`}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="secondary" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Modal>
  );
}
