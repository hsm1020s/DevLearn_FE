/**
 * @fileoverview 오답노트 패널 (그룹 C #6, #16 액티브 리콜).
 * useStudyStore.wrongAnswers에 쌓인 오답을 카드로 렌더링하고,
 * "다시 풀기" 클릭 시 quizSeed를 설정하여 퀴즈 탭의 새 세션을 트리거한다.
 * "변형 출제"는 동일 난이도/유형으로 새 세션을 바로 시작한다.
 */
import { useMemo, useState } from 'react';
import { RefreshCw, Shuffle, Trash2, FileText } from 'lucide-react';
import Button from '../common/Button';
import useStudyStore from '../../stores/useStudyStore';
import useAppStore from '../../stores/useAppStore';
import { STATS_DIFFICULTY_LABELS, STATS_TYPE_LABELS } from '../../utils/constants';

/** 오답노트 탭 — 카드 리스트 + 다시 풀기 / 변형 출제 / 랜덤 5문항 인출 연습. */
export default function WrongAnswerPanel() {
  const wrongAnswers = useStudyStore((s) => s.wrongAnswers);
  const removeWrongAnswer = useStudyStore((s) => s.removeWrongAnswer);
  const setQuizSeed = useStudyStore((s) => s.setQuizSeed);
  const resetQuiz = useStudyStore((s) => s.resetQuiz);
  const setStudySubTab = useAppStore((s) => s.setStudySubTab);

  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return wrongAnswers;
    return wrongAnswers.filter((w) => w.difficulty === filter);
  }, [wrongAnswers, filter]);

  // 다시 풀기 — 해당 문제를 seed로 퀴즈 탭으로 이동
  const handleRetry = (item) => {
    resetQuiz();
    setQuizSeed(item);
    setStudySubTab('quiz');
  };

  // 랜덤 5문항 인출 연습 — 무작위 1건을 seed로 사용 (백엔드 연결 전 간이 구현)
  const handleActiveRecall = () => {
    if (wrongAnswers.length === 0) return;
    const pick = wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)];
    handleRetry(pick);
  };

  if (wrongAnswers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <FileText size={32} className="text-text-tertiary" />
        <p className="text-sm text-text-secondary">아직 오답노트가 비어있습니다</p>
        <p className="text-xs text-text-tertiary">퀴즈를 풀고 오답이 생기면 자동으로 여기에 쌓입니다</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 상단 액션 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">난이도</span>
          {['all', 'easy', 'mixed', 'hard'].map((d) => {
            const label = d === 'all' ? '전체' : STATS_DIFFICULTY_LABELS[d];
            const active = filter === d;
            return (
              <button
                key={d}
                onClick={() => setFilter(d)}
                className={`
                  px-2.5 py-1 rounded-full text-xs transition-colors
                  ${active
                    ? 'bg-primary text-white'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'}
                `}
              >
                {label}
              </button>
            );
          })}
        </div>
        <Button variant="secondary" size="sm" onClick={handleActiveRecall}>
          <Shuffle className="w-4 h-4" />
          🎲 인출 연습
        </Button>
      </div>

      {/* 카드 리스트 */}
      <div className="flex flex-col gap-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 p-4 rounded-lg border border-border-light bg-bg-primary hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-text-primary leading-relaxed flex-1">
                {item.question}
              </p>
              <button
                onClick={() => removeWrongAnswer(item.id)}
                title="오답노트에서 제거"
                className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* 선택지 — 정답/오답 하이라이트 */}
            <div className="flex flex-col gap-1.5">
              {item.options.map((opt, i) => {
                const isCorrect = i === item.correctAnswer;
                const isUser = i === item.userAnswer;
                let cls = 'text-text-secondary';
                let prefix = `${i + 1}. `;
                if (isCorrect) { cls = 'text-success font-medium'; prefix = `✓ ${i + 1}. `; }
                else if (isUser) { cls = 'text-danger line-through'; prefix = `✗ ${i + 1}. `; }
                return (
                  <div key={i} className={`text-xs ${cls}`}>
                    {prefix}{opt}
                  </div>
                );
              })}
            </div>

            {/* 해설 */}
            {item.explanation && (
              <p className="text-xs text-text-secondary leading-relaxed p-2 rounded bg-bg-secondary">
                💡 {item.explanation}
              </p>
            )}

            {/* 메타 + 액션 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
                <span className="px-1.5 py-0.5 rounded bg-bg-secondary">
                  {STATS_DIFFICULTY_LABELS[item.difficulty] || '혼합'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-bg-secondary">
                  {STATS_TYPE_LABELS[item.type] || '4지선다'}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleRetry(item)}>
                <RefreshCw className="w-3.5 h-3.5" />
                🔁 다시 풀기
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
