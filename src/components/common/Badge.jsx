/**
 * @fileoverview 상태·카테고리 표시용 배지 컴포넌트
 * 색상별로 미리 정의된 스타일을 적용한다.
 */

/** 색상명 → Tailwind 배경/텍스트 클래스 매핑 */
const colorMap = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-700',
};

/**
 * 인라인 배지
 * @param {ReactNode} children - 배지에 표시할 내용
 * @param {string} color - 색상 키 (blue | green | yellow | red | gray)
 */
export default function Badge({ children, color = 'gray', className = '' }) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
        ${colorMap[color]} ${className}
      `}
    >
      {children}
    </span>
  );
}
