/**
 * @fileoverview 채팅 빈 상태 공통 컴포넌트
 * 대화가 없을 때 화면 중앙에 아이콘, 안내 문구, 입력창, 예시 질문을 표시한다.
 * 일반/자격증/업무학습 모드에서 공통으로 사용한다.
 */
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
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4" style={{ marginTop: '-6%' }}>
      <div className="w-full max-w-2xl flex flex-col items-center gap-6">
        {/* 아이콘 */}
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Icon size={24} className="text-primary" />
        </div>

        {/* 제목 + 설명 */}
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <p className="text-sm text-text-secondary mt-1">{description}</p>
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
