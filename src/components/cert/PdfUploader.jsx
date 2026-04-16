/**
 * @fileoverview PDF 업로드 컴포넌트
 * 드래그 앤 드롭 또는 파일 선택으로 PDF를 업로드하고,
 * 업로드된 문서 목록과 상태(처리 중/완료/오류)를 표시한다.
 */
import { BookOpen, CheckCircle, Loader } from 'lucide-react';
import Button from '../common/Button';
import FileDropZone from '../common/FileDropZone';
import useCertStore from '../../stores/useCertStore';
import { uploadPdf } from '../../services/certApi';
import { DOC_STATUS } from '../../utils/constants';
import { showError } from '../../utils/errorHandler';

/** PDF 파일 업로드 및 문서 관리 화면. 완료된 문서가 있어야 다음 단계로 진행 가능. */
export default function PdfUploader() {
  const certDocs = useCertStore((s) => s.certDocs);
  const addDoc = useCertStore((s) => s.addDoc);
  const updateDocStatus = useCertStore((s) => s.updateDocStatus);
  const setCertStep = useCertStore((s) => s.setCertStep);

  const hasCompleted = certDocs.some((d) => d.status === 'completed');

  // PDF 파일을 순차적으로 업로드하고 문서 상태를 갱신
  const handleFiles = async (files) => {
    for (const file of files) {
      if (file.type !== 'application/pdf') continue;
      const doc = addDoc({ fileName: file.name });
      try {
        await uploadPdf(file);
        updateDocStatus(doc.id, 'completed', 100);
      } catch {
        updateDocStatus(doc.id, 'error', 0);
        showError(null, 'PDF 업로드에 실패했습니다');
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 공통 드래그앤드롭 영역 */}
      <FileDropZone onFiles={handleFiles} className="p-10" />

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
