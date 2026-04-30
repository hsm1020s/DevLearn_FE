/**
 * @fileoverview 학습 계열 모드의 채팅 탭 (공부 모드 + 업무학습 모드 공용).
 *
 * 학습 성격을 가진 모드(`study` · `worklearn`)는 파인만 같은 **학습 채팅
 * UX**를 공유한다. 내부 구조를 한 곳에 두되, 호출부가 모드/타이틀/예시 질문을
 * prop으로 주입해 컨텍스트를 바꿀 수 있게 한다.
 *
 * 기본값은 공부 모드 진입 시 동작한다 — prop 없이 호출하면 기본 헤더/예시.
 * 업무학습 모드에서는 `mode="worklearn"`과 업무 맥락 예시·타이틀을 넘긴다.
 *
 * 출처는 ChatMessage 내부의 SourcesPopover 가 메시지별로 담당하므로,
 * 이 탭은 단일 칼럼 레이아웃만 유지한다.
 */
import { FileText } from 'lucide-react';
import useStreamingChat from '../../hooks/useStreamingChat';
import ChatMessage from '../chat/ChatMessage';
import ChatInput from '../chat/ChatInput';
import ChatLoadingBubble from '../chat/ChatLoadingBubble';
import JumpToBottomButton from '../chat/JumpToBottomButton';
import StudyStyleChips from './StudyStyleChips';
import StudyHomeCards from './StudyHomeCards';
import ModeSwitcher from '../common/ModeSwitcher';
import { useActiveSubjectMeta } from '../../hooks/useActiveSubject';

/**
 * 학습 계열 채팅 탭.
 * @param {object} [props]
 * @param {'study'|'worklearn'} [props.mode='study']
 *   채팅 훅에 전달할 모드 키. useStreamingChat이 이 값으로 대화 네임스페이스/LLM을 구분.
 * @param {string[]} [props.examples]
 *   빈 상태에 노출할 예시 질문. 없으면 공부 모드에서는 카탈로그 기본 예시 사용,
 *   업무학습 모드에서는 빈 배열.
 * @param {string} [props.title] 빈 상태 헤더 타이틀 (기본: '공부')
 * @param {string} [props.subtitle] 빈 상태 헤더 서브타이틀 (기본: 일반 학습 안내)
 * @param {import('react').ReactNode} [props.homeCards]
 *   빈 상태에서 3카드 런처 영역에 렌더할 컴포넌트. 기본은 `StudyHomeCards`(공부 모드).
 *   업무학습 모드처럼 런처가 필요 없으면 `null` 주입.
 */
export default function StudyChatTab({ mode = 'study', examples, title, subtitle, homeCards }) {
  const {
    messages,
    streamingContent,
    isStreaming,
    handleSend,
    handleStop,
    scrollRef,
    handleScroll,
    isAtBottom,
    hasNewBelow,
    scrollToBottomNow,
  } = useStreamingChat(mode);

  // 공부 모드 폴백: 카탈로그의 기본 예시 질문만 사용한다. 라벨/설명은 카탈로그
  // 의존을 끊고 단일 "공부" 타이틀로 고정 — SQLP/DAP 같은 자격증 색채 노출을 막는다.
  const subjectMeta = useActiveSubjectMeta();
  const isStudy = mode === 'study';
  const resolvedExamples = examples ?? (isStudy ? subjectMeta.examples || [] : []);
  const resolvedTitle = title ?? (isStudy ? '공부' : '학습 채팅');
  const resolvedSubtitle = subtitle ?? (isStudy
    ? 'PDF 업로드 후 자동 출제 · 즉시 채점 · 오답 정리'
    : '업무 지식을 질문·정리해보세요');
  // 3카드 런처는 공부 모드에만 기본 노출. null이 prop으로 오면 안 그림.
  const resolvedHomeCards = homeCards === undefined ? (isStudy ? <StudyHomeCards /> : null) : homeCards;

  const isEmpty = messages.length === 0 && !streamingContent;

  return (
    <div className="flex flex-col h-full">
      <StudyStyleChips />

      {isEmpty ? (
        // 빈 상태 — 중앙 정렬로 아이콘/타이틀/(선택적)런처/입력창/예시 질문 순서
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6 overflow-y-auto">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileText size={22} className="text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">{resolvedTitle}</h2>
            <p className="text-sm text-text-secondary">{resolvedSubtitle}</p>
          </div>

          {/* 다른 모드·마인드맵으로의 이동 경로 — 일반 모드 EmptyChatView와 대칭 */}
          <ModeSwitcher />

          {resolvedHomeCards}

          <div className="w-full max-w-2xl">
            <ChatInput onSend={handleSend} isStreaming={isStreaming} onStop={handleStop} />
          </div>

          {resolvedExamples.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
              {resolvedExamples.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="px-3 py-2 rounded-lg bg-bg-secondary border border-border-light
                             text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 relative min-h-0">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="absolute inset-0 overflow-y-auto px-4 py-6"
            >
              <div className="max-w-4xl mx-auto flex flex-col gap-4">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {isStreaming && !streamingContent && <ChatLoadingBubble />}
                {isStreaming && streamingContent && (
                  <ChatMessage
                    message={{ id: '__streaming', role: 'assistant', content: streamingContent }}
                    isStreaming
                  />
                )}
              </div>
            </div>
            <JumpToBottomButton
              visible={!isAtBottom}
              hasNew={hasNewBelow}
              onClick={scrollToBottomNow}
            />
          </div>
          <div className="max-w-4xl mx-auto w-full">
            <ChatInput onSend={handleSend} isStreaming={isStreaming} onStop={handleStop} />
          </div>
        </>
      )}
    </div>
  );
}
