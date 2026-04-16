/**
 * @fileoverview 토글 스위치 컴포넌트
 * on/off 상태를 시각적으로 표현하는 슬라이드 스위치이다.
 */

/**
 * 토글 스위치
 * @param {string} label - 토글 옆에 표시할 라벨 텍스트
 * @param {boolean} checked - 현재 활성 상태
 * @param {Function} onChange - 상태 변경 시 새 값(boolean)을 전달하는 콜백
 */
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
