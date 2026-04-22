/**
 * @fileoverview 공용 모드 전환 바 — 3개 모드 버튼(일반/자격증/업무학습) + 마인드맵 토글.
 *
 * 일반·자격증·업무학습 모드의 빈 화면 중앙에서 공유되는 컴포넌트. 사용자가 어느
 * 모드에 있든 동일한 UI로 다른 모드/마인드맵을 즉시 전환할 수 있게 해 이동
 * 대칭성을 보장한다(사이드바 외 inline 경로를 유지).
 *
 * 비-빈 상태(메시지가 있는 대화)에는 호출부에서 숨긴다 — 스위처는 "아직 입력 전"
 * 유저의 네비게이션 전용.
 */
import { Brain } from 'lucide-react';
import useAppStore from '../../stores/useAppStore';
import { MODE_LIST } from '../../registry/modes';

/** 모드 전환 탭 + 마인드맵 토글 묶음. 현재 모드와 마인드맵 상태를 primary 톤으로 하이라이트. */
export default function ModeSwitcher() {
  const mainMode = useAppStore((s) => s.mainMode);
  const setMainMode = useAppStore((s) => s.setMainMode);
  const isMindmapOn = useAppStore((s) => s.isMindmapOn);
  const toggleMindmap = useAppStore((s) => s.toggleMindmap);

  return (
    <div className="flex items-center gap-1">
      {MODE_LIST.map(({ value, label, icon: Icon }) => {
        const isActive = mainMode === value;
        return (
          <button
            key={value}
            onClick={() => setMainMode(value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
              ${isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'}`}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}

      {/* 모드 ↔ 마인드맵 구분선 — 두 기능을 시각적으로 그룹 분리 */}
      <div className="w-px h-5 bg-border-light mx-1" />

      <button
        onClick={toggleMindmap}
        title={isMindmapOn ? '마인드맵 닫기' : '마인드맵 열기'}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
          ${isMindmapOn
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'}`}
      >
        <Brain size={16} />
        마인드맵
      </button>
    </div>
  );
}
