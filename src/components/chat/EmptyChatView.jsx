/**
 * @fileoverview 채팅 빈 상태 공통 컴포넌트
 * 대화가 없을 때 화면 중앙에 모드 전환 탭, 입력창, 예시 질문을 표시한다.
 * 일반/학습 모드에서 공통으로 사용한다.
 */
import { Brain } from 'lucide-react';
import useAppStore from '../../stores/useAppStore';
import { MODE_LIST } from '../../registry/modes';
import ChatInput from './ChatInput';

/**
 * @param {React.ElementType} icon - 모드별 아이콘 컴포넌트
 * @param {string} title - 모드 제목 (예: "일반 모드")
 * @param {string} description - 안내 문구
 * @param {string[]} [examples] - 예시 질문 목록 (선택)
 * @param {Function} onSend - 메시지 전송 핸들러
 * @param {boolean} isStreaming - 스트리밍 중 여부
 * @param {Function} onStop - 스트리밍 중지 핸들러
 */
export default function EmptyChatView({ icon: Icon, title, description, examples = [], onSend, isStreaming, onStop }) {
  const mainMode = useAppStore((s) => s.mainMode);
  const setMainMode = useAppStore((s) => s.setMainMode);
  const isMindmapOn = useAppStore((s) => s.isMindmapOn);
  const toggleMindmap = useAppStore((s) => s.toggleMindmap);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-3 md:px-4" style={{ marginTop: '-6%' }}>
      <div className="w-full max-w-2xl flex flex-col items-center gap-4 md:gap-6">
        {/* 아이콘 */}
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Icon size={24} className="text-primary" />
        </div>

        {/* 제목 + 설명 */}
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <p className="text-sm text-text-secondary mt-1">{description}</p>
        </div>

        {/* 모드 전환 탭 + 마인드맵 토글 */}
        <div className="flex items-center gap-1">
          {MODE_LIST.map((mode) => {
            const ModeIcon = mode.icon;
            const isActive = mainMode === mode.value;
            return (
              <button
                key={mode.value}
                onClick={() => setMainMode(mode.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
                  ${isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                  }`}
              >
                <ModeIcon size={16} />
                {mode.label}
              </button>
            );
          })}

          {/* 구분선 */}
          <div className="w-px h-5 bg-border-light mx-1" />

          {/* 마인드맵 토글 */}
          <button
            onClick={toggleMindmap}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
              ${isMindmapOn
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              }`}
            title={isMindmapOn ? '마인드맵 닫기' : '마인드맵 열기'}
          >
            <Brain size={16} />
            마인드맵
          </button>
        </div>

        {/* 중앙 입력창 */}
        <div className="w-full">
          <ChatInput onSend={onSend} isStreaming={isStreaming} onStop={onStop} />
        </div>

        {/* 예시 질문 */}
        {examples.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {examples.map((q) => (
              <button
                key={q}
                onClick={() => onSend(q)}
                className="px-3 py-2 rounded-lg bg-bg-secondary border border-border-light
                           text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
