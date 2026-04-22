/**
 * @fileoverview 파인만 학습 워크스페이스.
 *
 * 3단계 흐름:
 * 1. 챕터 선택 — fetchTopics()로 챕터 목록 로드, 하나 선택
 * 2. 설명 작성 — 텍스트 영역에 개념을 자신의 말로 설명
 * 3. 검증 결과 — verifyExplanation()으로 RAG 검증, 점수+피드백 표시
 */
import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Send, RotateCcw, ChevronLeft, Loader2 } from 'lucide-react';
import { fetchTopics, verifyExplanation } from '../../services/feynmanApi';
import useAppStore from '../../stores/useAppStore';
import { showError } from '../../utils/errorHandler';
import FeynmanResult from './FeynmanResult';

/** 하드코딩된 docId — 추후 문서 선택 UI로 대체 */
const DOC_ID = '04c45e4d-ae10-4486-9f17-139ad2016c2c';

export default function FeynmanWorkspace() {
  const selectedLLM = useAppStore((s) => s.selectedLLM);

  // 상태
  const [topics, setTopics] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [explanation, setExplanation] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [topicsLoading, setTopicsLoading] = useState(true);

  // 챕터 목록 로드
  useEffect(() => {
    let cancelled = false;
    setTopicsLoading(true);
    fetchTopics(DOC_ID)
      .then((data) => {
        if (!cancelled) {
          // 챕터 번호 기준 정렬
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
        if (!cancelled) setTopicsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 검증 제출
  const handleSubmit = useCallback(async () => {
    if (!selectedChapter || !explanation.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await verifyExplanation({
        docId: DOC_ID,
        chapter: selectedChapter,
        explanation: explanation.trim(),
        llm: selectedLLM,
      });
      setResult(res);
    } catch (err) {
      showError(err, '검증에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [selectedChapter, explanation, selectedLLM]);

  // 다시 시도
  const handleReset = useCallback(() => {
    setResult(null);
    setExplanation('');
  }, []);

  // 챕터 선택 화면으로 돌아가기
  const handleBack = useCallback(() => {
    setSelectedChapter(null);
    setResult(null);
    setExplanation('');
  }, []);

  // === 챕터 선택 화면 ===
  if (!selectedChapter) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border-light">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <BookOpen size={20} />
            파인만 학습 — 주제 선택
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            학습할 챕터를 선택하세요. 선택한 챕터의 개념을 자신의 말로 설명하면 AI가 검증해줍니다.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {topicsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center text-text-tertiary py-12">
              학습 가능한 챕터가 없습니다. PDF를 먼저 업로드해주세요.
            </div>
          ) : (
            <div className="grid gap-2 max-w-2xl mx-auto">
              {topics.map((t) => (
                <button
                  key={t.chapter}
                  onClick={() => setSelectedChapter(t.chapter)}
                  className="flex items-center justify-between p-4 rounded-lg border border-border-light
                    bg-bg-primary hover:bg-bg-secondary hover:border-primary
                    transition-all text-left group"
                >
                  <span className="text-sm font-medium text-text-primary group-hover:text-primary">
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

  // === 결과 화면 ===
  if (result) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border-light flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-1.5 rounded-md hover:bg-bg-secondary transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">{selectedChapter}</h2>
            <p className="text-xs text-text-secondary">검증 결과</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <FeynmanResult result={result} onRetry={handleReset} onBack={handleBack} />
        </div>
      </div>
    );
  }

  // === 설명 작성 화면 ===
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border-light flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-1.5 rounded-md hover:bg-bg-secondary transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{selectedChapter}</h2>
          <p className="text-xs text-text-secondary">이 챕터의 핵심 개념을 자신의 말로 설명해보세요</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 gap-4 max-w-3xl mx-auto w-full">
        <div className="flex-1 flex flex-col">
          <label className="text-sm font-medium text-text-primary mb-2">
            나의 설명
          </label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="이 챕터에서 배운 핵심 개념을 마치 5살 아이에게 설명하듯 적어보세요..."
            className="flex-1 min-h-[200px] p-4 rounded-lg border border-border-light
              bg-bg-primary text-text-primary text-sm leading-relaxed
              placeholder:text-text-tertiary resize-none
              focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            disabled={loading}
          />
          <div className="text-xs text-text-tertiary mt-1 text-right">
            {explanation.length}자
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm
              text-text-secondary hover:bg-bg-secondary transition-colors"
          >
            <RotateCcw size={14} />
            초기화
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !explanation.trim()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-md text-sm font-medium
              bg-primary text-white hover:bg-primary-hover
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                검증 중...
              </>
            ) : (
              <>
                <Send size={14} />
                검증하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
