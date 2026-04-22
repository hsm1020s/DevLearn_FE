/**
 * @fileoverview 파인만 학습 파이프라인 관리 탭.
 * PDF 업로드 → 파이프라인 실행 → 상태 폴링을 한 화면에서 처리한다.
 *
 * 흐름:
 * 1. PDF 파일 업로드 (POST /api/feynman/upload)
 * 2. "파이프라인 실행" 버튼 클릭 (POST /api/feynman/pipeline/{docId})
 * 3. 3초 간격 폴링으로 상태 갱신 (GET /api/feynman/docs/all)
 * 4. status='completed' 되면 학습 가능
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Play, RefreshCw, CheckCircle2, AlertCircle,
  Loader2, FileText, Clock, Trash2,
} from 'lucide-react';
import { fetchAllDocs, uploadPdf, runPipeline } from '../../services/feynmanApi';
import { showError, showSuccess } from '../../utils/errorHandler';

/** 상태별 UI 설정 */
const STATUS_MAP = {
  uploaded:   { label: '업로드 완료', color: 'text-text-secondary', bg: 'bg-bg-secondary', icon: Clock },
  extracting: { label: '텍스트 추출 중', color: 'text-warning', bg: 'bg-warning/10', icon: Loader2 },
  grouping:   { label: '챕터 분류 중', color: 'text-warning', bg: 'bg-warning/10', icon: Loader2 },
  embedding:  { label: '임베딩 생성 중', color: 'text-warning', bg: 'bg-warning/10', icon: Loader2 },
  completed:  { label: '학습 가능', color: 'text-success', bg: 'bg-success/10', icon: CheckCircle2 },
  error:      { label: '오류 발생', color: 'text-danger', bg: 'bg-danger/10', icon: AlertCircle },
};

/** 파이프라인이 진행 중인 상태인지 확인 */
function isProcessing(status) {
  return ['extracting', 'grouping', 'embedding'].includes(status);
}

export default function FeynmanPipelineTab() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [runningIds, setRunningIds] = useState(new Set());
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  // 문서 목록 로드
  const loadDocs = useCallback(async () => {
    try {
      const data = await fetchAllDocs();
      setDocs(data || []);
    } catch (err) {
      showError(err, '문서 목록을 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // 진행 중인 문서가 있으면 3초 폴링
  useEffect(() => {
    const hasProcessing = docs.some((d) => isProcessing(d.status));
    if (hasProcessing) {
      pollRef.current = setInterval(loadDocs, 3000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [docs, loadDocs]);

  // PDF 업로드
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showError(null, 'PDF 파일만 업로드할 수 있습니다');
      return;
    }

    setUploading(true);
    try {
      await uploadPdf(file);
      showSuccess('PDF 업로드 완료');
      await loadDocs();
    } catch (err) {
      showError(err, 'PDF 업로드에 실패했습니다');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 파이프라인 실행
  const handleRunPipeline = async (docId) => {
    setRunningIds((prev) => new Set(prev).add(docId));
    try {
      await runPipeline(docId);
      showSuccess('파이프라인 실행을 시작했습니다');
      await loadDocs();
    } catch (err) {
      showError(err, '파이프라인 실행에 실패했습니다');
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-light">
        <div>
          <h2 className="text-base font-semibold text-text-primary">파이프라인 관리</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            PDF를 업로드하고 파이프라인을 실행하면 파인만 학습에 사용할 수 있습니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDocs}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors text-text-secondary"
            title="새로고침"
          >
            <RefreshCw size={16} />
          </button>
          <label
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              bg-primary text-white hover:bg-primary-hover
              transition-colors cursor-pointer
              ${uploading ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            {uploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            {uploading ? '업로드 중...' : 'PDF 업로드'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* 문서 목록 */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText size={40} className="text-text-tertiary" />
            <p className="text-sm text-text-tertiary">
              아직 업로드된 문서가 없습니다
            </p>
            <p className="text-xs text-text-tertiary">
              상단의 "PDF 업로드" 버튼으로 학습할 PDF를 추가하세요
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl mx-auto">
            {docs.map((doc) => {
              const statusInfo = STATUS_MAP[doc.status] || STATUS_MAP.uploaded;
              const StatusIcon = statusInfo.icon;
              const canRun = doc.status === 'uploaded' || doc.status === 'error';
              const isRunning = isProcessing(doc.status) || runningIds.has(doc.id);

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border-light
                    bg-bg-primary hover:border-border-medium transition-colors"
                >
                  {/* 아이콘 */}
                  <div className={`w-10 h-10 rounded-lg ${statusInfo.bg} flex items-center justify-center shrink-0`}>
                    <FileText size={20} className={statusInfo.color} />
                  </div>

                  {/* 문서 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {doc.fileName}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`flex items-center gap-1 text-xs ${statusInfo.color}`}>
                        <StatusIcon size={12} className={isRunning ? 'animate-spin' : ''} />
                        {statusInfo.label}
                      </span>
                      {doc.progress > 0 && doc.status !== 'completed' && (
                        <span className="text-xs text-text-tertiary">
                          {doc.progress}%
                        </span>
                      )}
                      {doc.status === 'completed' && (
                        <>
                          <span className="text-xs text-text-tertiary">
                            {doc.pages}p
                          </span>
                          <span className="text-xs text-text-tertiary">
                            {doc.chunks}개 청크
                          </span>
                        </>
                      )}
                    </div>

                    {/* 진행률 바 */}
                    {isRunning && (
                      <div className="mt-2 h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${doc.progress || 5}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="shrink-0">
                    {canRun && (
                      <button
                        onClick={() => handleRunPipeline(doc.id)}
                        disabled={runningIds.has(doc.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          bg-primary text-white hover:bg-primary-hover
                          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {runningIds.has(doc.id) ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Play size={14} />
                        )}
                        {doc.status === 'error' ? '재실행' : '파이프라인 실행'}
                      </button>
                    )}
                    {doc.status === 'completed' && (
                      <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                        bg-success/10 text-success">
                        <CheckCircle2 size={14} />
                        학습 가능
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
