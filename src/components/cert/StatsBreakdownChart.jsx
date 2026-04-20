/**
 * @fileoverview 자격증 학습 통계 — 분류별(난이도/유형) 성적 막대 차트.
 * 순수 CSS로 구현한 수평 막대 리스트. recharts 등 차트 라이브러리 미사용.
 */

/**
 * 분류별 정답률을 수평 막대로 표시한다.
 * @param {string} title - 섹션 제목 (예: "난이도별 성적")
 * @param {Array<{key:string,total:number,correct:number,rate:number}>} items - 정규화된 항목 배열
 * @param {Object<string,string>} labelMap - key → 표시 라벨 매핑
 */
export default function StatsBreakdownChart({ title, items, labelMap }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-text-primary border-b border-border-light pb-1">
        {title}
      </h3>

      {(!items || items.length === 0) ? (
        <p className="text-xs text-text-tertiary py-2">데이터 없음</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(({ key, total, correct, rate }) => {
            const percent = Math.round((rate ?? 0) * 100);
            return (
              <div
                key={key}
                className="grid grid-cols-[72px_1fr_auto] items-center gap-3"
              >
                <span className="text-sm text-text-secondary">
                  {labelMap?.[key] ?? key}
                </span>
                <div className="h-2.5 rounded bg-bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded bg-primary transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-text-primary tabular-nums">
                  {percent}% ({correct}/{total})
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
