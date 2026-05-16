/**
 * @fileoverview 파인만 [지식 재구축] 액션의 진행 상태를 관리하는 훅.
 *
 * BE 통합 진행률 API `GET /api/feynman/{docId}/rebuild-progress` 를 3초마다 폴링해
 * 마인드맵 + 챕터 질문 합성을 모두 추적한다.
 *
 * 거짓 완료(false-success) 제거:
 *  - 이전엔 마인드맵 100% = 완료 토스트 → 챕터 질문 합성 실패 시에도 "완료" 표시.
 *  - 이번엔 `complete === true` (questions 도 100%) 일 때만 done 처리.
 *  - 30분 stale 도달 시 done 대신 **실패 토스트** 발화 → 사용자가 다시 시도 가능.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRebuildProgress } from '../services/feynmanApi';

/** localStorage 키 — 활성 재구축 엔트리 영속화 */
const LS_KEY = 'feynman.rebuild.active.v1';
/** 폴링 주기(ms) */
const POLL_INTERVAL_MS = 3000;
/** stale 엔트리 강제 제거 임계(ms) — 30분 */
const STALE_TIMEOUT_MS = 30 * 60 * 1000;

/** localStorage 안전 로드. 시크릿 모드 등에서 실패하면 빈 객체. */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

/** localStorage 안전 저장. 실패해도 silent — 메모리 상태는 유지. */
function saveToStorage(map) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/**
 * BE 응답으로 phase 산정.
 * - totalChapters 0  → wiping (첫 응답 아직 또는 toc 미감지)
 * - mindmaps < total → generating (마인드맵 합성 중)
 * - mindmaps === total && questions < total → finalizing (질문 합성 중)
 * - complete === true → done
 */
function derivePhase({ totalChapters, mindmapsReady, questionsReady, complete }) {
  if (complete) return 'done';
  if (!totalChapters || totalChapters === 0) return 'wiping';
  if (mindmapsReady < totalChapters) return 'generating';
  if (questionsReady < totalChapters) return 'finalizing';
  return 'finalizing';
}

/**
 * @param {object} [opts]
 * @param {(docId: string) => void} [opts.onComplete] — complete=true 도달 시 1회 호출
 * @param {(docId: string) => void} [opts.onFailed]   — 30분 stale 도달 시 1회 호출
 */
export default function useRebuildProgress({ onComplete, onFailed } = {}) {
  const [entries, setEntries] = useState(() => loadFromStorage());
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onFailedRef.current = onFailed; }, [onFailed]);

  const updateEntries = useCallback((updater) => {
    setEntries((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveToStorage(next);
      return next;
    });
  }, []);

  /** 새 재구축 엔트리 추가 — Pipeline 탭의 runRebuildKnowledge 가 호출. */
  const startRebuild = useCallback((docId) => {
    if (!docId) return;
    updateEntries((prev) => ({
      ...prev,
      [docId]: {
        docId,
        startedAt: Date.now(),
        totalChapters: 0,
        mindmapsReady: 0,
        questionsReady: 0,
        phase: 'wiping',
      },
    }));
  }, [updateEntries]);

  const getProgress = useCallback((docId) => entries[docId] || null, [entries]);
  const isActive = useCallback((docId) => Boolean(entries[docId]), [entries]);

  // 단일 폴링 사이클.
  const pollOnce = useCallback(async () => {
    const snapshot = await new Promise((resolve) => {
      setEntries((curr) => { resolve(curr); return curr; });
    });
    const activeIds = Object.keys(snapshot);
    if (activeIds.length === 0) return;

    const results = await Promise.allSettled(
      activeIds.map((id) => fetchRebuildProgress(id))
    );

    const completedIds = [];
    const failedIds = [];

    updateEntries((prev) => {
      const next = { ...prev };
      const now = Date.now();

      activeIds.forEach((docId, i) => {
        const entry = next[docId];
        if (!entry) return;

        if (now - entry.startedAt > STALE_TIMEOUT_MS) {
          // eslint-disable-next-line no-console
          console.warn(`[rebuild-progress] stale entry → failed: docId=${docId}`);
          failedIds.push(docId);
          delete next[docId];
          return;
        }

        const res = results[i];
        if (res.status !== 'fulfilled') return; // 폴링 실패 — 다음 cycle 재시도

        const data = res.value || {};
        const total = data.totalChapters || 0;
        const mindmaps = Math.min(data.mindmapsReady || 0, total || 0);
        const questions = Math.min(data.questionsReady || 0, total || 0);
        const complete = Boolean(data.complete);

        const phase = derivePhase({ totalChapters: total, mindmapsReady: mindmaps, questionsReady: questions, complete });

        if (phase === 'done') {
          completedIds.push(docId);
          delete next[docId];
          return;
        }

        next[docId] = {
          ...entry,
          totalChapters: total,
          mindmapsReady: mindmaps,
          questionsReady: questions,
          phase,
        };
      });

      return next;
    });

    if (completedIds.length > 0) {
      const cb = onCompleteRef.current;
      if (cb) completedIds.forEach((id) => { try { cb(id); } catch { /* swallow */ } });
    }
    if (failedIds.length > 0) {
      const cb = onFailedRef.current;
      if (cb) failedIds.forEach((id) => { try { cb(id); } catch { /* swallow */ } });
    }
  }, [updateEntries]);

  // 폴링 useEffect — 활성 엔트리가 1개 이상일 때만 인터벌 가동.
  useEffect(() => {
    const activeCount = Object.keys(entries).length;
    if (activeCount === 0) return undefined;

    pollOnce();
    const iv = setInterval(() => { pollOnce(); }, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [entries, pollOnce]);

  return { startRebuild, getProgress, isActive };
}
