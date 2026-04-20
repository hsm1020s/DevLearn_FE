/**
 * @fileoverview 관리자 대시보드 통계 수치 카드.
 * 기존 AdminPage 내부 인라인 정의를 파일로 분리한 컴포넌트.
 * value가 null/undefined인 경우 '-'로 방어 렌더링한다.
 */

/**
 * 수치와 라벨, 아이콘을 한 줄 카드로 표시한다.
 * @param {object} props
 * @param {React.ElementType} props.icon - lucide-react 아이콘 컴포넌트
 * @param {string} props.label - 카드 라벨(한글)
 * @param {number|string|null|undefined} props.value - 표시할 수치 (null/undefined는 '-')
 * @param {string} props.color - 아이콘 배경 Tailwind 클래스 (예: 'bg-primary')
 */
export default function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-bg-secondary">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary">{value ?? '-'}</p>
        <p className="text-xs text-text-secondary mt-0.5">{label}</p>
      </div>
    </div>
  );
}
