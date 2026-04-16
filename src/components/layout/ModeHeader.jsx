/**
 * @fileoverview 모드 헤더 컴포넌트
 * 현재 선택된 모드의 아이콘·이름·설명을 표시한다.
 */
import useAppStore from '../../stores/useAppStore';
import { getModeConfig } from '../../registry/modes';

export default function ModeHeader() {
  const mainMode = useAppStore((s) => s.mainMode);

  const modeConfig = getModeConfig(mainMode);
  const IconComponent = modeConfig.icon;

  return (
    <header className="flex items-center justify-between border-b border-border-light px-4 py-3">
      <div className="flex items-center gap-2">
        {IconComponent && <IconComponent className="h-5 w-5 text-text-secondary" />}
        <span className="font-medium text-text-primary">{modeConfig.label}</span>
        <span className="text-text-secondary">—</span>
        <span className="text-sm text-text-secondary">{modeConfig.description}</span>
      </div>
    </header>
  );
}
