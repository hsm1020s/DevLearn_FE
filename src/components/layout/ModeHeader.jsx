/**
 * @fileoverview 모드 헤더 컴포넌트.
 * 현재 선택된 모드의 아이콘·이름만 표시한다(설명은 의도적으로 숨김 — 라벨만으로
 * 충분하고 헤더가 덜 번잡해진다). 모바일에서는 사이드바 열기 햄버거 버튼을 표시.
 */
import { Menu } from 'lucide-react';
import useAppStore from '../../stores/useAppStore';
import { getModeConfig } from '../../registry/modes';

export default function ModeHeader() {
  const mainMode = useAppStore((s) => s.mainMode);
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen);

  const modeConfig = getModeConfig(mainMode);
  const IconComponent = modeConfig.icon;

  return (
    <header className="flex items-center justify-between border-b border-border-light px-2 md:px-4 py-3">
      <div className="flex items-center gap-2 min-w-0">
        {/* 모바일 햄버거 버튼 */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="p-1 rounded hover:bg-bg-secondary text-text-secondary md:hidden shrink-0"
          aria-label="메뉴 열기"
        >
          <Menu size={20} />
        </button>
        {IconComponent && <IconComponent className="h-5 w-5 text-text-secondary shrink-0" />}
        <span className="font-medium text-text-primary truncate">{modeConfig.label}</span>
      </div>
    </header>
  );
}
