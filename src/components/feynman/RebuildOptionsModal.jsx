/**
 * @fileoverview [지식 재구축] 옵션 모달 — 챕터 선택 + 합성 타겟 + 비용 미리보기.
 *
 * 사용자가 전체 wipe 비용을 피해 필요한 부분만 재구축할 수 있게 한다.
 *
 * 흐름:
 *  1. 모달 열림 → BE 의 챕터 목록 + 전체 비용 미리보기 GET
 *  2. 사용자가 체크박스/라디오 토글 → 300ms 디바운스 후 비용 다시 GET
 *  3. [재구축] → 부모의 onConfirm({chapters, targets}) 호출 → 부모가 rebuildKnowledge API + startRebuild 처리
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../common/Modal';
import { fetchTopics } from '../../services/feynmanApi';
import { fetchRebuildCostPreview } from '../../services/feynmanApi';

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {string} props.docId
 * @param {string} props.fileName
 * @param {(opts: {chapters: string[], targets: 'all'|'mindmap'|'questions'}) => void} props.onConfirm
 */
export default function RebuildOptionsModal({ isOpen, onClose, docId, fileName, onConfirm }) {
  const [topics, setTopics] = useState([]); // {chapter, chunkCount}
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [selected, setSelected] = useState(/** @type {Set<string>} */(new Set()));
  const [targets, setTargets] = useState(/** @type {'all'|'mindmap'|'questions'} */('all'));
  const [cost, setCost] = useState(null);
  const [costLoading, setCostLoading] = useState(false);
  const debounceRef = useRef(null);

  // 모달 열림 시 챕터 목록 로드 + 전체 선택 디폴트
  useEffect(() => {
    if (!isOpen || !docId) return;
    setLoadingTopics(true);
    fetchTopics(docId)
      .then((list) => {
        setTopics(list);
        // 기본: 전체 선택
        setSelected(new Set(list.map((t) => t.chapter)));
      })
      .catch(() => {
        setTopics([]);
        setSelected(new Set());
      })
      .finally(() => setLoadingTopics(false));
  }, [isOpen, docId]);

  // 선택 / 타겟 바뀌면 비용 미리보기 재요청 (300ms 디바운스)
  useEffect(() => {
    if (!isOpen || !docId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const chapters = Array.from(selected);
      if (chapters.length === 0) {
        setCost(null);
        return;
      }
      setCostLoading(true);
      try {
        const res = await fetchRebuildCostPreview(docId, { chapters, targets });
        setCost(res);
      } catch {
        setCost(null);
      } finally {
        setCostLoading(false);
      }
    }, 300);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [isOpen, docId, selected, targets]);

  const allSelected = useMemo(
    () => topics.length > 0 && selected.size === topics.length,
    [topics, selected],
  );

  const toggle = (chapter) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(chapter)) next.delete(chapter);
      else next.add(chapter);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === topics.length ? new Set() : new Set(topics.map((t) => t.chapter)),
    );
  };

  const canConfirm = selected.size > 0;
  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({ chapters: Array.from(selected), targets });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`지식 재구축 — ${fileName}`}>
      {/* 합성 타겟 라디오 */}
      <fieldset className="mb-4">
        <legend className="text-xs font-semibold text-text-primary mb-1.5">합성 대상</legend>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <input
              type="radio"
              name="targets"
              value="all"
              checked={targets === 'all'}
              onChange={() => setTargets('all')}
              className="mt-0.5"
            />
            <span className="flex-1">
              <span className="text-text-primary">전체 재구축</span>
              <span className="block text-text-tertiary">마인드맵·질문·답변 이력 모두 wipe 후 처음부터 다시 합성</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <input
              type="radio"
              name="targets"
              value="mindmap"
              checked={targets === 'mindmap'}
              onChange={() => setTargets('mindmap')}
              className="mt-0.5"
            />
            <span className="flex-1">
              <span className="text-text-primary">마인드맵만 (질문은 자동 재합성)</span>
              <span className="block text-text-tertiary">마인드맵 노드가 마음에 안 들 때. 질문은 새 마인드맵 기반으로 자동 생성</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <input
              type="radio"
              name="targets"
              value="questions"
              checked={targets === 'questions'}
              onChange={() => setTargets('questions')}
              className="mt-0.5"
            />
            <span className="flex-1">
              <span className="text-text-primary">질문만 (마인드맵 보존)</span>
              <span className="block text-text-tertiary">마인드맵은 유지하고 질문/모범답안만 새로 — 가장 저렴</span>
            </span>
          </label>
        </div>
      </fieldset>

      {/* 챕터 선택 */}
      <fieldset className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <legend className="text-xs font-semibold text-text-primary">대상 챕터</legend>
          <button
            type="button"
            onClick={toggleAll}
            disabled={loadingTopics || topics.length === 0}
            className="text-xs text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {allSelected ? '전체 해제' : '전체 선택'}
          </button>
        </div>
        {loadingTopics ? (
          <div className="text-xs text-text-tertiary py-3 text-center">챕터 목록 로드 중...</div>
        ) : topics.length === 0 ? (
          <div className="text-xs text-text-tertiary py-3 text-center">챕터를 가져오지 못했습니다.</div>
        ) : (
          <div className="max-h-[200px] overflow-y-auto border border-border-light rounded p-2 flex flex-col gap-1">
            {topics.map((t) => (
              <label key={t.chapter} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-bg-secondary px-1 py-0.5 rounded">
                <input
                  type="checkbox"
                  checked={selected.has(t.chapter)}
                  onChange={() => toggle(t.chapter)}
                />
                <span className="flex-1 truncate text-text-primary" title={t.chapter}>{t.chapter}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {/* 비용 미리보기 */}
      <div className="mb-4 px-3 py-2 rounded bg-bg-secondary/50 border border-border-light">
        <div className="text-xs font-semibold text-text-primary mb-1">예상 비용</div>
        {costLoading ? (
          <div className="text-xs text-text-tertiary">계산 중...</div>
        ) : cost ? (
          <div className="text-xs text-text-secondary leading-relaxed">
            · LLM 호출 <span className="font-semibold text-text-primary">{cost.totalLlmCalls}회</span>
            <br />· 예상 비용 <span className="font-semibold text-text-primary">${cost.totalUsd.toFixed(3)}</span>
            {' '}(약 ₩{cost.totalKrw.toLocaleString()})
            <br />
            <span className="text-text-tertiary">※ 휴리스틱 추정 — 실제 ±30% 가능</span>
          </div>
        ) : selected.size === 0 ? (
          <div className="text-xs text-text-tertiary">챕터를 1개 이상 선택하세요</div>
        ) : (
          <div className="text-xs text-text-tertiary">미리보기 실패</div>
        )}
      </div>

      {/* 하단 액션 */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="text-xs px-3 py-1.5 rounded text-text-secondary hover:bg-bg-secondary transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="text-xs px-3 py-1.5 rounded bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          재구축 ({selected.size} 챕터)
        </button>
      </div>
    </Modal>
  );
}
