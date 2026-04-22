/**
 * @fileoverview 퀴즈 풀이 컴포넌트.
 * 문제를 하나씩 표시하고 채점 API로 정답/오답/해설을 제공한다.
 * 모의고사 타이머/일시정지/나가기 액션을 상단에 노출한다.
 * 완료 시 오답은 useStudyStore의 오답노트에 누적된다.
 */
import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Brain, Lightbulb, LogOut } from 'lucide-react';
import Button from '../common/Button';
import useStudyStore from '../../stores/useStudyStore';
import useMindmapStore from '../../stores/useMindmapStore';
import useAppStore from '../../stores/useAppStore';
import { submitAnswer as apiSubmitAnswer } from '../../services/studyApi';
import QuizTimer from './QuizTimer';

/** 퀴즈 풀이 화면. 문제 탐색, 답안 제출, 해설 확인, 마인드맵 연동, 타이머를 담당한다. */
export default function QuizPlayer() {
  // 활성 과목 기반 세션 필드
  const currentQuiz = useStudyStore((s) => s.subjects[s.activeSubject].currentQuiz);
  const index = useStudyStore((s) => s.subjects[s.activeSubject].currentQuestionIndex);
  const answers = useStudyStore((s) => s.subjects[s.activeSubject].answers);
  const quizPaused = useStudyStore((s) => s.subjects[s.activeSubject].quizPaused);
  const activeSubject = useStudyStore((s) => s.activeSubject);
  const setQuestionIndex = useStudyStore((s) => s.setQuestionIndex);
  const submitAnswer = useStudyStore((s) => s.submitAnswer);
  const setStudyStep = useStudyStore((s) => s.setStudyStep);
  const resetQuiz = useStudyStore((s) => s.resetQuiz);
  const addWrongAnswersFromSession = useStudyStore((s) => s.addWrongAnswersFromSession);
  const setQuizPaused = useStudyStore((s) => s.setQuizPaused);

  const addNode = useMindmapStore((s) => s.addNode);
  const activeMapId = useMindmapStore((s) => s.activeMapId);
  const createMap = useMindmapStore((s) => s.createMap);
  const isMindmapOn = useAppStore((s) => s.isMindmapOn);
  const toggleMindmap = useAppStore((s) => s.toggleMindmap);

  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  // 나가기 확인 팝오버
  const [confirmExit, setConfirmExit] = useState(false);

  const questions = currentQuiz?.questions || [];
  const question = questions[index];

  // 문제 이동 시 이전 결과를 복원
  useEffect(() => {
    const prev = answers[question?.id];
    if (prev) {
      setSelected(prev.selected);
      setResult(prev);
    } else {
      setSelected(null);
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, question?.id]);

  // 타이머 만료 시 자동으로 결과 화면 전환
  const handleTimerExpire = useCallback(() => {
    if (!currentQuiz) return;
    addWrongAnswersFromSession({ quiz: currentQuiz, answers });
    setStudyStep('result');
  }, [currentQuiz, answers, addWrongAnswersFromSession, setStudyStep]);

  // 현재 문제를 마인드맵 노드로 추가
  const handleAddToMindmap = useCallback(() => {
    if (!question) return;
    if (!activeMapId) createMap('study');
    const label = question.question.length > 40
      ? question.question.slice(0, 40) + '...'
      : question.question;
    addNode(null, label);
    if (!isMindmapOn) toggleMindmap();
  }, [question, addNode, activeMapId, createMap, isMindmapOn, toggleMindmap]);

  const total = questions.length;
  const answered = answers[question?.id];
  const isAnswered = answered !== undefined || result !== null;

  // 선택지 클릭 시 채점 API 호출 후 결과를 스토어에 저장
  const handleSelect = async (optIdx) => {
    if (isAnswered || loading || quizPaused) return;
    setSelected(optIdx);
    setLoading(true);
    try {
      const res = await apiSubmitAnswer({
        subject: activeSubject,
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

  // 문제 이동. 마지막 문제 다음이면 오답 누적 + 결과 화면
  const goTo = (nextIdx) => {
    if (nextIdx >= total) {
      addWrongAnswersFromSession({ quiz: currentQuiz, answers });
      setStudyStep('result');
      return;
    }
    setQuestionIndex(nextIdx);
  };

  // 나가기 확정 — 진행중인 답안은 유지한 채 세션 종료 (미제출 오답은 누적 안 함)
  const handleExit = () => {
    setConfirmExit(false);
    resetQuiz();
  };

  const optionClass = (optIdx) => {
    const base = 'flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-colors cursor-pointer';
    if (!isAnswered) {
      return selected === optIdx
        ? `${base} border-primary bg-primary/5 text-text-primary`
        : `${base} border-border-light hover:border-primary/50 text-text-primary`;
    }
    const correct = result?.correctAnswer ?? answered?.correctAnswer;
    if (optIdx === correct) return `${base} border-success bg-success/10 text-success`;
    if (optIdx === (result?.selected ?? selected) && optIdx !== correct) {
      return `${base} border-danger bg-danger/10 text-danger`;
    }
    return `${base} border-border-light text-text-tertiary`;
  };

  if (!question) return null;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full relative">
      {/* 상단 액션 바: 타이머 + 나가기 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <span>
            문제 <strong className="text-text-primary">{index + 1}</strong>/{total}
          </span>
          <QuizTimer onExpire={handleTimerExpire} />
        </div>
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={() => setConfirmExit(true)}>
            <LogOut className="w-4 h-4" />
            나가기
          </Button>
          {confirmExit && (
            <div
              className="absolute right-0 top-full mt-2 z-50 bg-bg-primary border border-border-light
                         rounded-lg shadow-lg p-3 min-w-[200px] animate-popover-in"
            >
              <p className="text-xs text-text-primary mb-2.5">
                세션을 종료할까요?<br />진행 내용은 저장되지 않습니다.
              </p>
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => setConfirmExit(false)}
                  className="text-xs px-2.5 py-1 rounded text-text-secondary hover:bg-bg-secondary transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleExit}
                  className="text-xs px-2.5 py-1 rounded bg-danger text-white hover:bg-danger/90 transition-colors"
                >
                  종료
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="h-1 rounded bg-bg-secondary">
        <div
          className="h-full rounded bg-primary transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {/* 일시정지 배너 */}
      {quizPaused && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
          <span className="text-text-primary">⏸ 일시정지 상태입니다. 재개하려면 타이머 옆 ▶ 버튼을 누르세요.</span>
          <button
            onClick={() => setQuizPaused(false)}
            className="text-xs font-medium text-primary hover:underline"
          >
            바로 재개
          </button>
        </div>
      )}

      {/* Question */}
      <p className="text-base font-medium text-text-primary leading-relaxed">
        {question.question}
      </p>

      {/* Options */}
      <div className={`flex flex-col gap-2 ${quizPaused ? 'pointer-events-none opacity-60' : ''}`}>
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
        <Button variant="ghost" disabled={index === 0} onClick={() => goTo(index - 1)}>
          <ChevronLeft className="w-4 h-4" />
          이전
        </Button>
        <Button disabled={!isAnswered} onClick={() => goTo(index + 1)}>
          {index + 1 < total ? '다음' : '결과 보기'}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
