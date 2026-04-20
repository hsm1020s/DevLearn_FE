/**
 * @fileoverview 출처 청크 원문 표시 모달.
 * SourcePanel에서 카드 클릭 시 열리며, getSource API로 원문 텍스트와 하이라이트 범위를 조회한다.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../common/Modal';
import { getSource } from '../../services/ragApi';
import { showError } from '../../utils/errorHandler';

/**
 * 청크 원문 모달
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {Function} onClose - 모달 닫기 콜백
 * @param {string} [chunkId] - 조회할 청크 ID
 * @param {string} [docName] - 상단 표시용 문서명
 * @param {number} [page] - 상단 표시용 페이지 번호
 */
export default function SourceChunkModal({ isOpen, onClose, chunkId, docName, page }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 모달이 닫혀 있거나 chunkId가 없으면 아무것도 하지 않음
    if (!isOpen || !chunkId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setData(null);
    (async () => {
      try {
        const res = await getSource(chunkId);
        if (cancelled) return;
        setData(res);
      } catch (err) {
        if (cancelled) return;
        showError(err, '원문을 불러오지 못했습니다');
        onClose?.();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, chunkId, onClose]);

  // highlightRange가 있으면 본문을 3분할하여 하이라이트 적용
  const renderBody = () => {
    if (!data) return null;
    const text = data.fullText ?? '';
    const range = data.highlightRange;
    if (!range || !Array.isArray(range) || range.length !== 2) {
      return <p className="whitespace-pre-wrap text-sm text-text-primary leading-relaxed">{text}</p>;
    }
    const [start, end] = range;
    const before = text.slice(0, start);
    const highlight = text.slice(start, end);
    const after = text.slice(end);
    return (
      <p className="whitespace-pre-wrap text-sm text-text-primary leading-relaxed">
        {before}
        <span className="bg-primary/10 rounded px-0.5">{highlight}</span>
        {after}
      </p>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="출처 원문">
      <div className="flex flex-col gap-3 min-h-[160px]">
        {/* 헤더: 문서명 / 페이지 */}
        {(docName || page != null) && (
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            {docName && <span className="truncate">{docName}</span>}
            {page != null && <span>· page {page}</span>}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          renderBody()
        )}
      </div>
    </Modal>
  );
}
