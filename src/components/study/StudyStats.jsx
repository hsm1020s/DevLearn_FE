/**
 * @fileoverview 학습 통계 컴포넌트
 * 업로드된 교재 수, 총 문제 수, 정답/오답 수, 정답률 등
 * 현재 학습 진행 상황을 요약하여 표시한다.
 */
import { BarChart3, CheckCircle, XCircle, BookOpen } from 'lucide-react';
import useDocStore from '../../stores/useDocStore';
import useStudyStore from '../../stores/useStudyStore';
import Button from '../common/Button';

/** 학습 통계 요약 카드. 문서/문제/정답/오답 수와 정답률 프로그레스 바를 표시한다. */
export default function StudyStats({ onDone }) {
  const currentQuiz = useStudyStore((s) => s.currentQuiz);
  const answers = useStudyStore((s) => s.answers);
  const docs = useDocStore((s) => s.docs);

  const questions = currentQuiz?.questions || [];
  const total = questions.length;
  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.filter((q) => answers[q.id]?.correct).length;
  const wrongCount = answeredCount - correctCount;
  const rate = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const completedDocs = docs.filter((d) => d.status === 'completed');

  const stats = [
    { icon: BookOpen, label: '업로드 문서', value: `${completedDocs.length}개`, color: 'text-primary' },
    { icon: BarChart3, label: '총 문제', value: `${total}문제`, color: 'text-text-primary' },
    { icon: CheckCircle, label: '정답', value: `${correctCount}개`, color: 'text-success' },
    { icon: XCircle, label: '오답', value: `${wrongCount}개`, color: 'text-danger' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary">
            <Icon className={`w-5 h-5 ${color} shrink-0`} />
            <div>
              <p className="text-xs text-text-secondary">{label}</p>
              <p className="text-sm font-semibold text-text-primary">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">정답률</span>
          <span className="font-medium text-text-primary">{rate}%</span>
        </div>
        <div className="h-2 rounded bg-bg-secondary">
          <div
            className="h-full rounded bg-primary transition-all"
            style={{ width: `${rate}%` }}
          />
        </div>
      </div>

      {answeredCount === 0 && (
        <p className="text-sm text-text-tertiary text-center py-4">
          아직 풀이한 퀴즈가 없습니다
        </p>
      )}

      {onDone && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onDone}>닫기</Button>
        </div>
      )}
    </div>
  );
}
