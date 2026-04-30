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
  Loader2, FileText, Clock, ChevronLeft, ChevronRight, Trash2,
} from 'lucide-react';
import { fetchDocsPage, uploadPdf, runPipeline, runEmbedOnly, retryToc, deleteDoc } from '../../services/feynmanApi';
import { showError, showSuccess } from '../../utils/errorHandler';

/** 페이지당 건수 — BE 기본값과 일치 */
const PAGE_SIZE = 10;

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

  // 파이프라인 실행 (skipEmbed=true 면 임베딩 보류)
  const handleRunPipeline = async (docId, { skipEmbed = false } = {}) => {
    setRunningIds((prev) => new Set(prev).add(docId));
    try {
      await runPipeline(docId, { skipEmbed });
      showSuccess(skipEmbed
        ? '파이프라인 실행 시작 (임베딩 보류)'
        : '파이프라인 실행을 시작했습니다');
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

  // skipEmbed 로 미리 돌려둔 문서에 대해 임베딩만 단독 실행
  const handleRunEmbedOnly = async (docId) => {
    setRunningIds((prev) => new Set(prev).add(docId));
    try {
      await runEmbedOnly(docId);
      showSuccess('임베딩 실행을 시작했습니다');
      await loadDocs(page, status);
    } catch (err) {
      showError(err, '임베딩 실행에 실패했습니다');
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  // TOC + chapters 그룹핑 재실행. 이미 임베딩된 문서면 사전 confirm.
  const handleRetryToc = async (doc) => {
    if (doc.ragIndexed === true) {
      const ok = window.confirm(
        '이미 임베딩이 완료된 문서입니다.\n' +
        'TOC 가 바뀌면 기존 청크의 챕터명이 어긋날 수 있습니다.\n' +
        '재추출 후 [임베딩 실행] 으로 다시 인덱싱하는 것을 권장합니다.\n\n' +
        '계속할까요?'
      );
      if (!ok) return;
    }
    setRunningIds((prev) => new Set(prev).add(doc.id));
    try {
      await retryToc(doc.id);
      showSuccess('TOC 재추출을 시작했습니다');
      await loadDocs(page, status);
    } catch (err) {
      showError(err, 'TOC 재추출에 실패했습니다');
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

  // 문서 삭제
  const handleDeleteDoc = async (doc) => {
    if (isProcessing(doc.status)) return;
    const ok = window.confirm(
      `"${doc.fileName}" 문서를 삭제할까요?\n\n` +
      '연관된 모든 데이터(청크, 질문, 마인드맵, 파이프라인 이력)가 함께 삭제됩니다.\n' +
      '이 작업은 되돌릴 수 없습니다.'
    );
    if (!ok) return;
    try {
      await deleteDoc(doc.id);
      showSuccess('문서가 삭제되었습니다');
      await loadDocs(page, status);
    } catch (err) {
      showError(err, '문서 삭제에 실패했습니다');
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
          <div className="space-y-[9px] max-w-3xl mx-auto">
            {docs.map((doc) => {
              const statusInfo = STATUS_MAP[doc.status] || STATUS_MAP.uploaded;
              const StatusIcon = statusInfo.icon;
              const canRun = doc.status === 'uploaded' || doc.status === 'error';
              const isRunning = isProcessing(doc.status) || runningIds.has(doc.id);

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 px-4 py-[13px] rounded-xl border border-border-light
                    bg-bg-primary hover:border-border-medium transition-colors"
                >
                  {/* 아이콘 */}
                  <div className={`w-10 h-10 rounded-lg ${statusInfo.bg} flex items-center justify-center shrink-0`}>
                    <FileText size={20} className={statusInfo.color} />
                  </div>

                  {/* 문서 정보 — 파일명 + (완료 시) 메타 + 진행률 바 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {doc.fileName}
                    </div>
                    {doc.status === 'completed' && (
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-text-tertiary">
                          {doc.pages}p
                        </span>
                        <span className="text-xs text-text-tertiary">
                          {doc.chunks}개 청크
                        </span>
                        {/* skipEmbed 로 끝난 문서는 RAG 미적재 — 사용자에게 명시 */}
                        {doc.ragIndexed === false && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            RAG 미적재
                          </span>
                        )}
                      </div>
                    )}

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

                  {/* 우측: 상태 뱃지 + 액션 버튼 */}
                  <div className="shrink-0 flex items-center gap-2">
                    {/* 상태 뱃지 — 모든 상태를 통일된 위치에 표시 */}
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                      <StatusIcon size={12} className={isRunning ? 'animate-spin' : ''} />
                      {statusInfo.label}
                      {doc.progress > 0 && doc.status !== 'completed' && (
                        <span className="ml-1 opacity-75">{doc.progress}%</span>
                      )}
                    </span>
                    {/* 실행/재실행 버튼 + 임베딩 보류 옵션 */}
                    {canRun && (
                      <>
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
                        <button
                          onClick={() => handleRunPipeline(doc.id, { skipEmbed: true })}
                          disabled={runningIds.has(doc.id)}
                          title="extract/toc/group/마인드맵 까지만. 임베딩(RAG)은 나중에 별도 실행."
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            bg-bg-secondary text-text-primary hover:bg-bg-tertiary border border-border-light
                            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          임베딩 없이
                        </button>
                      </>
                    )}
                    {/* completed && RAG 미적재 → 임베딩만 단독 실행 액션 노출 */}
                    {doc.status === 'completed' && doc.ragIndexed === false && (
                      <button
                        onClick={() => handleRunEmbedOnly(doc.id)}
                        disabled={runningIds.has(doc.id)}
                        title="이미 추출된 챕터로 RAG 임베딩만 실행 (rag_chunks 적재)"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          bg-amber-600 text-white hover:bg-amber-700
                          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {runningIds.has(doc.id) ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Play size={14} />
                        )}
                        임베딩 실행
                      </button>
                    )}
                    {/* completed 카드 전부에 [TOC 재추출] 보조 버튼.
                        ragIndexed=true 면 핸들러가 사전 confirm 으로 청크 정합성 경고. */}
                    {doc.status === 'completed' && (
                      <button
                        onClick={() => handleRetryToc(doc)}
                        disabled={runningIds.has(doc.id)}
                        title="목차(TOC) 만 다시 LLM 으로 추출하고 챕터 그룹핑 재실행"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          bg-bg-secondary text-text-primary hover:bg-bg-tertiary border border-border-light
                          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        TOC 재추출
                      </button>
                    )}
                    {/* 삭제 버튼 — 파이프라인 실행 중이 아닐 때만 활성화 */}
                    {!isProcessing(doc.status) && (
                      <button
                        onClick={() => handleDeleteDoc(doc)}
                        disabled={runningIds.has(doc.id)}
                        title="문서와 연관 데이터 전체 삭제"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          text-danger hover:bg-danger/10 border border-border-light
                          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 size={13} />
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 푸터 — 페이지네이션 + 총 건수. 컨테이너 하단 고정(목록과 스크롤 분리). */}
      {/*  - totalCount=0(빈 결과) 면 통째 숨김                                  */}
      {/*  - 1페이지여도 노출(좌측 "총 N건 · 1/1" 만이라도 보이도록 사용자 요청) */}
      {!loading && totalCount > 0 && (
        <div className="shrink-0 border-t border-border-light bg-bg-primary
          px-4 py-2.5 flex items-center justify-between gap-2">
          {/* 좌측: 총 건수 + 현재 페이지 / 전체 */}
          <span className="text-xs text-text-tertiary shrink-0 min-w-[120px]">
            총 {totalCount}건 · {page + 1}/{totalPages}
          </span>

          {/* 가운데: 페이지 버튼들. 1페이지면 숫자 1만 노출되어 시각적으로 자연스러움. */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm
                text-text-secondary hover:bg-bg-secondary
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} /> 이전
            </button>

            {pageNumbers(page, totalPages).map((p, idx) => (
              p === -1 ? (
                <span key={`gap-${idx}`} className="px-2 text-text-tertiary">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`min-w-[28px] px-2 py-1 rounded-lg text-sm transition-colors ${
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
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm
                text-text-secondary hover:bg-bg-secondary
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              다음 <ChevronRight size={14} />
            </button>
          </div>

          {/* 우측: 좌측 텍스트와 시각 균형용 빈 공간 (가운데 페이지 버튼이 시각적으로 중앙 오도록) */}
          <div className="shrink-0 min-w-[120px]" aria-hidden />
        </div>
      )}
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
