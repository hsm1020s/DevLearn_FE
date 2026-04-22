/**
 * @fileoverview 파인만 학습 문서·챕터 2단계 선택 패널.
 * 1단계: 임베딩 완료된 문서(책) 목록에서 하나 선택
 * 2단계: 선택한 문서의 챕터 목록에서 학습할 챕터 선택
 */
import { useState, useEffect } from 'react';
import { BookOpen, ChevronLeft, Loader2, X, FileText } from 'lucide-react';
import { fetchDocs, fetchTopics } from '../../services/feynmanApi';
import { showError } from '../../utils/errorHandler';

/**
 * 2단계 선택 패널.
 * @param {object} props
 * @param {Function} props.onClose - 패널 닫기 콜백
 * @param {Function} props.onSelect - 챕터 선택 완료 콜백 (docId, chapter)
 */
export default function FeynmanChapterPicker({ onClose, onSelect }) {
  // 1단계: 문서 목록
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);

  // 2단계: 선택된 문서 + 챕터 목록
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  // 1단계: 문서 목록 로드
  useEffect(() => {
    let cancelled = false;
    setDocsLoading(true);
    fetchDocs()
      .then((data) => {
        if (!cancelled) setDocs(data || []);
      })
      .catch((err) => {
        if (!cancelled) showError(err, '문서 목록을 불러올 수 없습니다');
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 2단계: 문서 선택 시 챕터 로드
  const handleDocSelect = (doc) => {
    setSelectedDoc(doc);
    setTopicsLoading(true);
    fetchTopics(doc.id)
      .then((data) => {
        const sorted = [...data].sort((a, b) => {
          const numA = parseInt(a.chapter.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.chapter.match(/\d+/)?.[0] || '0');
          return numA - numB;
        });
        setTopics(sorted);
      })
      .catch((err) => showError(err, '챕터 목록을 불러올 수 없습니다'))
      .finally(() => setTopicsLoading(false));
  };

  const handleBack = () => {
    setSelectedDoc(null);
    setTopics([]);
  };

  return (
    <div className="absolute top-full left-0 right-0 z-30 mt-1 mx-4
      bg-bg-primary border border-border-light rounded-xl shadow-lg
      max-h-80 overflow-hidden flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          {selectedDoc ? (
            <>
              <button
                onClick={handleBack}
                className="p-0.5 rounded hover:bg-bg-secondary transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <FileText size={16} className="text-primary" />
              <span className="truncate max-w-[200px]">{selectedDoc.fileName}</span>
            </>
          ) : (
            <>
              <BookOpen size={16} className="text-primary" />
              학습할 문서 선택
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-bg-secondary transition-colors text-text-tertiary"
        >
          <X size={14} />
        </button>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-2">
        {!selectedDoc ? (
          // ── 1단계: 문서 선택 ──
          docsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center text-text-tertiary text-sm py-8">
              학습 가능한 문서가 없습니다.<br />
              PDF를 업로드하고 임베딩을 완료해주세요.
            </div>
          ) : (
            <div className="space-y-1">
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
                  <ChevronLeft size={14} className="text-text-tertiary rotate-180 shrink-0" />
                </button>
              ))}
            </div>
          )
        ) : (
          // ── 2단계: 챕터 선택 ──
          topicsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center text-text-tertiary text-sm py-8">
              챕터가 없습니다
            </div>
          ) : (
            <div className="space-y-1">
              {topics.map((t) => (
                <button
                  key={t.chapter}
                  onClick={() => onSelect(selectedDoc.id, t.chapter)}
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
          )
        )}
      </div>
    </div>
  );
}
