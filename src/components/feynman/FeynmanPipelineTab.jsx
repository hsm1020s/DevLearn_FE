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
  Loader2, FileText, Clock, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { fetchDocsPage, uploadPdf, runPipeline } from '../../services/feynmanApi';
import { showError, showSuccess } from '../../utils/errorHandler';

/** 페이지당 건수 — BE 기본값과 일치 */
const PAGE_SIZE = 15;

/** 상태별 UI 설정 */
const STATUS_MAP = {
  uploaded:   { label: '업로드 완료', color: 'text-text-secondary', bg: 'bg-bg-secondary', icon: Clock },
  extracting: { label: '텍스트 추출 중', color: 'text-warning', bg: 'bg-warning/10', icon: Loader2 },
  grouping:   { label: '챕터 분류 중', color: 'text-warning', bg: 'bg-warning/10', icon: Loader2 },
  embedding:  { label: '임베딩 생성 중', color: 'text-warning', bg: 'bg-warning/10', icon: Loader2 },
  completed:  { label: '학습 가능', color: 'text-success', bg: 'bg-success/10', icon: CheckCircle2 },
  error:      { label: '오류 발생', color: 'text-danger', bg: 'bg-danger/10', icon: AlertCircle },
};

/** 상태 필터 옵션 (BE의 status 키워드와 1:1 매핑) */
const STATUS_FILTER_OPTIONS = [
  { value: 'all',        label: '전체' },
  { value: 'uploaded',   label: '업로드' },
  { value: 'processing', label: '진행 중' },
  { value: 'completed',  label: '완료' },
  { value: 'error',      label: '오류' },
];

/** 파이프라인이 진행 중인 상태인지 확인 */
function isProcessing(status) {
  return ['extracting', 'grouping', 'embedding'].includes(status);
}

export default function FeynmanPipelineTab() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  // 다중 업로드 진행도: { current: i, total: N } — null이면 비활성
  const [uploadProgress, setUploadProgress] = useState(null);
  const [runningIds, setRunningIds] = useState(new Set());
  // 페이지네이션 + 필터 state
  const [page, setPage] = useState(0);            // 0-base
  const [status, setStatus] = useState('all');    // STATUS_FILTER_OPTIONS의 value
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  /**
   * 지정한 페이지/필터로 문서 목록을 다시 가져온다.
   * 인자를 받는 이유: setState 직후 동일 사이클에서 호출하면 React state가
   * 아직 갱신되지 않으므로, 즉시 반영하려면 호출자가 명시적으로 넘겨야 안전.
   */
  const loadDocs = useCallback(async (targetPage = page, targetStatus = status) => {
    try {
      const data = await fetchDocsPage({ page: targetPage, size: PAGE_SIZE, status: targetStatus });
      setDocs(data?.items || []);
      setTotalPages(Math.max(1, data?.totalPages || 1));
      setTotalCount(data?.totalCount || 0);
      // 데이터가 줄어 현재 페이지가 비게 된 경우(예: 마지막 페이지 항목이 모두 다른 필터로 빠짐)
      // 한 페이지 앞으로 이동시켜 빈 화면을 방지한다.
      if ((data?.items?.length || 0) === 0 && targetPage > 0 && (data?.totalCount || 0) > 0) {
        setPage(targetPage - 1);
      }
    } catch (err) {
      showError(err, '문서 목록을 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  // page/status 변경 시 자동 재조회
  useEffect(() => {
    loadDocs(page, status);
    // loadDocs는 page/status에 의존하므로 deps에서 제외(무한 루프 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  // 현재 페이지에 진행 중 문서가 있으면 3초 폴링 (다른 페이지로 이동 시 자동 정지)
  useEffect(() => {
    const hasProcessing = docs.some((d) => isProcessing(d.status));
    if (hasProcessing) {
      pollRef.current = setInterval(() => loadDocs(page, status), 3000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [docs, loadDocs, page, status]);

  // PDF 다중 업로드 (순차) — 한 파일이 실패해도 나머지는 계속 진행
  const handleUpload = async (e) => {
    const all = Array.from(e.target.files || []);
    if (all.length === 0) return;

    // PDF만 통과
    const valid = all.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    const skipped = all.length - valid.length;
    if (valid.length === 0) {
      showError(null, 'PDF 파일만 업로드할 수 있습니다');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: valid.length });
    const failed = [];

    for (let i = 0; i < valid.length; i++) {
      setUploadProgress({ current: i + 1, total: valid.length });
      try {
        await uploadPdf(valid[i]);
      } catch (err) {
        failed.push({ name: valid[i].name, message: err?.userMessage || err?.message || '업로드 실패' });
      }
    }

    const succeeded = valid.length - failed.length;
    if (failed.length === 0) {
      const msg = valid.length === 1 ? 'PDF 업로드 완료' : `${succeeded}개 PDF 업로드 완료`;
      showSuccess(skipped > 0 ? `${msg} (PDF 아닌 ${skipped}개 제외)` : msg);
    } else if (succeeded > 0) {
      showError(null, `${succeeded}개 성공, ${failed.length}개 실패: ${failed.map((f) => f.name).join(', ')}`);
    } else {
      showError(null, `업로드 실패: ${failed.map((f) => f.name).join(', ')}`);
    }

    // 업로드 후 1페이지로 이동(최신 항목 보이도록). page=0 이미면 효과 없으니 명시 reload.
    if (page === 0) {
      await loadDocs(0, status);
    } else {
      setPage(0);
    }
    setUploading(false);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 파이프라인 실행
  const handleRunPipeline = async (docId) => {
    setRunningIds((prev) => new Set(prev).add(docId));
    try {
      await runPipeline(docId);
      showSuccess('파이프라인 실행을 시작했습니다');
      await loadDocs(page, status);
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

  // 상태 필터 변경 — 1페이지로 리셋
  const handleStatusChange = (next) => {
    setStatus(next);
    setPage(0);
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
          {/* 상태 필터 */}
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm bg-bg-primary border border-border-light
              text-text-primary hover:border-border-medium transition-colors
              focus:outline-none focus:border-primary"
            title="상태 필터"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => loadDocs(page, status)}
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
            {uploading
              ? (uploadProgress && uploadProgress.total > 1
                ? `업로드 중 (${uploadProgress.current}/${uploadProgress.total})...`
                : '업로드 중...')
              : 'PDF 업로드'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
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
              {status === 'all'
                ? '아직 업로드된 문서가 없습니다'
                : '이 필터에 해당하는 문서가 없습니다'}
            </p>
            <p className="text-xs text-text-tertiary">
              {status === 'all'
                ? '상단의 "PDF 업로드" 버튼으로 학습할 PDF를 추가하세요'
                : '상태 필터를 "전체"로 바꾸면 모든 문서를 볼 수 있습니다'}
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

        {/* 페이지네이션 컨트롤 — 항목 1건 이상 + 페이지 2개 이상일 때만 노출 */}
        {!loading && docs.length > 0 && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-1 max-w-3xl mx-auto">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm
                text-text-secondary hover:bg-bg-secondary
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} /> 이전
            </button>

            {/* 페이지 번호 버튼 — 현재 ±2까지 + 처음/끝 표시. 너무 많으면 ...로 축약 */}
            {pageNumbers(page, totalPages).map((p, idx) => (
              p === -1 ? (
                <span key={`gap-${idx}`} className="px-2 text-text-tertiary">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`min-w-[32px] px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    p === page
                      ? 'bg-primary text-white font-medium'
                      : 'text-text-secondary hover:bg-bg-secondary'
                  }`}
                >
                  {p + 1}
                </button>
              )
            ))}

            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm
                text-text-secondary hover:bg-bg-secondary
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              다음 <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* 총 건수 표시 */}
        {!loading && totalCount > 0 && (
          <div className="mt-3 text-center text-xs text-text-tertiary">
            총 {totalCount}건 · {page + 1}/{totalPages} 페이지
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 페이지네이션에 보여줄 번호 시퀀스 생성.
 * 현재 페이지 ±2 + 처음/끝을 포함하고, 사이가 멀면 -1(=...)을 끼워 넣는다.
 * 반환은 0-base 번호이며, 컴포넌트에서 +1로 표시한다.
 */
function pageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const result = [];
  const start = Math.max(0, current - 2);
  const end = Math.min(total - 1, current + 2);

  if (start > 0) {
    result.push(0);
    if (start > 1) result.push(-1);
  }
  for (let i = start; i <= end; i++) result.push(i);
  if (end < total - 1) {
    if (end < total - 2) result.push(-1);
    result.push(total - 1);
  }
  return result;
}
