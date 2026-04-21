/**
 * @fileoverview 학습 통계 — 상단 요약 카드 3종.
 * 총 풀이 수, 정답 수, 정답률(프로그레스 바 내장)을 표시한다.
 */
import { BookOpen, CheckCircle, TrendingUp } from 'lucide-react';

/**
 * 누적 학습 통계 요약 카드 그룹. 정답률 카드에는 프로그레스 바가 포함된다.
 * @param {number} totalSolved - 지금까지 풀이한 총 문제 수
 * @param {number} correctCount - 지금까지 맞힌 문제 수
 * @param {number} correctRate - 0~1 사이 정답률
 */
export default function StatsSummaryCards({ totalSolved, correctCount, correctRate }) {
  const ratePercent = Math.round((correctRate ?? 0) * 100);

  // 정답률 수치 텍스트 색상: ≥80% 성공, ≥60% 기본, 그 외 경고/위험
  const rateTextColor =
    ratePercent >= 80
      ? 'text-success'
      : ratePercent >= 60
      ? 'text-text-primary'
      : ratePercent >= 40
      ? 'text-warning'
      : 'text-danger';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* 총 풀이 */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-bg-secondary">
        <BookOpen className="w-5 h-5 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-text-secondary">총 풀이</p>
          <p className="text-lg font-semibold text-text-primary tabular-nums">
            {totalSolved ?? 0}문제
          </p>
        </div>
      </div>

      {/* 정답 수 */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-bg-secondary">
        <CheckCircle className="w-5 h-5 text-success shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-text-secondary">정답</p>
          <p className="text-lg font-semibold text-text-primary tabular-nums">
            {correctCount ?? 0}개
          </p>
        </div>
      </div>

      {/* 정답률 — 프로그레스 바 내장 */}
      <div className="flex flex-col gap-2 p-4 rounded-lg bg-bg-secondary">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-secondary">정답률</p>
            <p className={`text-lg font-semibold tabular-nums ${rateTextColor}`}>
              {ratePercent}%
            </p>
          </div>
        </div>
        <div className="h-2 rounded bg-bg-primary overflow-hidden">
          <div
            className="h-full rounded bg-primary transition-all"
            style={{ width: `${ratePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
