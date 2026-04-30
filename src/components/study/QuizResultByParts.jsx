/**
 * @fileoverview 파트별 집계 모의고사 결과 화면 (현재는 도달 불가 — 향후 재도입 대비 보존).
 *
 * 카탈로그 엔트리에 `parts`가 정의돼 있을 때만 렌더된다(현재는 항상 단순 결과
 * 화면으로 분기). part 태그가 있는 문제만 집계 대상.
 */
import { Trophy, AlertTriangle, RefreshCw, BookMarked, CheckCircle2 } from 'lucide-react';
import Button from '../common/Button';
import useStudyStore from '../../stores/useStudyStore';
import useAppStore from '../../stores/useAppStore';
import { computePartsScore } from '../../utils/examScoring';
import { useActiveSubjectMeta } from '../../hooks/useActiveSubject';

/**
 * 모의고사 결과 — 과목별 표 + 합격/불합격 배너.
 * 상위에서 이미 parts 유무를 확인하고 마운트한다는 가정(부재 시 기본 결과 화면 사용).
 */
export default function QuizResultByParts() {
  const currentQuiz = useStudyStore((s) => s.subjects[s.activeSubject].currentQuiz);
  const answers = useStudyStore((s) => s.subjects[s.activeSubject].answers);
  const resetQuiz = useStudyStore((s) => s.resetQuiz);
  const setStudySubTab = useAppStore((s) => s.setStudySubTab);
  const subjectMeta = useActiveSubjectMeta();

  const score = computePartsScore(
    currentQuiz,
    answers,
    subjectMeta.parts,
    subjectMeta.passingCriteria,
  );

  // parts 태그가 달린 문제가 0개면(= 비자격증 과목이나 구버전 세션) 폴백 — StudyQuizTab에서 이 경우 분기되므로 보통 이 경로로 오지 않음.
  if (!score) return null;

  const { perPart, total, totalMin, partMinPercent, failedParts, passed } = score;
  const totalRounded = Math.round(total * 10) / 10;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full py-4">
      {/* 합격/불합격 배너 */}
      <div
        className={`flex items-center gap-3 p-4 rounded-xl border ${
          passed
            ? 'border-success/40 bg-success/10 text-success'
            : 'border-danger/40 bg-danger/10 text-danger'
        }`}
      >
        {passed ? <Trophy className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
        <div className="flex flex-col">
          <p className="text-sm font-semibold">
            {passed ? '합격 예상' : '불합격 예상'} · 총점 {totalRounded}점 / 100점
          </p>
          <p className="text-xs opacity-90">
            합격 기준 · 총점 {totalMin}점 이상 + 과목별 {partMinPercent}% 이상
            {failedParts.length > 0 && ` · 과락 ${failedParts.length}과목`}
          </p>
        </div>
      </div>

      {/* 과목별 집계 표 */}
      <div className="flex flex-col rounded-lg border border-border-light overflow-hidden">
        <div className="grid grid-cols-[1.6fr_60px_70px_70px_70px] gap-2 px-3 py-2 bg-bg-secondary text-xs font-medium text-text-secondary">
          <span>과목</span>
          <span className="text-right">정답</span>
          <span className="text-right">문항</span>
          <span className="text-right">정답률</span>
          <span className="text-right">점수</span>
        </div>
        {perPart.map((p) => {
          const ratePct = Math.round(p.correctRate * 1000) / 10;
          const scoreRounded = Math.round(p.score * 10) / 10;
          return (
            <div
              key={p.partId}
              className={`grid grid-cols-[1.6fr_60px_70px_70px_70px] gap-2 px-3 py-2 text-sm border-t border-border-light tabular-nums ${
                p.failed ? 'bg-danger/5' : ''
              }`}
            >
              <span className="flex items-center gap-1.5 text-text-primary">
                {p.label}
                {p.failed && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-danger/15 text-danger font-medium">
                    과락
                  </span>
                )}
                {!p.failed && p.questionCount > 0 && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success opacity-70" />
                )}
              </span>
              <span className="text-right text-text-primary">{p.correctCount}</span>
              <span className="text-right text-text-secondary">{p.questionCount}</span>
              <span className="text-right text-text-secondary">{ratePct}%</span>
              <span className="text-right text-text-primary">{scoreRounded} / {p.points}</span>
            </div>
          );
        })}
        <div className="grid grid-cols-[1.6fr_60px_70px_70px_70px] gap-2 px-3 py-2 text-sm bg-bg-secondary border-t border-border-light tabular-nums font-medium">
          <span className="text-text-primary">총점</span>
          <span></span>
          <span></span>
          <span></span>
          <span className="text-right text-text-primary">{totalRounded} / 100</span>
        </div>
      </div>

      {/* 액션 */}
      <div className="flex gap-2 justify-center">
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
