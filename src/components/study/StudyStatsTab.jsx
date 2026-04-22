/**
 * @fileoverview 기록 탭 내부 — 학습 통계 sub-panel.
 * useStudyStore.stats 누적 통계(로컬 state, 백엔드 연결 전)를 요약 카드 + 간이 막대로 표시한다.
 * 기존 StudyStatsPanel은 /study/stats API를 호출하는 모달 버전이라 목적이 달라 별도 컴포넌트로 둔다.
 */
import StatsSummaryCards from './StatsSummaryCards';
import useStudyStore from '../../stores/useStudyStore';
import { STATS_DIFFICULTY_LABELS, STATS_TYPE_LABELS } from '../../utils/constants';

/** 단순 수평 막대 — value/max 기반. */
function Bar({ label, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 shrink-0 text-text-secondary">{label}</span>
      <div className="flex-1 h-2 rounded bg-bg-secondary">
        <div className="h-full rounded bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right tabular-nums text-text-primary">{value}</span>
    </div>
  );
}

/** 기록 탭 > 통계 — 누적 학습 통계 요약. 활성 과목 기준. */
export default function StudyStatsTab() {
  const stats = useStudyStore((s) => s.subjects[s.activeSubject].stats);
  const { totalSolved, correctCount, byDifficulty, byType } = stats;
  const correctRate = totalSolved > 0 ? correctCount / totalSolved : 0;

  const diffMax = Math.max(1, ...Object.values(byDifficulty));
  const typeMax = Math.max(1, ...Object.values(byType));

  return (
    <div className="flex flex-col gap-6">
      <StatsSummaryCards
        totalSolved={totalSolved}
        correctCount={correctCount}
        correctRate={correctRate}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2 p-4 rounded-lg border border-border-light">
          <h3 className="text-sm font-medium text-text-primary mb-1">난이도별 풀이 분포</h3>
          {Object.entries(byDifficulty).map(([k, v]) => (
            <Bar key={k} label={STATS_DIFFICULTY_LABELS[k] || k} value={v} max={diffMax} />
          ))}
        </div>

        <div className="flex flex-col gap-2 p-4 rounded-lg border border-border-light">
          <h3 className="text-sm font-medium text-text-primary mb-1">유형별 풀이 분포</h3>
          {Object.entries(byType).map(([k, v]) => (
            <Bar key={k} label={STATS_TYPE_LABELS[k] || k} value={v} max={typeMax} />
          ))}
        </div>
      </div>

      {totalSolved === 0 && (
        <p className="text-sm text-text-tertiary text-center py-4">
          아직 풀이한 퀴즈가 없습니다. 퀴즈 탭에서 세션을 시작하면 통계가 쌓입니다.
        </p>
      )}
    </div>
  );
}
