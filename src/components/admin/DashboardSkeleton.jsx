/**
 * @fileoverview 관리자 대시보드 초기 로딩 스켈레톤.
 * 카드 4개 + 최근 대화 리스트 8줄 + 문서 테이블 3줄의 placeholder를
 * animate-pulse + bg-bg-secondary로 표현한다.
 */

/** 개별 placeholder 공통 — 둥근 모서리 + 펄스 애니메이션 */
function Bar({ className = '' }) {
  return <div className={`animate-pulse bg-bg-secondary rounded ${className}`} />;
}

/** 대시보드 전체 영역 스켈레톤 */
export default function DashboardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 통계 카드 4개 */}
      <section>
        <Bar className="h-3 w-24 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bar key={i} className="h-[76px]" />
          ))}
        </div>
      </section>

      {/* 최근 대화 8줄 */}
      <section>
        <Bar className="h-3 w-24 mb-3" />
        <div className="bg-bg-primary border border-border-light rounded-xl p-3 flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Bar key={i} className="h-7" />
          ))}
        </div>
      </section>

      {/* 문서 테이블 3줄 */}
      <section>
        <Bar className="h-3 w-24 mb-3" />
        <div className="bg-bg-primary border border-border-light rounded-xl p-3 flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Bar key={i} className="h-7" />
          ))}
        </div>
      </section>
    </div>
  );
}
