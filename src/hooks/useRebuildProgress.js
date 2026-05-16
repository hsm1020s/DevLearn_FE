/**
 * @fileoverview 파인만 [지식 재구축] 액션의 진행 상태를 관리하는 훅.
 *
 * 직전 태스크 `feynman-rebuild-mindmaps` 가 만든 백그라운드 작업(마인드맵 wipe → 재합성 → chapter_questions hook)
 * 의 진행률을 사용자에게 시각화한다. 핵심 데이터 소스는 기존 `GET /api/feynman/mindmap/chapters/{docId}` —
 * 챕터별 status (`completed | generating | pending | not_generated`) 를 폴링해서 m/N 진행률을 계산한다.
 *
 * 책임:
 *  - 활성 재구축 docId 들의 진행 엔트리를 단일 진실의 출처(Map)로 보관
 *  - 3초 간격 폴링 (활성 엔트리가 1개 이상일 때만)
 *  - localStorage 영속화 — F5/탭 전환에도 진행 추적 유지
 *  - 마인드맵 100% 도달 시 5초 grace(질문 합성 hook 대기) 후 완료 처리 → onComplete 콜백
 *  - 30분 stale 가드(작업 실패/페이지 닫힘 등 비정상 종료 보호)
 *
 * 본 훅은 어디서든 호출 가능하지만 폴링 사이클은 컴포넌트 인스턴스별로 독립적이다.
 * `FeynmanPipelineTab` 1곳에서만 활성으로 쓰는 것을 전제로 한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchChapterStatuses } from '../services/feynmanApi';

/** localStorage 키 — 활성 재구축 엔트리 영속화 */
const LS_KEY = 'feynman.rebuild.active.v1';
/** 폴링 주기(ms) */
const POLL_INTERVAL_MS = 3000;
/** 마인드맵 100% 도달 후 질문 합성 hook 대기용 grace(ms) */
const FINALIZE_GRACE_MS = 5000;
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
 * @param {object} [opts]
 * @param {(docId: string) => void} [opts.onComplete] — 한 문서의 재구축이 done 상태로 전이할 때 1회 호출
 */
export default function useRebuildProgress({ onComplete } = {}) {
  // entries: { [docId]: { docId, startedAt, mindmapsReady, totalChapters, phase } }
  const [entries, setEntries] = useState(() => loadFromStorage());
  const onCompleteRef = useRef(onComplete);
  // 폴링 useEffect 가 항상 최신 콜백을 참조하도록 ref 로 별도 보관.
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // 엔트리 갱신 헬퍼 — setState + localStorage 동기 저장.
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
        mindmapsReady: 0,
        totalChapters: 0,
        phase: 'wiping',
      },
    }));
  }, [updateEntries]);

  const getProgress = useCallback((docId) => entries[docId] || null, [entries]);
  const isActive = useCallback((docId) => Boolean(entries[docId]), [entries]);

  // 단일 폴링 사이클 — 활성 엔트리들에 대해 챕터 상태를 조회하고 phase 를 갱신.
  // 이 함수는 useEffect 안에서만 호출되며, 클로저로 항상 최신 entries 를 보지 못하므로
  // setEntries 의 함수형 업데이트로 안전하게 수정한다.
  const pollOnce = useCallback(async () => {
    // 현재 활성 docId 목록은 effect 가 진입 시점 entries 를 캡처하므로 별도 인자 없이
    // 함수형 setEntries 내부에서 결정.
    const snapshot = await new Promise((resolve) => {
      setEntries((curr) => {
        resolve(curr);
        return curr;
      });
    });

    const activeIds = Object.keys(snapshot);
    if (activeIds.length === 0) return;

    // 각 docId 에 대해 챕터 상태 조회 — 실패는 silent skip.
    const results = await Promise.allSettled(
      activeIds.map((id) => fetchChapterStatuses(id))
    );

    updateEntries((prev) => {
      const next = { ...prev };
      const now = Date.now();
      const justDone = [];

      activeIds.forEach((docId, i) => {
        const entry = next[docId];
        if (!entry) return;

        // stale 가드 — 너무 오래된 엔트리는 강제 제거.
        if (now - entry.startedAt > STALE_TIMEOUT_MS) {
          // eslint-disable-next-line no-console
          console.warn(`[rebuild-progress] stale entry purged: docId=${docId}`);
          delete next[docId];
          return;
        }

        const res = results[i];
        if (res.status !== 'fulfilled') return; // 폴링 실패 — 다음 cycle 재시도

        const chapters = Array.isArray(res.value) ? res.value : [];
        const total = chapters.length;
        const ready = chapters.filter((c) => c?.status === 'completed').length;

        // totalChapters 가 첫 응답으로 결정되기 전에는 wiping 유지.
        if (total === 0) {
          next[docId] = { ...entry, phase: 'wiping' };
          return;
        }

        // finalizing 진입한 엔트리는 별도 타이머가 done 처리.
        if (entry.phase === 'finalizing' || entry.phase === 'done') {
          next[docId] = { ...entry, mindmapsReady: ready, totalChapters: total };
          return;
        }

        // 100% 도달 → finalizing 으로 전이. 5초 후 별도 setTimeout 이 done 처리.
        if (ready >= total) {
          next[docId] = {
            ...entry,
            mindmapsReady: ready,
            totalChapters: total,
            phase: 'finalizing',
            finalizingAt: now,
          };
          // grace 만료 시 done 처리는 아래 useEffect 에서.
          return;
        }

        next[docId] = {
          ...entry,
          mindmapsReady: ready,
          totalChapters: total,
          phase: 'generating',
        };
        void justDone;
      });

      return next;
    });
  }, [updateEntries]);

  // 폴링 useEffect — 활성 엔트리가 1개 이상일 때만 인터벌 가동.
  useEffect(() => {
    const activeCount = Object.keys(entries).length;
    if (activeCount === 0) return undefined;

    // 즉시 1회 + 이후 주기.
    pollOnce();
    const iv = setInterval(() => { pollOnce(); }, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [entries, pollOnce]);

  // finalizing → done 전이 타이머. finalizingAt + grace 시점에 done 처리 + 엔트리 제거.
  useEffect(() => {
    const finalizing = Object.values(entries).filter((e) => e.phase === 'finalizing');
    if (finalizing.length === 0) return undefined;

    const now = Date.now();
    const timers = finalizing.map((e) => {
      const remaining = Math.max(0, e.startedAt && e.finalizingAt
        ? e.finalizingAt + FINALIZE_GRACE_MS - now
        : FINALIZE_GRACE_MS);
      return setTimeout(() => {
        const cb = onCompleteRef.current;
        updateEntries((prev) => {
          if (!prev[e.docId]) return prev;
          const next = { ...prev };
          delete next[e.docId];
          return next;
        });
        if (cb) {
          try { cb(e.docId); } catch { /* swallow */ }
        }
      }, remaining);
    });
    return () => timers.forEach(clearTimeout);
  }, [entries, updateEntries]);

  return { startRebuild, getProgress, isActive };
}
