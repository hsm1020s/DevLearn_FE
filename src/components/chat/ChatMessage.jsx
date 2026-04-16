/**
 * @fileoverview 개별 채팅 메시지 컴포넌트
 * 사용자/어시스턴트 메시지를 구분하여 렌더링하고,
 * 어시스턴트 메시지는 마크다운 파싱, 출처 카드, 복사 기능을 제공한다.
 */
import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Copy, Check, Bot, User } from 'lucide-react';
import SourceCard from './SourceCard';

/** 단일 채팅 메시지 버블. 역할(user/assistant)에 따라 스타일과 기능이 달라진다. */
export default function ChatMessage({ message, isStreaming }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  // 메시지 내용을 클립보드에 복사하고 2초간 완료 표시
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [message.content]);

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* 어시스턴트 아바타 */}
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-1">
          <Bot size={14} className="text-primary" />
        </div>
      )}

      <div className={`
        max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
        ${isUser
          ? 'bg-primary/10 text-text-primary rounded-br-md'
          : 'bg-bg-secondary text-text-primary rounded-bl-md'}
      `}>
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

        {/* 출처 카드 */}
        {!isUser && message.sources && (
          <SourceCard sources={message.sources} />
        )}

        {/* 하단 액션 */}
        {!isUser && !isStreaming && (
          <div className="flex justify-end mt-1.5 -mr-1">
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

      {/* 유저 아바타 */}
      {isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-1">
          <User size={14} className="text-primary" />
        </div>
      )}
    </div>
  );
}
