/**
 * @fileoverview 파인만 학습 챕터 선택 패널.
 * 파인만 칩 클릭 시 표시되며, 챕터를 선택하면 대화형 학습이 시작된다.
 */
import { useState, useEffect } from 'react';
import { BookOpen, Loader2, X } from 'lucide-react';
import { fetchTopics } from '../../services/feynmanApi';
import useStudyStore from '../../stores/useStudyStore';
import { showError } from '../../utils/errorHandler';

/** 하드코딩된 docId — 추후 문서 선택 UI로 대체 */
const DOC_ID = '04c45e4d-ae10-4486-9f17-139ad2016c2c';

/**
 * 챕터 선택 드롭다운 패널.
 * @param {object} props
 * @param {Function} props.onClose - 패널 닫기 콜백
 * @param {Function} props.onSelect - 챕터 선택 완료 콜백 (docId, chapter)
 */
export default function FeynmanChapterPicker({ onClose, onSelect }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTopics(DOC_ID)
      .then((data) => {
        if (!cancelled) {
          const sorted = [...data].sort((a, b) => {
            const numA = parseInt(a.chapter.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.chapter.match(/\d+/)?.[0] || '0');
            return numA - numB;
          });
          setTopics(sorted);
        }
      })
      .catch((err) => {
        if (!cancelled) showError(err, '챕터 목록을 불러올 수 없습니다');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSelect = (chapter) => {
    onSelect(DOC_ID, chapter);
  };

  return (
    <div className="absolute top-full left-0 right-0 z-30 mt-1 mx-4
      bg-bg-primary border border-border-light rounded-xl shadow-lg
      max-h-80 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <BookOpen size={16} className="text-primary" />
          학습할 챕터 선택
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-bg-secondary transition-colors text-text-tertiary"
        >
          <X size={14} />
        </button>
      </div>

      {/* 챕터 목록 */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-primary" />
          </div>
        ) : topics.length === 0 ? (
          <div className="text-center text-text-tertiary text-sm py-8">
            학습 가능한 챕터가 없습니다
          </div>
        ) : (
          <div className="space-y-1">
            {topics.map((t) => (
              <button
                key={t.chapter}
                onClick={() => handleSelect(t.chapter)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                  text-left text-sm hover:bg-bg-secondary transition-colors group"
              >
                <span className="text-text-primary group-hover:text-primary transition-colors">
                  {t.chapter}
                </span>
                <span className="text-xs text-text-tertiary">
                  {t.chunkCount}개 청크
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
