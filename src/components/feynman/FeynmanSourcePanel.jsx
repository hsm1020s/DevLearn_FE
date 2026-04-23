/**
 * @fileoverview 파인만/자격증 RAG 채팅의 우측 출처 패널.
 *
 * 현재 활성 대화의 메시지 중, useChatStore.selectedMessageId 가 가리키는 메시지의
 * `sources` 배열을 상세히 표시한다. 선택값이 없으면 가장 최근 assistant 메시지의
 * 출처를 폴백으로 보여준다. 메시지 버블 클릭으로 선택이 바뀐다.
 *
 * RAG 모드(파인만/자격증 학습 doc 첨부 채팅)에서만 StudyChatTab 이 이 패널을
 * 렌더하며, 버블 내부의 인라인 SourceCard 는 그 경우 숨겨진다.
 */
import { FileText, Paperclip } from 'lucide-react';
import useChatStore from '../../stores/useChatStore';

/** 유사도 → Tailwind 배지 색상. 0.85 이상은 강한 강조. */
function similarityClass(sim) {
  if (sim == null) return 'bg-bg-tertiary text-text-tertiary';
  if (sim >= 0.85) return 'bg-success/10 text-success';
  if (sim >= 0.7) return 'bg-warning/10 text-warning';
  return 'bg-bg-tertiary text-text-secondary';
}

/**
 * 우측 출처 패널.
 * 외부에서 대화/메시지를 주입받지 않고 스토어에서 직접 구독한다 —
 * StudyChatTab 레이아웃을 단순하게 유지하기 위해 내부에서 상태를 구독.
 */
export default function FeynmanSourcePanel() {
  const conversations = useChatStore((s) => s.conversations);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const selectedMessageId = useChatStore((s) => s.selectedMessageId);

  const conv = conversations.find((c) => c.id === currentConversationId);
  const messages = conv?.messages ?? [];

  // 선택이 있으면 그 메시지, 없으면 최신 assistant 메시지 폴백.
  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const selected = selectedMessageId
    ? messages.find((m) => m.id === selectedMessageId)
    : assistantMessages[assistantMessages.length - 1];

  const sources = selected?.sources ?? [];

  return (
    <aside className="shrink-0 w-80 border-l border-border-light bg-bg-primary flex flex-col h-full">
      <header className="px-4 py-3 border-b border-border-light">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <FileText size={14} className="text-primary" />
          출처
        </h3>
        <p className="text-xs text-text-tertiary mt-0.5">
          {selectedMessageId ? '선택된 답변의 근거' : '가장 최근 답변의 근거'}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!selected && (
          <EmptyState label="아직 AI 답변이 없습니다." />
        )}
        {selected && sources.length === 0 && (
          <EmptyState label="이 답변에는 기록된 출처가 없습니다." />
        )}
        {selected && sources.length > 0 && (
          <ol className="flex flex-col gap-2">
            {sources.map((s, idx) => (
              <li key={idx}
                  className="rounded-lg border border-border-light bg-bg-secondary p-3 flex flex-col gap-1.5">
                <div className="flex items-start gap-2">
                  <Paperclip size={12} className="text-text-tertiary shrink-0 mt-0.5" />
                  <span className="text-sm text-text-primary break-all">{s.docName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-tertiary">
                  {s.page != null && <span>p.{s.page}</span>}
                  {s.similarity != null && (
                    <span className={`ml-auto px-1.5 py-0.5 rounded-full font-medium ${similarityClass(s.similarity)}`}>
                      {Math.round(s.similarity * 100)}%
                    </span>
                  )}
                </div>
                {(s.snippet || s.chunk) && (
                  <p className="text-xs text-text-secondary whitespace-pre-wrap break-words leading-relaxed line-clamp-6">
                    {s.snippet || s.chunk}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

function EmptyState({ label }) {
  return (
    <div className="h-full flex items-center justify-center px-6 text-center">
      <p className="text-xs text-text-tertiary">{label}</p>
    </div>
  );
}
