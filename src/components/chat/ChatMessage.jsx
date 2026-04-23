/**
 * @fileoverview 개별 채팅 메시지 컴포넌트.
 * 사용자/어시스턴트 메시지를 구분하여 렌더링하고,
 * 어시스턴트 메시지는 마크다운 파싱, 출처 카드, 복사 기능, 학습 스타일 뱃지를 제공한다.
 */
import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Copy, Check, Bot, User } from 'lucide-react';
import SourceCard from './SourceCard';
import { CHAT_STYLES } from '../../utils/constants';

// 스타일 key → 뱃지 표시 정보
const STYLE_INFO = Object.fromEntries(CHAT_STYLES.map((s) => [s.value, s]));

/** 학습 스타일 뱃지 — 메시지 meta.style이 있을 때만 렌더. */
function StyleBadge({ style }) {
  const info = STYLE_INFO[style];
  if (!info || style === 'general') return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary"
      title={info.description}
    >
      <span className="leading-none">{info.short}</span>
      {info.label}
    </span>
  );
}

/**
 * 단일 채팅 메시지 버블. 역할(user/assistant)에 따라 스타일과 기능이 달라진다.
 *
 * @param {object} props
 * @param {object} props.message 메시지 객체 (id, role, content, sources?, meta?)
 * @param {boolean} [props.isStreaming] 스트리밍 중 커서 표시 여부
 * @param {boolean} [props.hideInlineSources]
 *   RAG 모드처럼 우측 출처 패널이 대신 책임질 때 버블 내부의 SourceCard 를 숨긴다.
 * @param {boolean} [props.isSelected] 우측 출처 패널이 현재 참조 중인 메시지인지.
 * @param {(id: string) => void} [props.onSelect]
 *   assistant 버블 클릭 시 호출. 우측 패널이 이 메시지의 출처를 표시하도록.
 */
export default function ChatMessage({ message, isStreaming, hideInlineSources, isSelected, onSelect }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const style = message.meta?.style;
  // 선택 가능한 대상은 assistant 메시지만 (user 버블을 눌러 출처를 바꿀 이유 없음).
  const selectable = !isUser && typeof onSelect === 'function' && !isStreaming;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [message.content]);

  const handleBubbleClick = useCallback(() => {
    if (selectable) onSelect(message.id);
  }, [selectable, onSelect, message.id]);

  // 선택 시 링 강조. 복사 버튼 클릭과의 충돌은 버튼 쪽 stopPropagation 으로 회피.
  const selectableClasses = selectable ? 'cursor-pointer transition-shadow' : '';
  const selectedRing = isSelected ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-transparent' : '';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* 어시스턴트 아바타 */}
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-1">
          <Bot size={14} className="text-primary" />
        </div>
      )}

      <div className="flex flex-col gap-1 max-w-[75%] min-w-0">
        {/* 스타일 뱃지 — 메시지 버블 위에 표시 */}
        {style && style !== 'general' && (
          <div className={isUser ? 'self-end' : 'self-start'}>
            <StyleBadge style={style} />
          </div>
        )}

        {/*
          break-words: 긴 영단어·URL 등이 버블을 뚫고 나가지 않도록 강제 줄바꿈.
          [&_pre]: / [&_code]: 선택자는 prose 내부 코드블록도 동일 규칙 적용 —
          가로 스크롤 대신 줄바꿈으로 처리해 모바일·좁은 사이드바에서도 안전.
        */}
        <div
          onClick={selectable ? handleBubbleClick : undefined}
          className={`
            rounded-2xl px-4 py-2.5 text-sm leading-relaxed
            break-words
            [&_pre]:whitespace-pre-wrap [&_pre]:break-words
            [&_code]:break-words
            ${selectableClasses}
            ${selectedRing}
            ${isUser
              ? 'bg-primary/10 text-text-primary rounded-br-md'
              : 'bg-bg-secondary text-text-primary rounded-bl-md'}
          `}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-li:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                {message.content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse rounded-sm" />
              )}
            </div>
          )}

          {/* 출처 카드 — RAG 모드에서는 우측 패널이 대신 표시하므로 hideInlineSources 로 숨긴다 */}
          {!isUser && !hideInlineSources && message.sources && (
            <SourceCard sources={message.sources} />
          )}

          {/* 하단 액션 — 버블 onClick(선택 토글)과 충돌하지 않도록 stopPropagation */}
          {!isUser && !isStreaming && (
            <div className="flex justify-end gap-1 mt-1.5 -mr-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleCopy}
                className="
                  p-1 rounded text-text-secondary
                  hover:text-text-primary hover:bg-bg-tertiary
                  transition-colors
                "
                aria-label="복사"
              >
                {copied
                  ? <Check size={14} className="text-success" />
                  : <Copy size={14} />
                }
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 유저 아바타 */}
      {isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-1">
          <User size={14} className="text-primary" />
        </div>
      )}
    </div>
  );
}
