/**
 * @fileoverview 파이프라인 탭 문서 행 안에 inline 으로 박히는 [지식 재구축] 진행 인디케이터.
 *
 * `useRebuildProgress` 훅이 반환하는 엔트리(또는 null) 를 props 로 받아
 * 진행 phase 별로 다른 한 줄을 그린다. null 이면 아무것도 렌더하지 않는다 — 부모가
 * 항상 마운트해도 빈 공간이 안 보이도록 설계.
 *
 * phase 별 표시:
 *  - wiping     : 회전 아이콘 + "재구축 준비 중..." (첫 폴링 응답 전)
 *  - generating : 진행 바(width=m/N*100%) + "마인드맵 재합성 중 — m/N 챕터 완료"
 *  - finalizing : 진행 바 100% + "면접 질문 합성 중... (~5초)"
 *  - done       : 부모가 곧 unmount 함 — 거의 보이지 않음. 안전을 위해 안 그림.
 */
import { RefreshCw } from 'lucide-react';

/**
 * @param {object} props
 * @param {{
 *   docId: string,
 *   mindmapsReady: number,
 *   totalChapters: number,
 *   phase: 'wiping' | 'generating' | 'finalizing' | 'done',
 * } | null} props.progress
 */
export default function RebuildProgressInline({ progress }) {
  if (!progress || progress.phase === 'done') return null;

  const { phase, mindmapsReady, totalChapters } = progress;
  const percent = totalChapters > 0
    ? Math.min(100, Math.round((mindmapsReady / totalChapters) * 100))
    : 0;

  let label;
  let fillPercent;
  if (phase === 'wiping') {
    label = '재구축 준비 중...';
    fillPercent = 0;
  } else if (phase === 'finalizing') {
    label = '면접 질문 합성 중... (~5초)';
    fillPercent = 100;
  } else {
    label = `마인드맵 재합성 중 — ${mindmapsReady}/${totalChapters} 챕터 완료`;
    fillPercent = percent;
  }

  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
      <RefreshCw size={12} className="shrink-0 animate-spin text-primary" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          {phase !== 'wiping' && (
            <span className="text-text-tertiary tabular-nums shrink-0">{fillPercent}%</span>
          )}
        </div>
        <div className="mt-1 h-1 w-full rounded-full bg-bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
