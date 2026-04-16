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
