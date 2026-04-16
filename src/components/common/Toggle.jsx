export default function Toggle({ label, checked, onChange, className = '' }) {
  return (
    <label className={`flex items-center justify-between cursor-pointer ${className}`}>
      {label && <span className="text-sm text-text-primary">{label}</span>}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative w-10 h-5 rounded-full transition-colors
          ${checked ? 'bg-primary' : 'bg-border-medium'}
        `}
      >
        <span
          className={`
            absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white
            transition-transform shadow-sm
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </label>
  );
}
