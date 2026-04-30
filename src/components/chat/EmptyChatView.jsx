/**
 * @fileoverview 채팅 빈 상태 공통 컴포넌트.
 * 대화가 없을 때 화면 중앙에 모드 전환 탭과 입력창을 표시한다.
 * 일반 모드 ChatContainer의 빈 상태에서 사용되며, 학습 계열 모드도 `ModeSwitcher`를
 * 각자 빈 상태에 배치해 모드 이동 대칭성을 공유한다.
 */
import ChatInput from './ChatInput';
import ModeSwitcher from '../common/ModeSwitcher';

/**
 * @param {object} props
 * @param {React.ElementType} props.icon - 모드별 아이콘 컴포넌트
 * @param {string} props.title - 모드 제목 (예: "일반 모드")
 * @param {string} props.description - 안내 문구
 * @param {Function} props.onSend - 메시지 전송 핸들러
 * @param {boolean} props.isStreaming - 스트리밍 중 여부
 * @param {Function} props.onStop - 스트리밍 중지 핸들러
 */
export default function EmptyChatView({ icon: Icon, title, description, onSend, isStreaming, onStop }) {
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

        {/* 모드 전환 + 마인드맵 토글 — 학습 계열 빈 화면과 공용 */}
        <ModeSwitcher />

        {/* 중앙 입력창 */}
        <div className="w-full">
          <ChatInput onSend={onSend} isStreaming={isStreaming} onStop={onStop} />
        </div>
      </div>
    </div>
  );
}
