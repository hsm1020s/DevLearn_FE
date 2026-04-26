/**
 * @fileoverview 자동 생성 마인드맵 탭 — 문서 선택 → 챕터별 체크박스 + 상태 표시 + 선택 생성.
 * MindmapPanel 안의 "자동 생성" 탭에서 렌더링된다.
 */
import { useState, useEffect, useRef } from 'react';
import {
  FileText, ChevronLeft, ChevronRight, Loader2,
  BrainCircuit, Sparkles, AlertCircle, Check, Square, CheckSquare,
} from 'lucide-react';
import { fetchDocs, fetchChapterStatuses, generateMindmaps } from '../../services/feynmanApi';
import { getMindmap } from '../../services/mindmapApi';
import { showError, showSuccess } from '../../utils/errorHandler';
import useMindmapStore from '../../stores/useMindmapStore';

/**
 * 자동 생성 마인드맵 탭.
 * @param {object} props
 * @param {Function} props.onOpenMap - 마인드맵을 캔버스에 로드 후 "내 마인드맵" 탭으로 전환하는 콜백
 */
export default function AutoMindmapTab({ onOpenMap }) {
  // 1단계: 문서 목록
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);

  // 2단계: 선택된 문서 + 챕터 상태 목록
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [chapters, setChapters] = useState([]); // [{chapter, status, mindmapId, nodeCount}]
  const [chaptersLoading, setChaptersLoading] = useState(false);

  // 체크박스 상태
  const [checked, setChecked] = useState(new Set());

  // 생성 진행 상태
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef(null);

  // 문서 목록 로드
  useEffect(() => {
    let cancelled = false;
    setDocsLoading(true);
    fetchDocs()
      .then((data) => { if (!cancelled) setDocs(data || []); })
      .catch((err) => { if (!cancelled) showError(err, '문서 목록을 불러올 수 없습니다'); })
      .finally(() => { if (!cancelled) setDocsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // 문서를 보고 있는 동안 10초마다 상태 자동 갱신 (백그라운드 생성 감지용)
  useEffect(() => {
    if (!selectedDoc) return;
    const interval = setInterval(() => {
      fetchChapterStatuses(selectedDoc.id)
        .then((data) => setChapters(data || []))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedDoc]);

  // 폴링 정리
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // 문서 선택 시 챕터 상태 로드
  const handleDocSelect = (doc) => {
    setSelectedDoc(doc);
    setChecked(new Set());
    setGenerating(false);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    loadChapters(doc.id);
  };

  const loadChapters = (docId) => {
    setChaptersLoading(true);
    fetchChapterStatuses(docId)
      .then((data) => setChapters(data || []))
      .catch((err) => {
        showError(err, '챕터 상태를 불러올 수 없습니다');
        setChapters([]);
      })
      .finally(() => setChaptersLoading(false));
  };

  const handleBack = () => {
    setSelectedDoc(null);
    setChapters([]);
    setChecked(new Set());
    setGenerating(false);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  // 체크박스 토글
  const toggleCheck = (chapter) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(chapter)) next.delete(chapter); else next.add(chapter);
      return next;
    });
  };

  // 전체 선택/해제 (미생성만)
  // 선택 가능한 챕터 = 미생성 + 진행 중이 아닌 것만
  const selectable = chapters.filter((c) => c.status === 'not_generated');
  const allChecked = selectable.length > 0 && selectable.every((c) => checked.has(c.chapter));

  const toggleAll = () => {
    if (allChecked) {
      setChecked(new Set());
    } else {
      setChecked(new Set(selectable.map((c) => c.chapter)));
    }
  };

  // 선택 생성
  const handleGenerate = async () => {
    if (checked.size === 0 || !selectedDoc || generating) return;
    setGenerating(true);

    try {
      await generateMindmaps(selectedDoc.id, [...checked]);
      showSuccess(`${checked.size}개 챕터 마인드맵 생성 시작`);

      // 폴링 시작 (5초 간격)
      pollRef.current = setInterval(() => {
        fetchChapterStatuses(selectedDoc.id)
          .then((data) => {
            setChapters(data || []);
            // 선택한 챕터 중 미완료가 없으면 폴링 중단
            const stillPending = (data || []).some(
              (c) => checked.has(c.chapter) && c.status !== 'completed'
            );
            if (!stillPending) {
              clearInterval(pollRef.current);
              pollRef.current = null;
              setGenerating(false);
              setChecked(new Set());
              showSuccess('마인드맵 생성 완료');
            }
          })
          .catch(() => {});
      }, 5000);
    } catch (err) {
      showError(err, '마인드맵 생성 실패');
      setGenerating(false);
    }
  };

  // 완료된 마인드맵 열기
  const handleOpen = async (ch) => {
    if (!ch.mindmapId) return;
    try {
      const detail = await getMindmap(ch.mindmapId);
      const now = Date.now();
      useMindmapStore.setState((state) => ({
        maps: {
          ...state.maps,
          [ch.mindmapId]: {
            id: ch.mindmapId,
            title: detail.title ?? ch.chapter,
            mode: detail.mode ?? 'study',
            nodes: detail.nodes || [],
            createdAt: now,
            updatedAt: now,
            isLocal: false,
          },
        },
        activeMapId: ch.mindmapId,
        selectedNodeId: null,
        syncStatus: { ...state.syncStatus, [ch.mindmapId]: 'saved' },
        lastServerSyncAt: { ...state.lastServerSyncAt, [ch.mindmapId]: now },
      }));
      onOpenMap?.();
    } catch (err) {
      showError(err, '마인드맵을 불러올 수 없습니다');
    }
  };

  const completedCount = chapters.filter((c) => c.status === 'completed').length;
  const isAnyRunning = chapters.some((c) => c.status === 'generating' || c.status === 'pending');

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-border-light shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          {selectedDoc ? (
            <>
              <button
                onClick={handleBack}
                className="p-0.5 rounded hover:bg-bg-secondary transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <FileText size={14} className="text-primary" />
              <span className="truncate flex-1">{selectedDoc.fileName}</span>
              {chapters.length > 0 && (
                <span className="text-xs text-text-tertiary shrink-0">
                  {completedCount}/{chapters.length}
                </span>
              )}
            </>
          ) : (
            <>
              <BrainCircuit size={16} className="text-primary" />
              문서별 자동 마인드맵
            </>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto">
        {!selectedDoc ? (
          // ── 문서 목록 ──
          docsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-tertiary text-sm gap-2">
              <AlertCircle size={24} />
              <p>학습 가능한 문서가 없습니다</p>
              <p className="text-xs">PDF를 업로드하고 파이프라인을 완료해주세요</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {docs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleDocSelect(doc)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg
                    text-left hover:bg-bg-secondary transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary group-hover:text-primary
                      transition-colors truncate">
                      {doc.fileName}
                    </div>
                    <div className="text-xs text-text-tertiary">
                      {doc.pages}p · {doc.chunks}개 청크
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-text-tertiary shrink-0" />
                </button>
              ))}
            </div>
          )
        ) : chaptersLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-primary" />
          </div>
        ) : (
          // ── 챕터 목록 (체크박스 + 상태) ──
          <div>
            {/* 전체 선택 + 생성 버튼 */}
            <div className="sticky top-0 z-10 bg-bg-primary border-b border-border-light px-3 py-2 flex items-center gap-2">
              <button
                onClick={toggleAll}
                disabled={selectable.length === 0}
                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary
                  transition-colors disabled:opacity-40"
              >
                {allChecked
                  ? <CheckSquare size={14} className="text-primary" />
                  : <Square size={14} />}
                전체 선택
              </button>

              <div className="flex-1" />

              {generating ? (
                <span className="flex items-center gap-1.5 text-xs text-primary">
                  <Loader2 size={12} className="animate-spin" />
                  생성 중...
                </span>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={checked.size === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                    bg-primary text-white hover:bg-primary/90 transition-colors
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles size={12} />
                  선택 생성 ({checked.size})
                </button>
              )}
            </div>

            {/* 진행 상태 배너 */}
            {isAnyRunning && (
              <div className="mx-2 mt-1 flex items-center gap-2 px-3 py-2 rounded-lg
                bg-primary/5 text-primary text-xs">
                <Loader2 size={12} className="animate-spin" />
                백그라운드 생성 진행 중 ({completedCount}/{chapters.length})
              </div>
            )}

            {/* 챕터 리스트 */}
            <div className="p-2 space-y-0.5">
              {chapters.map((ch) => {
                const isCompleted = ch.status === 'completed';
                const isGeneratingNow = ch.status === 'generating';
                const isPending = ch.status === 'pending';
                const isSelectable = ch.status === 'not_generated';
                const isChecked = checked.has(ch.chapter);

                return (
                  <div
                    key={ch.chapter}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
                      ${isCompleted ? 'hover:bg-bg-secondary cursor-pointer' : ''}`}
                    onClick={isCompleted ? () => handleOpen(ch) : undefined}
                  >
                    {/* 왼쪽 아이콘/체크박스 */}
                    {isCompleted ? (
                      <Check size={16} className="text-success shrink-0" />
                    ) : isGeneratingNow ? (
                      <Loader2 size={16} className="animate-spin text-primary shrink-0" />
                    ) : isPending ? (
                      <div className="w-4 h-4 rounded-full border-2 border-primary/30 shrink-0" />
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCheck(ch.chapter); }}
                        disabled={generating}
                        className="shrink-0 text-text-tertiary hover:text-primary transition-colors
                          disabled:opacity-40"
                      >
                        {isChecked
                          ? <CheckSquare size={16} className="text-primary" />
                          : <Square size={16} />}
                      </button>
                    )}

                    {/* 챕터명 */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate ${
                        isCompleted ? 'text-text-primary'
                          : isGeneratingNow ? 'text-primary'
                          : 'text-text-secondary'
                      }`}>
                        {ch.chapter}
                      </div>
                    </div>

                    {/* 상태 레이블 */}
                    {isCompleted ? (
                      <span className="text-xs text-text-tertiary shrink-0">
                        {ch.nodeCount}개 노드
                      </span>
                    ) : isGeneratingNow ? (
                      <span className="text-xs text-primary shrink-0">생성 중</span>
                    ) : isPending ? (
                      <span className="text-xs text-text-tertiary shrink-0">대기</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
