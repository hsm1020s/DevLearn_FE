/**
 * @fileoverview 공통 드롭다운(select) 컴포넌트
 * 네이티브 select 요소를 커스텀 스타일로 감싼다.
 */

/**
 * 드롭다운 셀렉트
 * @param {string} label - 셀렉트 상단 라벨
 * @param {Array<{value: string, label: string}>} options - 선택 옵션 목록
 * @param {string} value - 현재 선택된 값
 * @param {Function} onChange - 선택 변경 시 value를 전달하는 콜백
 * @param {boolean} [disabled] - 비활성 상태
 */
export default function Dropdown({
  label,
  options = [],
  value,
  onChange,
  className = '',
  disabled = false,
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-medium text-text-secondary">{label}</label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 text-sm rounded-lg
          bg-bg-secondary border border-border-light
          text-text-primary
          focus:outline-none focus:border-primary
          appearance-none
          bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22currentColor%22%20d%3D%22M6%208L1%203h10z%22%2F%3E%3C%2Fsvg%3E')]
          bg-no-repeat bg-[right_0.75rem_center]
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
