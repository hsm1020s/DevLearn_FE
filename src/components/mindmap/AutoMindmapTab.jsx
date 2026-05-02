/**
 * @fileoverview 자동 생성 마인드맵 탭 — 문서 선택 → 챕터별 체크박스 + 상태 표시 + 선택 생성.
 * MindmapPanel 안의 "자동 생성" 탭에서 렌더링된다.
 */
import { useState, useEffect, useRef } from 'react';
import {
  FileText, ChevronLeft, ChevronRight, Loader2,
  BrainCircuit, Sparkles, AlertCircle, Check, Square, CheckSquare, Film, Music, Presentation,
} from 'lucide-react';
import { fetchDocs, fetchChapterStatuses, generateMindmaps } from '../../services/feynmanApi';
import { getMindmap } from '../../services/mindmapApi';
import {
  fetchLectureStatus, streamLectureScript, safeChapterName,
  startLectureBatch, finishLectureBatch,
  fetchLectureAudioStatus, streamLectureAudio,
  startLectureAudioBatch, finishLectureAudioBatch,
  fetchLectureSlidesStatus, streamLectureSlides,
  startLectureSlidesBatch, finishLectureSlidesBatch,
} from '../../services/lectureApi';
import { showError, showSuccess } from '../../utils/errorHandler';
import useMindmapStore from '../../stores/useMindmapStore';
import LectureScriptDrawer from '../lecture/LectureScriptDrawer';

/** 소단원의 고유 키를 생성한다. 같은 이름의 소단원이 다른 대단원에 있어도 구별된다. */
const chKey = (ch) => `${ch.parentChapter || ''}::${ch.chapter}`;

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
  const [chapters, setChapters] = useState([]); // [{chapter, parentChapter, status, mindmapId, nodeCount}]
  const [chaptersLoading, setChaptersLoading] = useState(false);

  // 체크박스 상태 — Set<"parentChapter::chapter"> 복합키로 동명 소단원 구별
  const [checked, setChecked] = useState(new Set());

  // 생성 진행 상태
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef(null);

  // 강의 대본 드로워 — 열린 챕터명 (null 이면 닫힘)
  const [lectureChapter, setLectureChapter] = useState(null);

  // 강의 대본 — 이미 생성된 챕터의 safe-name Set
  const [lectureScripts, setLectureScripts] = useState(new Set());

  // 강의 오디오 (Phase 2) — 이미 생성된 챕터의 safe-name Set
  const [lectureAudio, setLectureAudio] = useState(new Set());

  // 강의 슬라이드 (Phase 3) — 이미 생성된 챕터의 safe-name Set
  const [lectureSlides, setLectureSlides] = useState(new Set());

  // 일괄 생성 진행 상태
  // { running, total, idx, currentChapter, batchStartedAt, abort }
  const [lectureBatch, setLectureBatch] = useState(null);

  // 챕터별 진행 상태 — 배치 동안만 유효, 종료 후엔 lastBatchResult 로 정리됨
  // { [chapter]: { status: 'queued'|'running'|'done'|'error', startedAt?, finishedAt?, error? } }
  const [chapterBatchStatus, setChapterBatchStatus] = useState({});

  // 마지막 배치 결과 패널 — 사용자가 닫을 때까지 유지
  // { succeeded: [chapter], failed: [{chapter, error}], finishedAt: number }
  const [lastBatchResult, setLastBatchResult] = useState(null);

  // 일괄 생성 confirm 팝오버
  // { type: 'book'|'parent', parent?: string, chapters: string[], anchor: DOMRect }
  const [lectureConfirm, setLectureConfirm] = useState(null);
  const lectureConfirmRef = useRef(null);

  // 배치 동안 1초 tick — elapsed 시간 강제 리렌더용 (값 자체는 사용 안 함)
  const [, setBatchTick] = useState(0);
  useEffect(() => {
    if (!lectureBatch?.running) return undefined;
    const id = setInterval(() => setBatchTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [lectureBatch?.running]);

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

  // 문서 선택 시 챕터 상태 로드 + 강의 대본/오디오 현황 동시 로드
  const handleDocSelect = (doc) => {
    setSelectedDoc(doc);
    setChecked(new Set());
    setGenerating(false);
    setLectureScripts(new Set());
    setLectureAudio(new Set());
    setLectureSlides(new Set());
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    loadChapters(doc.id);
    fetchLectureStatus(doc.id)
      .then((set) => setLectureScripts(set))
      .catch(() => { /* 비치명 — 일괄 생성 시 모두 미생성으로 간주됨 */ });
    fetchLectureAudioStatus(doc.id)
      .then((set) => setLectureAudio(set))
      .catch(() => { /* 비치명 */ });
    fetchLectureSlidesStatus(doc.id)
      .then((set) => setLectureSlides(set))
      .catch(() => { /* 비치명 */ });
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
    setLectureScripts(new Set());
    setLectureAudio(new Set());
    setLectureSlides(new Set());
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  // ── 강의 대본 일괄 생성 ──

  // 외부 클릭 시 confirm 팝오버 닫기
  useEffect(() => {
    if (!lectureConfirm) return undefined;
    const onDoc = (e) => {
      if (lectureConfirmRef.current && !lectureConfirmRef.current.contains(e.target)) {
        setLectureConfirm(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [lectureConfirm]);

  /** 주어진 scope 의 대상 챕터 목록 + 이미 생성된 건 제외. kind='script' 또는 'audio' 별로 다른 Set 사용. */
  const collectLectureChapters = (scope, parent, kind = 'script') => {
    const inScope = chapters.filter((ch) => {
      if (ch.status !== 'completed') return false;
      if (scope === 'parent') return (ch.parentChapter || null) === parent;
      return true; // book scope
    });
    const generatedSet = kind === 'audio' ? lectureAudio
      : kind === 'slides' ? lectureSlides
      : lectureScripts;
    // 오디오/슬라이드는 스크립트가 먼저 있어야 생성 가능하므로 lectureScripts 도 필터에 추가.
    const eligible = (kind === 'audio' || kind === 'slides')
      ? inScope.filter((ch) => lectureScripts.has(safeChapterName(ch.chapter)))
      : inScope;
    const pending = eligible.filter((ch) => !generatedSet.has(safeChapterName(ch.chapter)));
    return {
      all: eligible.map((c) => c.chapter),
      pending: pending.map((c) => c.chapter),
      noScriptSkipped: (kind === 'audio' || kind === 'slides') ? inScope.length - eligible.length : 0,
    };
  };

  const openLectureConfirm = (scope, parent, btnEl, kind = 'script') => {
    if (lectureBatch?.running) return;
    const rect = btnEl.getBoundingClientRect();
    const { all, pending, noScriptSkipped } = collectLectureChapters(scope, parent, kind);
    if (all.length === 0 && noScriptSkipped === 0) return;
    const POPOVER_W = 300;
    const POPOVER_H_EST = pending.length > 0 ? 200 : 160;
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom;
    const placeAbove = spaceBelow < POPOVER_H_EST + 8;
    const top = placeAbove ? Math.max(8, rect.top - POPOVER_H_EST - 4) : rect.bottom + 4;
    const left = Math.min(window.innerWidth - POPOVER_W - 8,
                          Math.max(8, rect.right - POPOVER_W));
    setLectureConfirm({
      type: scope, parent, kind, all, pending, noScriptSkipped,
      anchor: { top, left, width: POPOVER_W, placeAbove },
    });
  };

  const cancelLectureBatch = () => {
    if (lectureBatch?.abort) lectureBatch.abort.abort();
    setLectureBatch(null);
  };

  const runLectureBatch = async (chaptersToRun, scope = 'book', parent = null, kind = 'script') => {
    if (chaptersToRun.length === 0) {
      setLectureConfirm(null);
      return;
    }
    setLectureConfirm(null);
    setLastBatchResult(null);
    const abort = new AbortController();
    const batchStartedAt = Date.now();

    const startBatchFn = kind === 'audio' ? startLectureAudioBatch
      : kind === 'slides' ? startLectureSlidesBatch
      : startLectureBatch;
    const finishBatchFn = kind === 'audio' ? finishLectureAudioBatch
      : kind === 'slides' ? finishLectureSlidesBatch
      : finishLectureBatch;
    const streamFn = kind === 'audio' ? streamLectureAudio
      : kind === 'slides' ? streamLectureSlides
      : streamLectureScript;
    const updateGeneratedSet = kind === 'audio' ? setLectureAudio
      : kind === 'slides' ? setLectureSlides
      : setLectureScripts;

    // 서버에 batch 행 INSERT — 실패해도 일괄 자체는 진행 (영속화는 best-effort)
    let batchId = null;
    try {
      batchId = await startBatchFn(selectedDoc.id, scope, parent, chaptersToRun.length);
    } catch (err) {
      showError(err, '배치 이력 저장 시작 실패 (생성은 계속 진행)');
    }

    const initStatus = {};
    for (const ch of chaptersToRun) {
      initStatus[ch] = { status: 'queued' };
    }
    setChapterBatchStatus(initStatus);

    setLectureBatch({
      running: true, total: chaptersToRun.length, idx: 0,
      currentChapter: chaptersToRun[0], batchStartedAt, abort, batchId, kind,
    });

    const succeeded = [];
    const failed = [];
    for (let i = 0; i < chaptersToRun.length; i += 1) {
      if (abort.signal.aborted) break;
      const chapter = chaptersToRun[i];
      const startedAt = Date.now();
      setLectureBatch((prev) => prev ? { ...prev, idx: i, currentChapter: chapter } : prev);
      setChapterBatchStatus((prev) => ({
        ...prev,
        [chapter]: { status: 'running', startedAt },
      }));
      try {
        await streamFn({
          docId: selectedDoc.id,
          chapter,
          batchId,
          onDone: () => {
            updateGeneratedSet((prev) => {
              const next = new Set(prev);
              next.add(safeChapterName(chapter));
              return next;
            });
          },
          signal: abort.signal,
        });
        succeeded.push(chapter);
        setChapterBatchStatus((prev) => ({
          ...prev,
          [chapter]: { status: 'done', startedAt, finishedAt: Date.now() },
        }));
      } catch (err) {
        if (abort.signal.aborted) break;
        const message = err?.userMessage || err?.message || '알 수 없는 오류';
        failed.push({ chapter, error: message });
        setChapterBatchStatus((prev) => ({
          ...prev,
          [chapter]: { status: 'error', startedAt, finishedAt: Date.now(), error: message },
        }));
      }
    }

    setLectureBatch(null);

    if (batchId) {
      const finalStatus = abort.signal.aborted ? 'aborted' : 'completed';
      const skipped = chaptersToRun.length - succeeded.length - failed.length;
      try {
        await finishBatchFn(batchId, {
          status: finalStatus, succeeded: succeeded.length, failed: failed.length, skipped,
        });
      } catch (err) {
        console.warn('[Lecture] batch finish 보고 실패', err);
      }
    }

    if (!abort.signal.aborted) {
      setLastBatchResult({ kind, succeeded, failed, finishedAt: Date.now() });
      const skipped = chaptersToRun.length - succeeded.length - failed.length;
      const label = kind === 'audio' ? '강의 오디오' : kind === 'slides' ? '강의 슬라이드' : '강의 대본';
      const msg = `${label} ${succeeded.length}개 생성 완료`
        + (failed.length > 0 ? `, ${failed.length}개 실패` : '')
        + (skipped > 0 ? `, ${skipped}개 미실행` : '');
      if (failed.length === 0) showSuccess(msg);
    }
  };

  /** ms → "M:SS" 또는 "MM:SS" 포맷. */
  const formatElapsed = (ms) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // 소단원 체크박스 토글
  const toggleCheck = (ch) => {
    const key = chKey(ch);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // 대단원(부모) 체크박스 토글 — 하위 소단원 중 미생성인 것을 일괄 선택/해제
  const toggleParent = (parentName) => {
    const children = chapters.filter(
      (c) => c.parentChapter === parentName && c.status === 'not_generated'
    );
    setChecked((prev) => {
      const next = new Set(prev);
      const allIn = children.every((c) => next.has(chKey(c)));
      if (allIn) {
        children.forEach((c) => next.delete(chKey(c)));
      } else {
        children.forEach((c) => next.add(chKey(c)));
      }
      return next;
    });
  };

  // 전체 선택/해제 (미생성만)
  const selectable = chapters.filter((c) => c.status === 'not_generated');
  const allChecked = selectable.length > 0 && selectable.every((c) => checked.has(chKey(c)));

  const toggleAll = () => {
    if (allChecked) {
      setChecked(new Set());
    } else {
      setChecked((prev) => {
        const next = new Set(prev);
        selectable.forEach((c) => next.add(chKey(c)));
        return next;
      });
    }
  };

  // 선택 생성 — checked(복합키)에서 chapter 이름만 추출하여 API 전송
  const handleGenerate = async () => {
    if (checked.size === 0 || !selectedDoc || generating) return;
    setGenerating(true);

    // 복합키 → chapter 이름 변환
    const selectedChapterNames = chapters
      .filter((c) => checked.has(chKey(c)))
      .map((c) => c.chapter);

    try {
      await generateMindmaps(selectedDoc.id, selectedChapterNames);
      showSuccess(`${checked.size}개 챕터 마인드맵 생성 시작`);

      // 폴링 시작 (5초 간격)
      const checkedSnapshot = new Set(checked);
      pollRef.current = setInterval(() => {
        fetchChapterStatuses(selectedDoc.id)
          .then((data) => {
            setChapters(data || []);
            const stillPending = (data || []).some(
              (c) => checkedSnapshot.has(chKey(c)) && c.status !== 'completed'
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
                  : checked.size > 0
                    ? <CheckSquare size={14} className="text-primary/40" />
                    : <Square size={14} />}
                전체 선택
              </button>

              <div className="flex-1" />

              {/* 책 단위 강의 대본 일괄 생성 */}
              <button
                onClick={(e) => openLectureConfirm('book', null, e.currentTarget, 'script')}
                disabled={lectureBatch?.running
                  || chapters.filter((c) => c.status === 'completed').length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                  border border-border-light text-text-secondary hover:border-primary hover:text-primary
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="이 책의 모든 챕터에 대해 강의 대본 일괄 생성"
              >
                <Film size={12} />
                전체 강의
              </button>

              {/* 책 단위 강의 오디오 일괄 생성 (Phase 2) */}
              <button
                onClick={(e) => openLectureConfirm('book', null, e.currentTarget, 'audio')}
                disabled={lectureBatch?.running
                  || chapters.filter((c) => c.status === 'completed').length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                  border border-border-light text-text-secondary hover:border-primary hover:text-primary
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="강의 대본이 있는 챕터의 오디오 일괄 생성"
              >
                <Music size={12} />
                전체 오디오
              </button>

              {/* 책 단위 강의 슬라이드 일괄 생성 (Phase 3) */}
              <button
                onClick={(e) => openLectureConfirm('book', null, e.currentTarget, 'slides')}
                disabled={lectureBatch?.running
                  || chapters.filter((c) => c.status === 'completed').length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                  border border-border-light text-text-secondary hover:border-primary hover:text-primary
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="강의 대본이 있는 챕터의 슬라이드 일괄 생성"
              >
                <Presentation size={12} />
                전체 슬라이드
              </button>

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

            {/* 강의 대본 일괄 진행 배너 */}
            {lectureBatch?.running && (() => {
              const totalElapsed = formatElapsed(Date.now() - lectureBatch.batchStartedAt);
              const curStatus = chapterBatchStatus[lectureBatch.currentChapter];
              const curElapsed = curStatus?.startedAt
                ? formatElapsed(Date.now() - curStatus.startedAt) : '0:00';
              const doneCount = Object.values(chapterBatchStatus).filter((s) => s.status === 'done').length;
              const errorCount = Object.values(chapterBatchStatus).filter((s) => s.status === 'error').length;
              return (
                <div className="mx-2 mt-1 flex flex-col gap-1 px-3 py-2 rounded-lg
                  bg-primary/5 text-primary text-xs">
                  <div className="flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin shrink-0" />
                    <span className="flex-1 truncate">
                      ({lectureBatch.idx + 1}/{lectureBatch.total}) {lectureBatch.currentChapter}
                    </span>
                    <span className="shrink-0 text-text-tertiary">현재 {curElapsed}</span>
                    <button
                      onClick={cancelLectureBatch}
                      className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      중단
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-text-tertiary pl-4">
                    <span>전체 {totalElapsed}</span>
                    <span>✓ {doneCount}</span>
                    {errorCount > 0 && <span className="text-danger">⚠️ {errorCount}</span>}
                    <span>· 남음 {lectureBatch.total - doneCount - errorCount}</span>
                  </div>
                </div>
              );
            })()}

            {/* 마지막 일괄 결과 패널 — 사용자 닫을 때까지 유지 */}
            {!lectureBatch?.running && lastBatchResult && (
              <div className="mx-2 mt-1 px-3 py-2 rounded-lg bg-bg-secondary text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-text-primary">
                    최근 일괄 {lastBatchResult.kind === 'audio' ? '오디오' : lastBatchResult.kind === 'slides' ? '슬라이드' : '대본'} 생성 — 성공 <b className="text-success">{lastBatchResult.succeeded.length}</b>
                    {lastBatchResult.failed.length > 0 && (
                      <> · 실패 <b className="text-danger">{lastBatchResult.failed.length}</b></>
                    )}
                  </span>
                  {lastBatchResult.failed.length > 0 && (
                    <button
                      onClick={() => runLectureBatch(
                        lastBatchResult.failed.map((f) => f.chapter),
                        'book', null, lastBatchResult.kind || 'script')}
                      className="px-2 py-0.5 rounded text-[11px] font-medium text-white bg-primary
                        hover:bg-primary/90 transition-colors"
                    >
                      실패만 재시도
                    </button>
                  )}
                  <button
                    onClick={() => { setLastBatchResult(null); setChapterBatchStatus({}); }}
                    className="text-text-tertiary hover:text-text-primary transition-colors"
                    aria-label="결과 닫기"
                  >
                    ✕
                  </button>
                </div>
                {lastBatchResult.failed.length > 0 && (
                  <ul className="mt-1.5 ml-1 space-y-0.5 text-[11px] text-text-secondary">
                    {lastBatchResult.failed.map((f) => (
                      <li key={f.chapter} className="truncate">
                        <span className="text-danger mr-1">⚠️</span>
                        <span className="font-medium">{f.chapter}</span>
                        <span className="text-text-tertiary ml-1">— {f.error}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 진행 상태 배너 */}
            {isAnyRunning && (
              <div className="mx-2 mt-1 flex items-center gap-2 px-3 py-2 rounded-lg
                bg-primary/5 text-primary text-xs">
                <Loader2 size={12} className="animate-spin" />
                백그라운드 생성 진행 중 ({completedCount}/{chapters.length})
              </div>
            )}

            {/* 챕터 리스트 — parentChapter로 그룹핑 */}
            <div className="p-2 space-y-0.5">
              {(() => {
                const groups = [];
                let currentParent = null;
                for (const ch of chapters) {
                  const parent = ch.parentChapter || null;
                  if (parent !== currentParent) {
                    groups.push({ parent, items: [ch] });
                    currentParent = parent;
                  } else {
                    groups[groups.length - 1].items.push(ch);
                  }
                }

                return groups.map((group) => (
                  <div key={group.parent || '__flat__'}>
                    {/* 대단원 헤더 + 체크박스 */}
                    {group.parent && (() => {
                      const groupSelectable = group.items.filter((c) => c.status === 'not_generated');
                      const groupAllChecked = groupSelectable.length > 0
                        && groupSelectable.every((c) => checked.has(chKey(c)));
                      const groupSomeChecked = groupSelectable.some((c) => checked.has(chKey(c)));

                      return (
                        <div
                          className="flex items-center gap-2 px-3 py-2 mt-2 first:mt-0 rounded-lg
                            hover:bg-bg-secondary/50 transition-colors cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); toggleParent(group.parent); }}
                        >
                          {groupSelectable.length > 0 ? (
                            groupAllChecked
                              ? <CheckSquare size={14} className="text-primary shrink-0" />
                              : groupSomeChecked
                                ? <CheckSquare size={14} className="text-primary/40 shrink-0" />
                                : <Square size={14} className="text-text-tertiary shrink-0" />
                          ) : (
                            <Check size={14} className="text-success/60 shrink-0" />
                          )}
                          <FileText size={13} className="text-primary/60 shrink-0" />
                          <span className="text-xs font-semibold text-text-secondary truncate flex-1">
                            {group.parent}
                          </span>
                          {group.items.some((c) => c.status === 'completed') && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLectureConfirm('parent', group.parent, e.currentTarget, 'script');
                                }}
                                disabled={lectureBatch?.running}
                                className="shrink-0 p-1 rounded text-text-tertiary
                                  hover:text-primary hover:bg-bg-tertiary transition-colors
                                  disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="이 과목 강의 일괄 생성"
                                title="이 과목의 챕터 강의 대본 일괄 생성"
                              >
                                <Film size={13} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLectureConfirm('parent', group.parent, e.currentTarget, 'audio');
                                }}
                                disabled={lectureBatch?.running}
                                className="shrink-0 p-1 rounded text-text-tertiary
                                  hover:text-primary hover:bg-bg-tertiary transition-colors
                                  disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="이 과목 오디오 일괄 생성"
                                title="이 과목의 챕터 오디오(TTS) 일괄 생성"
                              >
                                <Music size={13} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLectureConfirm('parent', group.parent, e.currentTarget, 'slides');
                                }}
                                disabled={lectureBatch?.running}
                                className="shrink-0 p-1 rounded text-text-tertiary
                                  hover:text-primary hover:bg-bg-tertiary transition-colors
                                  disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="이 과목 슬라이드 일괄 생성"
                                title="이 과목의 챕터 슬라이드 일괄 생성"
                              >
                                <Presentation size={13} />
                              </button>
                            </>
                          )}
                          <span className="text-xs text-text-tertiary shrink-0">
                            {group.items.filter((c) => c.status === 'completed').length}/{group.items.length}
                          </span>
                        </div>
                      );
                    })()}

                    {/* 소단원 리스트 */}
                    {group.items.map((ch) => {
                      const key = chKey(ch);
                      const isCompleted = ch.status === 'completed';
                      const isGeneratingNow = ch.status === 'generating';
                      const isPending = ch.status === 'pending';
                      const isChecked = checked.has(key);
                      const indent = group.parent ? 'pl-6' : '';

                      return (
                        <div
                          key={key}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${indent}
                            ${isCompleted ? 'hover:bg-bg-secondary cursor-pointer' : ''}`}
                          onClick={isCompleted ? () => handleOpen(ch) : undefined}
                        >
                          {isCompleted ? (
                            <Check size={16} className="text-success shrink-0" />
                          ) : isGeneratingNow ? (
                            <Loader2 size={16} className="animate-spin text-primary shrink-0" />
                          ) : isPending ? (
                            <div className="w-4 h-4 rounded-full border-2 border-primary/30 shrink-0" />
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleCheck(ch); }}
                              disabled={generating}
                              className="shrink-0 text-text-tertiary hover:text-primary transition-colors
                                disabled:opacity-40"
                            >
                              {isChecked
                                ? <CheckSquare size={16} className="text-primary" />
                                : <Square size={16} />}
                            </button>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className={`text-sm truncate ${
                              isCompleted ? 'text-text-primary'
                                : isGeneratingNow ? 'text-primary'
                                : 'text-text-secondary'
                            }`}>
                              {ch.chapter}
                            </div>
                          </div>

                          {isCompleted ? (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); setLectureChapter(ch.chapter); }}
                                disabled={lectureBatch?.running}
                                className="shrink-0 p-1 rounded text-text-tertiary
                                  hover:text-primary hover:bg-bg-tertiary transition-colors
                                  disabled:opacity-40 disabled:cursor-not-allowed
                                  aria-checked:text-primary"
                                aria-label="강의 대본"
                                aria-checked={lectureScripts.has(safeChapterName(ch.chapter))}
                                title={lectureScripts.has(safeChapterName(ch.chapter))
                                  ? '강의 대본 보기 (생성됨)' : '강의 대본 생성'}
                              >
                                <Film size={14} className={
                                  lectureScripts.has(safeChapterName(ch.chapter))
                                    ? 'text-primary' : ''
                                } />
                              </button>
                              {/* 오디오 상태 인디케이터 — 클릭하면 드로워 열어서 오디오 섹션에서 재생/생성 */}
                              <button
                                onClick={(e) => { e.stopPropagation(); setLectureChapter(ch.chapter); }}
                                disabled={lectureBatch?.running}
                                className="shrink-0 p-1 rounded text-text-tertiary
                                  hover:text-primary hover:bg-bg-tertiary transition-colors
                                  disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="강의 오디오"
                                title={lectureAudio.has(safeChapterName(ch.chapter))
                                  ? '오디오 재생 (드로워 열기)' : '오디오 생성 (드로워 열기)'}
                              >
                                <Music size={13} className={
                                  lectureAudio.has(safeChapterName(ch.chapter))
                                    ? 'text-primary' : ''
                                } />
                              </button>
                              {/* 슬라이드 상태 인디케이터 */}
                              <button
                                onClick={(e) => { e.stopPropagation(); setLectureChapter(ch.chapter); }}
                                disabled={lectureBatch?.running}
                                className="shrink-0 p-1 rounded text-text-tertiary
                                  hover:text-primary hover:bg-bg-tertiary transition-colors
                                  disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="강의 슬라이드"
                                title={lectureSlides.has(safeChapterName(ch.chapter))
                                  ? '슬라이드 보기 (드로워 열기)' : '슬라이드 생성 (드로워 열기)'}
                              >
                                <Presentation size={13} className={
                                  lectureSlides.has(safeChapterName(ch.chapter))
                                    ? 'text-primary' : ''
                                } />
                              </button>
                              {/* 배치 상태 배지 — 배치 동안 또는 마지막 배치 결과 표시 */}
                              {(() => {
                                const st = chapterBatchStatus[ch.chapter];
                                if (!st) return null;
                                if (st.status === 'queued') {
                                  return <span className="text-[10px] text-text-tertiary shrink-0" title="대기 중">🕒</span>;
                                }
                                if (st.status === 'running') {
                                  const elapsed = formatElapsed(Date.now() - (st.startedAt || Date.now()));
                                  return (
                                    <span className="flex items-center gap-1 text-[10px] text-primary shrink-0"
                                      title="생성 중">
                                      <Loader2 size={10} className="animate-spin" />
                                      {elapsed}
                                    </span>
                                  );
                                }
                                if (st.status === 'done') {
                                  const elapsed = st.finishedAt && st.startedAt
                                    ? formatElapsed(st.finishedAt - st.startedAt) : null;
                                  return (
                                    <span className="text-[10px] text-success shrink-0"
                                      title={`완료${elapsed ? ` (${elapsed})` : ''}`}>
                                      ✓{elapsed ? ` ${elapsed}` : ''}
                                    </span>
                                  );
                                }
                                if (st.status === 'error') {
                                  return (
                                    <span className="text-[10px] text-danger shrink-0 cursor-help"
                                      title={st.error || '실패'}>
                                      ⚠️
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              <span className="text-xs text-text-tertiary shrink-0">
                                {ch.nodeCount}개 노드
                              </span>
                            </>
                          ) : isGeneratingNow ? (
                            <span className="text-xs text-primary shrink-0">생성 중</span>
                          ) : isPending ? (
                            <span className="text-xs text-text-tertiary shrink-0">대기</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>

      <LectureScriptDrawer
        open={!!lectureChapter}
        onClose={() => {
          // 드로워 닫을 때 status 다시 동기화 (단일 생성 시 set 갱신)
          if (selectedDoc?.id) {
            fetchLectureStatus(selectedDoc.id).then(setLectureScripts).catch(() => {});
            fetchLectureAudioStatus(selectedDoc.id).then(setLectureAudio).catch(() => {});
            fetchLectureSlidesStatus(selectedDoc.id).then(setLectureSlides).catch(() => {});
          }
          setLectureChapter(null);
        }}
        docId={selectedDoc?.id}
        chapter={lectureChapter}
        audioExistsHint={lectureChapter
          ? lectureAudio.has(safeChapterName(lectureChapter))
          : undefined}
        slidesExistsHint={lectureChapter
          ? lectureSlides.has(safeChapterName(lectureChapter))
          : undefined}
      />

      {/* 강의 대본 일괄 생성 확인 팝오버 */}
      {lectureConfirm && (
        <div
          ref={lectureConfirmRef}
          className="fixed z-[999] bg-bg-primary border border-border-light rounded-lg shadow-lg p-3
            animate-popover-in"
          style={{
            top: lectureConfirm.anchor.top,
            left: Math.max(8, lectureConfirm.anchor.left),
            width: lectureConfirm.anchor.width,
          }}
        >
          {(() => {
            const kind = lectureConfirm.kind;
            const label = kind === 'audio' ? '오디오' : kind === 'slides' ? '슬라이드' : '강의 대본';
            const modelHint = kind === 'audio' ? 'OpenAI TTS (nova), 챕터당 1~2분, ~$0.075'
              : kind === 'slides' ? 'gpt-5.4-mini bullet + Playwright 캡처, 챕터당 30~60초'
              : 'gpt-5.4-mini, 챕터당 1~3분';
            const scopeLabel = lectureConfirm.type === 'book' ? '책 전체' : '과목';
            return (
              <>
                <div className="text-xs font-medium text-text-primary mb-2">
                  {scopeLabel} {label} 생성
                </div>
                <div className="text-xs text-text-secondary mb-3 leading-relaxed">
                  대상 챕터 {lectureConfirm.all.length}개 중{' '}
                  <b className="text-text-primary">{lectureConfirm.pending.length}개 새로 생성</b>,{' '}
                  {lectureConfirm.all.length - lectureConfirm.pending.length}개는 이미 있어 건너뜁니다.
                  {lectureConfirm.noScriptSkipped > 0 && (
                    <>
                      <br />
                      <span className="text-warning">
                        ⚠️ 강의 대본이 없어 {lectureConfirm.noScriptSkipped}개 챕터는 제외됩니다 (먼저 대본 생성 필요).
                      </span>
                    </>
                  )}
                  <br />
                  ({modelHint})
                </div>
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => setLectureConfirm(null)}
                    className="px-3 py-1.5 rounded text-xs text-text-secondary hover:bg-bg-secondary transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => runLectureBatch(lectureConfirm.pending, lectureConfirm.type, lectureConfirm.parent, lectureConfirm.kind)}
                    disabled={lectureConfirm.pending.length === 0}
                    className="px-3 py-1.5 rounded text-xs font-medium text-white bg-primary
                      hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {lectureConfirm.pending.length > 0
                      ? `생성 시작 (${lectureConfirm.pending.length}개)`
                      : '생성할 챕터 없음'}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
