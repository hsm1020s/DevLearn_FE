/**
 * @fileoverview 학습 모드 문서 목록 및 다음 단계 진행 컴포넌트.
 * 통합 문서 스토어에서 업로드된 문서를 표시하고, 퀴즈 설정으로 진행한다.
 */
import { BookOpen, CheckCircle, Loader } from 'lucide-react';
import Button from '../common/Button';
import useDocStore from '../../stores/useDocStore';
import useStudyStore from '../../stores/useStudyStore';
import { DOC_STATUS } from '../../utils/constants';

/** PDF 파일 업로드 및 문서 관리 화면. 완료된 문서가 있어야 다음 단계로 진행 가능. */
export default function PdfUploader() {
  const docs = useDocStore((s) => s.docs);
  const setStudyStep = useStudyStore((s) => s.setStudyStep);

  const hasCompleted = docs.some((d) => d.status === 'completed');

  return (
    <div className="flex flex-col gap-6">
      {/* 업로드된 문서 목록 (사이드바 PDF 업로드에서 추가) */}
      {docs.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-text-secondary">업로드된 문서</h3>
          {docs.map((doc) => {
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

      {/* 다음 단계 안내 */}
      <div className="flex justify-between items-center">
        {!hasCompleted && (
          <p className="text-xs text-text-tertiary">사이드바 하단의 PDF 업로드에서 문서를 추가하세요</p>
        )}
        <div className="flex-1" />
        <Button disabled={!hasCompleted} onClick={() => setStudyStep('settings')}>
          다음: 퀴즈 설정
        </Button>
      </div>
    </div>
  );
}
