/**
 * @fileoverview 공통 버튼 컴포넌트
 * variant(primary/secondary/ghost/danger)와 size(sm/md/lg)로 스타일을 제어한다.
 */

/** 버튼 스타일 variant별 Tailwind 클래스 매핑 */
const variants = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-bg-secondary text-text-primary hover:bg-bg-tertiary',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-secondary',
  danger: 'bg-danger text-white hover:opacity-90',
};

const sizes = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

/**
 * 재사용 가능한 버튼 컴포넌트
 * @param {string} variant - 버튼 스타일 종류 (primary | secondary | ghost | danger)
 * @param {string} size - 버튼 크기 (sm | md | lg)
 * @param {boolean} disabled - 비활성화 여부
 * @param {string} className - 추가 CSS 클래스
 * @param {Function} onClick - 클릭 핸들러
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  onClick,
  ...props
}) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        rounded-lg font-medium transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
