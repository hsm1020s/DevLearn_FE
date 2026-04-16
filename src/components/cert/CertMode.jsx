/**
 * @fileoverview 자격증 학습 모드 컴포넌트
 * certStep 상태에 따라 PDF 업로드 -> 퀴즈 설정 -> 퀴즈 풀이 -> 결과 화면을
 * 단계별로 전환하여 렌더링한다.
 */
import { Trophy, RotateCcw, PlusCircle } from 'lucide-react';
import Button from '../common/Button';
import ModeSwitcher from '../common/ModeSwitcher';
import useCertStore from '../../stores/useCertStore';
import PdfUploader from './PdfUploader';
import QuizSettings from './QuizSettings';
import QuizPlayer from './QuizPlayer';

/** 퀴즈 완료 후 정답 수, 총 문제 수, 정답률을 보여주는 결과 화면 */
function QuizResult() {
  const currentQuiz = useCertStore((s) => s.currentQuiz);
  const answers = useCertStore((s) => s.answers);
  const setCertStep = useCertStore((s) => s.setCertStep);
  const setQuestionIndex = useCertStore((s) => s.setQuestionIndex);
  const resetQuiz = useCertStore((s) => s.resetQuiz);

  const questions = currentQuiz?.questions || [];
  const total = questions.length;
  const correctCount = questions.filter(
    (q) => answers[q.id]?.correct
  ).length;
  const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  // 답변 한번에 초기화 후 첫 문제부터 다시 시작
  const handleRetry = () => {
    useCertStore.setState({ answers: {}, currentQuestionIndex: 0, certStep: 'quiz' });
  };

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <Trophy className="w-12 h-12 text-warning" />
      <h2 className="text-xl font-bold text-text-primary">퀴즈 결과</h2>

      <div className="flex gap-8 text-center">
        <div>
          <p className="text-3xl font-bold text-primary">{correctCount}</p>
          <p className="text-xs text-text-secondary mt-1">정답</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-text-primary">{total}</p>
          <p className="text-xs text-text-secondary mt-1">총 문제</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-text-primary">{rate}%</p>
          <p className="text-xs text-text-secondary mt-1">정답률</p>
        </div>
      </div>

      <div className="w-full max-w-xs h-2 rounded bg-bg-secondary">
        <div
          className="h-full rounded bg-primary transition-all"
          style={{ width: `${rate}%` }}
        />
      </div>

      <div className="flex gap-3 mt-4">
        <Button variant="secondary" onClick={handleRetry}>
          <RotateCcw className="w-4 h-4" />
          다시 풀기
        </Button>
        <Button onClick={resetQuiz}>
          <PlusCircle className="w-4 h-4" />
          새 퀴즈
        </Button>
      </div>
    </div>
  );
}

/** 자격증 모드 최상위 컴포넌트. certStep에 따라 적절한 단계 컴포넌트를 렌더링한다. */
export default function CertMode() {
  const certStep = useCertStore((s) => s.certStep);

  const stepComponents = {
    upload: PdfUploader,
    settings: QuizSettings,
    quiz: QuizPlayer,
    result: QuizResult,
  };

  const StepComponent = stepComponents[certStep] || PdfUploader;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
        <StepComponent />
      </div>
      <div className="border-t border-border-light bg-bg-primary px-4 py-3">
        <ModeSwitcher />
      </div>
    </div>
  );
}
