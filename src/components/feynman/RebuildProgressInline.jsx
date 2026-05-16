/**
 * @fileoverview 파이프라인 탭 문서 행 안에 inline 으로 박히는 [지식 재구축] 진행 인디케이터.
 *
 * useRebuildProgress 훅이 반환하는 엔트리(또는 null) 를 props 로 받아 phase 별로 한 줄을 그린다.
 * null 이면 렌더 안 함. 본 태스크에서는 phase 가 두 단계(generating/finalizing) 로 명확히 구분되어
 * "마인드맵 진행률" 과 "면접 질문 진행률" 을 거짓 없이 보여준다.
 *
 * phase 별 표시:
 *  - wiping     : 회전 아이콘 + "재구축 준비 중..." (첫 폴링 응답 전 / totalChapters=0)
 *  - generating : 진행 바(width=mindmapsReady/total*100%) + "마인드맵 재합성 중 — m/N 챕터"
 *  - finalizing : 진행 바(width=questionsReady/total*100%) + "면접 질문 합성 중 — m/N 챕터"
 *  - done       : 부모가 곧 unmount — 거의 보이지 않음. 안전을 위해 안 그림.
 */
import { RefreshCw } from 'lucide-react';

/**
 * @param {object} props
 * @param {{
 *   docId: string,
 *   totalChapters: number,
 *   mindmapsReady: number,
 *   questionsReady: number,
 *   phase: 'wiping' | 'generating' | 'finalizing' | 'done',
 * } | null} props.progress
 */
export default function RebuildProgressInline({ progress }) {
  if (!progress || progress.phase === 'done') return null;

  const { phase, totalChapters, mindmapsReady, questionsReady } = progress;

  let label;
  let m;
  let n = totalChapters;
  if (phase === 'wiping') {
    label = '재구축 준비 중...';
    m = 0;
    n = 0;
  } else if (phase === 'finalizing') {
    label = `면접 질문 합성 중 — ${questionsReady}/${totalChapters} 챕터`;
    m = questionsReady;
  } else {
    // generating (마인드맵 합성 중)
    label = `마인드맵 재합성 중 — ${mindmapsReady}/${totalChapters} 챕터`;
    m = mindmapsReady;
  }

  const percent = n > 0 ? Math.min(100, Math.round((m / n) * 100)) : 0;

  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
      <RefreshCw size={12} className="shrink-0 animate-spin text-primary" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          {phase !== 'wiping' && (
            <span className="text-text-tertiary tabular-nums shrink-0">{percent}%</span>
          )}
        </div>
        <div className="mt-1 h-1 w-full rounded-full bg-bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
