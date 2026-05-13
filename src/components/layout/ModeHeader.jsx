/**
 * @fileoverview 모드 헤더 컴포넌트.
 * 햄버거 + 현재 모드 아이콘·라벨 (예: "공부") + 모드 라벨 옆에 LLM 사용 금액 바.
 *
 * 사용량 바는 모드 라벨 바로 옆(우측 끝 아님)에 배치 — 시각적으로 묶여 보이도록 gap-6.
 * zustand store 전역 보존이라 모드 전환 시 상태 유지 + 채팅 스트림 종료 후 자동 갱신.
 */
import { Menu } from 'lucide-react';
import useAppStore from '../../stores/useAppStore';
import { getModeConfig } from '../../registry/modes';
import ChatUsageBar from '../common/ChatUsageBar';

export default function ModeHeader() {
  const mainMode = useAppStore((s) => s.mainMode);
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen);

  const modeConfig = getModeConfig(mainMode);
  const IconComponent = modeConfig.icon;

  return (
    <header className="flex items-center border-b border-border-light px-2 md:px-4 py-3 gap-6">
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

      {/* 모드 라벨 옆 (우측 끝 아님) — gap-6 만큼 띄움 */}
      <ChatUsageBar />
    </header>
  );
}
