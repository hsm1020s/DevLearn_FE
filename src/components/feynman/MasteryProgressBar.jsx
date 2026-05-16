/**
 * @fileoverview 파인만 채팅 헤더 아래에 표시되는 챕터 마스터리 진행 바.
 *
 * BE 가 SSE done 페이로드에 동봉하는 progress({total, mastered, complete, currentNodeLabel}) 를
 * 시각화한다. 폴백 챕터(total=0) 인 경우 호출처에서 progress=null 로 전달해 비표시 처리.
 */

import { Trophy } from 'lucide-react';

/**
 * @param {object} props
 * @param {{total:number, mastered:number, complete:boolean, currentNodeLabel:?string} | null} props.progress
 */
export default function MasteryProgressBar({ progress }) {
  if (!progress) return null;
  const { total, mastered, complete, currentNodeLabel } = progress;
  const pct = total > 0 ? Math.min(100, Math.round((mastered / total) * 100)) : 0;
  const remaining = Math.max(0, total - mastered);
  const barClass = complete ? 'bg-success' : 'bg-primary';

  return (
    <div className="px-4 py-2 border-b border-border-light bg-bg-secondary/50 shrink-0">
      <div className="flex items-center gap-2 text-xs">
        {complete ? (
          <>
            <Trophy size={12} className="text-success" />
            <span className="font-medium text-text-primary">
              🎉 챕터 마스터 ({total}/{total})
            </span>
          </>
        ) : (
          <>
            <span className="font-medium text-text-primary whitespace-nowrap">
              {mastered}/{total} 노드 통과
            </span>
            {/* 잔여 면접질문 개수 — 사용자가 직접 빼지 않아도 한눈에 보이게 */}
            <span className="text-text-secondary whitespace-nowrap">
              · 남은 질문 {remaining}개
            </span>
            {currentNodeLabel && (
              <span className="text-text-tertiary truncate" title={currentNodeLabel}>
                · 현재: {currentNodeLabel}
              </span>
            )}
            <span className="ml-auto text-text-tertiary whitespace-nowrap">{pct}%</span>
          </>
        )}
      </div>
      <div className="mt-1 h-1 rounded-full bg-bg-tertiary overflow-hidden">
        <div
          className={`h-full ${barClass} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
