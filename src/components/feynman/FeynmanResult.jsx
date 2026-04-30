/**
 * @fileoverview 파인만 검증 결과 표시 컴포넌트.
 * 점수 게이지, AI 피드백(마크다운), 참조 원본 청크를 표시한다.
 */
import { RotateCcw, ChevronLeft, FileText } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

/**
 * 점수에 따른 색상 클래스를 반환한다.
 * @param {number} score 0~100
 */
function getScoreColor(score) {
  if (score >= 80) return 'text-success';
  if (score >= 50) return 'text-warning';
  return 'text-danger';
}

/**
 * 점수에 따른 등급 텍스트를 반환한다.
 * @param {number} score 0~100
 */
function getScoreGrade(score) {
  if (score >= 90) return '훌륭합니다!';
  if (score >= 70) return '잘 이해하고 있어요';
  if (score >= 50) return '보완이 필요해요';
  return '다시 학습해보세요';
}

/**
 * @param {Object} props
 * @param {{score: number, feedback: string, sources: Array}} props.result
 * @param {Function} props.onRetry - 다시 시도 콜백
 * @param {Function} props.onBack - 챕터 선택으로 돌아가기 콜백
 */
export default function FeynmanResult({ result, onRetry, onBack }) {
  const [showSources, setShowSources] = useState(false);
  const { score, feedback, sources } = result;

  return (
    <div className="p-6 max-w-3xl mx-auto w-full space-y-6">
      {/* 점수 카드 */}
      <div className="text-center p-6 rounded-xl bg-bg-secondary border border-border-light">
        <div className={`text-5xl font-bold ${getScoreColor(score)}`}>
          {score}
        </div>
        <div className="text-sm text-text-secondary mt-1">/ 100</div>
        <div className={`text-sm font-medium mt-2 ${getScoreColor(score)}`}>
          {getScoreGrade(score)}
        </div>
      </div>

      {/* AI 피드백 */}
      <div className="rounded-lg border border-border-light bg-bg-primary p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">AI 피드백</h3>
        <div className="prose prose-sm max-w-none text-text-primary
          prose-headings:text-text-primary prose-headings:text-sm prose-headings:font-semibold
          prose-li:text-text-secondary prose-p:text-text-secondary
          prose-strong:text-text-primary">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{feedback}</ReactMarkdown>
        </div>
      </div>

      {/* 참조 원본 */}
      {sources && sources.length > 0 && (
        <div className="rounded-lg border border-border-light bg-bg-primary">
          <button
            onClick={() => setShowSources(!showSources)}
            className="w-full flex items-center justify-between p-4 text-sm
              text-text-secondary hover:text-text-primary transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileText size={14} />
              참조된 원본 텍스트 ({sources.length}개)
            </span>
            <span className="text-xs">{showSources ? '접기' : '펼치기'}</span>
          </button>
          {showSources && (
            <div className="border-t border-border-light p-4 space-y-3">
              {sources.map((src, i) => (
                <div key={i} className="text-xs bg-bg-secondary rounded-md p-3">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-bg-tertiary
                    text-text-tertiary font-mono mb-1.5">
                    p.{src.page}
                  </span>
                  <p className="text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {src.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-3 justify-center pt-2">
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-5 py-2 rounded-md text-sm
            border border-border-light text-text-secondary
            hover:bg-bg-secondary transition-colors"
        >
          <RotateCcw size={14} />
          다시 설명하기
        </button>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-5 py-2 rounded-md text-sm
            border border-border-light text-text-secondary
            hover:bg-bg-secondary transition-colors"
        >
          <ChevronLeft size={14} />
          다른 챕터
        </button>
      </div>
    </div>
  );
}
