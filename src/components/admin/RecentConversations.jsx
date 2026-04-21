/**
 * @fileoverview 관리자 대시보드 최근 대화 목록.
 * 서버가 반환한 최근 대화 메타(id/title/mode/updatedAt)를 리스트로 렌더한다.
 * mode는 한글 라벨로 치환, updatedAt은 formatDate로 상대 시간 포맷한다.
 */
import { MessageSquare } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

/** 모드 키 → 한글 라벨 */
const MODE_LABELS = { general: '일반', study: '학습' };

/**
 * 최근 대화 목록 (최대 8건 권장, 상위 컴포넌트에서 slice)
 * @param {object} props
 * @param {Array<{id:string,title:string,mode:string,updatedAt:number|string}>} props.conversations
 */
export default function RecentConversations({ conversations }) {
  if (!conversations || conversations.length === 0) {
    return (
      <p className="text-sm text-text-tertiary text-center py-6">대화 기록이 없습니다</p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg-secondary transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare size={14} className="text-text-tertiary shrink-0" />
            <span className="text-sm text-text-primary truncate">{conv.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="text-xs text-text-tertiary">
              {MODE_LABELS[conv.mode] ?? conv.mode ?? '-'}
            </span>
            {conv.updatedAt && (
              <span className="text-xs text-text-tertiary">
                · {formatDate(conv.updatedAt)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
