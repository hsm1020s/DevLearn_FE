/**
 * @fileoverview 개별 채팅 메시지 컴포넌트.
 * 사용자/어시스턴트 메시지를 구분하여 렌더링하고,
 * 어시스턴트 메시지는 마크다운 파싱, 출처 카드, 복사 기능, 학습 스타일 뱃지,
 * "한 줄 요약" 단축 액션을 제공한다.
 */
import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Copy, Check, Bot, User, Scissors } from 'lucide-react';
import SourceCard from './SourceCard';
import useAppStore from '../../stores/useAppStore';
import useStudyStore from '../../stores/useStudyStore';
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

/** 단일 채팅 메시지 버블. 역할(user/assistant)에 따라 스타일과 기능이 달라진다. */
export default function ChatMessage({ message, isStreaming }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const style = message.meta?.style;

  const mainMode = useAppStore((s) => s.mainMode);
  const setChatStyle = useStudyStore((s) => s.setChatStyle);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [message.content]);

  // "한 줄 요약" 단축 액션 — 학습 모드 어시스턴트 메시지에 노출.
  // 다음 턴에 summary 스타일을 켜두고, 사용자가 입력창에 바로 "요약해줘"를 쓸 수 있게 한다.
  const canSummarize = !isUser && !isStreaming && mainMode === 'study' && style !== 'summary';
  const handleSummarize = () => {
    setChatStyle('summary');
    // 입력창으로 포커스 이동은 ChatInput이 마운트되어 있으면 자연스럽게 다음 턴에 적용됨.
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* 어시스턴트 아바타 */}
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-1">
          <Bot size={14} className="text-primary" />
        </div>
      )}

      <div className="flex flex-col gap-1 max-w-[75%]">
        {/* 스타일 뱃지 — 메시지 버블 위에 표시 */}
        {style && style !== 'general' && (
          <div className={isUser ? 'self-end' : 'self-start'}>
            <StyleBadge style={style} />
          </div>
        )}

        <div className={`
          rounded-2xl px-4 py-2.5 text-sm leading-relaxed
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
            <div className="flex justify-end gap-1 mt-1.5 -mr-1">
              {canSummarize && (
                <button
                  onClick={handleSummarize}
                  className="
                    flex items-center gap-1 px-1.5 py-1 rounded text-[11px]
                    text-text-secondary hover:text-primary hover:bg-primary/10
                    transition-colors
                  "
                  title="다음 턴을 한 줄 요약 스타일로 전환"
                >
                  <Scissors size={12} />
                  요약 스타일
                </button>
              )}
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
