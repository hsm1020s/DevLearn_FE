/** @fileoverview 모드 전환 탭 — 입력창 상단이나 화면 하단에서 모드를 빠르게 전환한다. */
import useAppStore from '../../stores/useAppStore';
import { MODE_LIST } from '../../registry/modes';

export default function ModeSwitcher() {
  const mainMode = useAppStore((s) => s.mainMode);
  const setMainMode = useAppStore((s) => s.setMainMode);

  return (
    <div className="flex items-center gap-1">
      {MODE_LIST.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setMainMode(value)}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg transition-colors
            ${mainMode === value
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-text-tertiary hover:text-text-primary hover:bg-bg-secondary'}`}
        >
          <Icon size={14} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
