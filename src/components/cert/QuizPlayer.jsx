import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Brain, Lightbulb } from 'lucide-react';
import Button from '../common/Button';
import useCertStore from '../../stores/useCertStore';
import useMindmapStore from '../../stores/useMindmapStore';
import useAppStore from '../../stores/useAppStore';
import { submitAnswer as apiSubmitAnswer } from '../../services/certApi';

export default function QuizPlayer() {
  const currentQuiz = useCertStore((s) => s.currentQuiz);
  const index = useCertStore((s) => s.currentQuestionIndex);
  const answers = useCertStore((s) => s.answers);
  const setQuestionIndex = useCertStore((s) => s.setQuestionIndex);
  const submitAnswer = useCertStore((s) => s.submitAnswer);
  const setCertStep = useCertStore((s) => s.setCertStep);

  const addNode = useMindmapStore((s) => s.addNode);
  const isMindmapOn = useAppStore((s) => s.isMindmapOn);
  const toggleMindmap = useAppStore((s) => s.toggleMindmap);

  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAddToMindmap = useCallback(() => {
    if (!question) return;
    const label = question.question.length > 40
      ? question.question.slice(0, 40) + '...'
      : question.question;
    addNode(null, label);
    if (!isMindmapOn) toggleMindmap();
  }, [question, addNode, isMindmapOn, toggleMindmap]);

  const questions = currentQuiz?.questions || [];
  const question = questions[index];
  const total = questions.length;
  const answered = answers[question?.id];
  const isAnswered = answered !== undefined || result !== null;

  const handleSelect = async (optIdx) => {
    if (isAnswered || loading) return;
    setSelected(optIdx);
    setLoading(true);
    try {
      const res = await apiSubmitAnswer({
        quizId: currentQuiz.quizId,
        questionId: question.id,
        userAnswer: optIdx,
      });
      setResult(res);
      submitAnswer(question.id, { selected: optIdx, ...res });
    } finally {
      setLoading(false);
    }
  };

  const goTo = (nextIdx) => {
    if (nextIdx >= total) {
      setCertStep('result');
      return;
    }
    setQuestionIndex(nextIdx);
    const prev = answers[questions[nextIdx]?.id];
    if (prev) {
      setSelected(prev.selected);
      setResult(prev);
    } else {
      setSelected(null);
      setResult(null);
    }
  };

  const optionClass = (optIdx) => {
    const base = 'flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-colors cursor-pointer';
    if (!isAnswered) {
      return selected === optIdx
        ? `${base} border-primary bg-primary/5 text-text-primary`
        : `${base} border-border-light hover:border-primary/50 text-text-primary`;
    }
    const correct = result?.correctAnswer ?? answered?.correctAnswer;
    if (optIdx === correct) return `${base} border-green-500 bg-green-50 text-green-800`;
    if (optIdx === (result?.selected ?? selected) && optIdx !== correct) {
      return `${base} border-red-500 bg-red-50 text-red-800`;
    }
    return `${base} border-border-light text-text-tertiary`;
  };

  if (!question) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-text-secondary">
        <span>
          문제 <strong className="text-text-primary">{index + 1}</strong>/{total}
        </span>
        <span className="truncate ml-4">{currentQuiz.quizId}</span>
      </div>
      <div className="h-1 rounded bg-bg-secondary">
        <div
          className="h-full rounded bg-primary transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {/* Question */}
      <p className="text-base font-medium text-text-primary leading-relaxed">
        {question.question}
      </p>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {question.options.map((opt, i) => (
          <div key={i} className={optionClass(i)} onClick={() => handleSelect(i)}>
            <span className="w-6 h-6 flex items-center justify-center rounded-full bg-bg-tertiary text-xs font-medium shrink-0">
              {i + 1}
            </span>
            <span>{opt}</span>
          </div>
        ))}
      </div>

      {/* Explanation */}
      {isAnswered && (
        <div className="flex flex-col gap-3 p-4 rounded-lg bg-bg-secondary border border-border-light">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Lightbulb className="w-4 h-4 text-warning" />
            해설
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            {result?.explanation ?? answered?.explanation}
          </p>
          <Button variant="ghost" size="sm" className="self-start" onClick={handleAddToMindmap}>
            <Brain className="w-4 h-4" />
            마인드맵에 추가
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="ghost"
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
          이전
        </Button>
        <Button
          disabled={!isAnswered}
          onClick={() => goTo(index + 1)}
        >
          {index + 1 < total ? '다음' : '결과 보기'}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
