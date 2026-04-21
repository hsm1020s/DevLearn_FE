/**
 * @fileoverview 학습 워크스페이스 — 퀴즈 탭.
 * studyStep에 따라 QuizSettings / QuizPlayer / 결과 화면을 분기 렌더.
 * 탭에서 떠나면 자동 일시정지, 돌아오면 사용자가 수동 재개.
 * 오답노트의 "다시 풀기"가 quizSeed를 set하면 seed 기반으로 새 세션 자동 생성.
 */
import { useEffect } from 'react';
import { Trophy, RefreshCw, BookMarked } from 'lucide-react';
import Button from '../common/Button';
import useAppStore from '../../stores/useAppStore';
import useStudyStore from '../../stores/useStudyStore';
import { generateQuiz } from '../../services/studyApi';
import QuizSettings from './QuizSettings';
import QuizPlayer from './QuizPlayer';

/** 결과 화면 — 점수 + 오답 요약 + 다음 액션 */
function QuizResult() {
  const currentQuiz = useStudyStore((s) => s.currentQuiz);
  const answers = useStudyStore((s) => s.answers);
  const resetQuiz = useStudyStore((s) => s.resetQuiz);
  const setStudySubTab = useAppStore((s) => s.setStudySubTab);

  const questions = currentQuiz?.questions || [];
  const answered = questions.filter((q) => answers[q.id]);
  const correct = answered.filter((q) => answers[q.id]?.correct).length;
  const wrong = answered.length - correct;
  const rate = answered.length > 0 ? Math.round((correct / answered.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto w-full items-center py-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Trophy className="w-7 h-7 text-primary" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-text-primary">수고하셨습니다!</h2>
        <p className="text-sm text-text-secondary mt-1">
          {answered.length}문제 중 {correct}문제 정답 (정답률 {rate}%)
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full">
        <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-bg-secondary">
          <span className="text-xs text-text-secondary">푼 문제</span>
          <span className="text-lg font-semibold text-text-primary tabular-nums">{answered.length}</span>
        </div>
        <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-success/10">
          <span className="text-xs text-success">정답</span>
          <span className="text-lg font-semibold text-success tabular-nums">{correct}</span>
        </div>
        <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-danger/10">
          <span className="text-xs text-danger">오답</span>
          <span className="text-lg font-semibold text-danger tabular-nums">{wrong}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={resetQuiz}>
          <RefreshCw className="w-4 h-4" />
          새 퀴즈
        </Button>
        <Button onClick={() => { resetQuiz(); setStudySubTab('record'); }}>
          <BookMarked className="w-4 h-4" />
          오답노트 보기
        </Button>
      </div>
    </div>
  );
}

/** 학습 퀴즈 탭 — 설정 / 풀이 / 결과 단계 분기 + 탭 이동 시 자동 일시정지. */
export default function StudyQuizTab() {
  const studyStep = useStudyStore((s) => s.studyStep);
  const setStudyStep = useStudyStore((s) => s.setStudyStep);
  const setQuiz = useStudyStore((s) => s.setQuiz);
  const currentQuiz = useStudyStore((s) => s.currentQuiz);
  const quizSeed = useStudyStore((s) => s.quizSeed);
  const clearQuizSeed = useStudyStore((s) => s.clearQuizSeed);
  const setQuizPaused = useStudyStore((s) => s.setQuizPaused);

  const studySubTab = useAppStore((s) => s.studySubTab);

  // quizSeed가 있으면 해당 문제로 시작하는 새 세션을 생성 (액티브 리콜)
  useEffect(() => {
    if (!quizSeed) return;
    let cancelled = false;
    (async () => {
      // 일단 4문제(신규) 뽑고 seed 문제를 맨 앞에 끼워넣는다.
      try {
        const base = await generateQuiz({
          docIds: [],
          count: 4,
          difficulty: quizSeed.difficulty || 'mixed',
          types: [quizSeed.type || 'multiple'],
        });
        if (cancelled) return;
        const seedQ = {
          id: `seed-${quizSeed.id}`,
          type: quizSeed.type || 'multiple',
          question: quizSeed.question,
          options: quizSeed.options,
          answer: quizSeed.correctAnswer,
          explanation: quizSeed.explanation,
          difficulty: quizSeed.difficulty || 'mixed',
        };
        setQuiz({ quizId: `recall-${Date.now()}`, questions: [seedQ, ...base.questions] });
        setStudyStep('quiz');
        clearQuizSeed();
      } catch {
        // 실패 시 seed만으로라도 1문제 세션 생성
        const seedQ = {
          id: `seed-${quizSeed.id}`,
          type: quizSeed.type || 'multiple',
          question: quizSeed.question,
          options: quizSeed.options,
          answer: quizSeed.correctAnswer,
          explanation: quizSeed.explanation,
        };
        if (cancelled) return;
        setQuiz({ quizId: `recall-${Date.now()}`, questions: [seedQ] });
        setStudyStep('quiz');
        clearQuizSeed();
      }
    })();
    return () => { cancelled = true; };
  }, [quizSeed, setQuiz, setStudyStep, clearQuizSeed]);

  // 퀴즈 탭 아닌 곳으로 이동 시 자동 일시정지 (세션이 있고 결과 화면이 아닐 때만)
  useEffect(() => {
    if (studySubTab !== 'quiz' && currentQuiz && studyStep === 'quiz') {
      setQuizPaused(true);
    }
  }, [studySubTab, currentQuiz, studyStep, setQuizPaused]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      {studyStep === 'settings' && <QuizSettings />}
      {studyStep === 'quiz' && <QuizPlayer />}
      {studyStep === 'result' && <QuizResult />}
    </div>
  );
}
