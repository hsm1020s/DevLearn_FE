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
import { fetchRebuildProgress, cancelRebuild as cancelRebuildApi } from '../services/feynmanApi';

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
 * BE 응답으로 phase 산정 — 전체 모드 (expectedTotal 없음).
 */
function derivePhase({ totalChapters, mindmapsReady, questionsReady, complete }) {
  if (complete) return 'done';
  if (!totalChapters || totalChapters === 0) return 'wiping';
  if (mindmapsReady < totalChapters) return 'generating';
  if (questionsReady < totalChapters) return 'finalizing';
  return 'finalizing';
}

/**
 * 부분 재구축 phase 산정 — baseline + expectedTotal 기준 delta 계산.
 *
 * <p>BE 의 mindmapsReady / questionsReady 는 문서 전체 카운트라 부분 재구축에서
 * 의미 없음. rebuild 시작 시점의 baseline 을 빼서 "이번 재구축에서 새로 생성된 챕터 수"
 * 를 derived 한다. delta >= expectedTotal 이면 done.</p>
 */
function derivePartialPhase({ mindmapsReady, questionsReady,
                              baselineMindmaps, baselineQuestions, expectedTotal }) {
  // wipe 직후 baseline 보다 작아질 수 있으니 음수 보호.
  const mindmapDelta = Math.max(0, mindmapsReady - baselineMindmaps);
  const questionDelta = Math.max(0, questionsReady - baselineQuestions);
  if (mindmapDelta >= expectedTotal && questionDelta >= expectedTotal) return 'done';
  if (mindmapDelta < expectedTotal) return 'generating';
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

  /**
   * 새 재구축 엔트리 추가 — Pipeline 탭의 runRebuildKnowledge 가 호출.
   * @param {string} docId
   * @param {number} [expectedTotal] 부분 재구축에서 선택한 챕터 수. 진행률 기준 분모로 사용.
   *   생략하면 BE 응답의 totalChapters 를 기준 (= 전체 챕터).
   */
  const startRebuild = useCallback((docId, expectedTotal) => {
    if (!docId) return;
    const isPartial = expectedTotal && expectedTotal > 0;
    updateEntries((prev) => ({
      ...prev,
      [docId]: {
        docId,
        startedAt: Date.now(),
        totalChapters: isPartial ? expectedTotal : 0,
        mindmapsReady: 0,
        questionsReady: 0,
        phase: 'wiping',
        expectedTotal: isPartial ? expectedTotal : null,
        // 부분 재구축이면 첫 폴링 응답에서 baseline 캡처. null=아직 미캡처.
        baselineMindmaps: null,
        baselineQuestions: null,
      },
    }));
  }, [updateEntries]);

  const getProgress = useCallback((docId) => entries[docId] || null, [entries]);
  const isActive = useCallback((docId) => Boolean(entries[docId]), [entries]);

  /**
   * 진행 중 재구축 취소.
   * - localStorage entry 를 **즉시** 제거해 UI 표시를 바로 끈다 (BE 응답 대기 안 함).
   * - BE 에 cancel API 호출 (실패해도 사용자 표시는 이미 사라진 상태 — 다음 rebuild 시 wipe 로 자연 정리).
   */
  const cancel = useCallback(async (docId) => {
    if (!docId) return;
    updateEntries((prev) => {
      if (!prev[docId]) return prev;
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    try {
      await cancelRebuildApi(docId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[rebuild-progress] cancel API 실패 (표시는 이미 제거됨): docId=${docId}`, e);
    }
  }, [updateEntries]);

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
        const isPartial = entry.expectedTotal && entry.expectedTotal > 0;

        // 부분 재구축: 첫 응답에서 baseline 캡처. baseline 잡힌 후엔 delta 기반 진행.
        if (isPartial && entry.baselineMindmaps == null) {
          next[docId] = {
            ...entry,
            mindmapsReady: 0,
            questionsReady: 0,
            baselineMindmaps: mindmaps,
            baselineQuestions: questions,
            phase: 'generating',
          };
          return;
        }

        let phase;
        let displayMindmaps = mindmaps;
        let displayQuestions = questions;
        if (isPartial) {
          // delta = current - baseline (음수면 wipe 직후 — 0 으로 클램프).
          displayMindmaps = Math.max(0, mindmaps - entry.baselineMindmaps);
          displayQuestions = Math.max(0, questions - entry.baselineQuestions);
          phase = derivePartialPhase({
            mindmapsReady: mindmaps,
            questionsReady: questions,
            baselineMindmaps: entry.baselineMindmaps,
            baselineQuestions: entry.baselineQuestions,
            expectedTotal: entry.expectedTotal,
          });
        } else {
          phase = derivePhase({
            totalChapters: total,
            mindmapsReady: mindmaps,
            questionsReady: questions,
            complete,
          });
        }

        if (phase === 'done') {
          completedIds.push(docId);
          delete next[docId];
          return;
        }

        next[docId] = {
          ...entry,
          totalChapters: isPartial ? entry.expectedTotal : total,
          mindmapsReady: displayMindmaps,
          questionsReady: displayQuestions,
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

  return { startRebuild, getProgress, isActive, cancel };
}
