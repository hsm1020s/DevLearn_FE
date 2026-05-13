/**
 * @fileoverview 헤더(ModeHeader) 우측 LLM 사용 금액 표시 바 — 한 줄 인라인.
 *
 * 오늘 / 이번주 / 이번달 3영역, 각 칸은 "$USD / ₩KRW | 라벨" 형태 한 줄.
 * BE 가 환율을 곱해 함께 내려준 값을 그대로 표시. 마운트 시 1회 fetch,
 * 스트림 종료 후엔 외부에서 `useUsageStore.getState().refresh()` 가 호출된다.
 */
import { useEffect } from 'react';
import useUsageStore from '../../stores/useUsageStore';

/** USD 표시 — $X.XX. 미로드/NaN 대비 "—". */
function formatUsd(val) {
  if (val == null) return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (!Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

/** KRW 표시 — 천단위 콤마 + ₩. */
function formatKrw(val) {
  if (val == null) return '—';
  const n = typeof val === 'string' ? parseInt(val, 10) : val;
  if (!Number.isFinite(n)) return '—';
  return `₩${n.toLocaleString('ko-KR')}`;
}

/** 한 기간 칸: "$USD / ₩KRW | 라벨" 한 줄 인라인. */
function PeriodCell({ label, period }) {
  const usd = period ? formatUsd(period.costUsd) : '—';
  const krw = period ? formatKrw(period.costKrw) : '—';
  return (
    <span className="inline-flex items-center gap-1 text-[11px] whitespace-nowrap">
      <span className="font-medium text-text-primary">{usd}</span>
      <span className="text-text-tertiary">/</span>
      <span className="text-text-secondary">{krw}</span>
      <span className="text-border-light mx-1">|</span>
      <span className="text-text-tertiary">{label}</span>
    </span>
  );
}

/**
 * 헤더 우측 사용량 바 (한 줄).
 *
 * @param {object} [props]
 * @param {string} [props.className] - 외곽에 덧붙일 추가 클래스
 */
export default function ChatUsageBar({ className = '' }) {
  const summary = useUsageStore((s) => s.summary);
  const refresh = useUsageStore((s) => s.refresh);

  // 마운트 시 1회 fetch (헤더는 모드 전환 시 언마운트되지 않으므로 중복 호출 없음)
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div
      className={`hidden sm:flex items-center gap-3 ${className}`}
      title="오늘 / 이번주 / 이번달 LLM 사용 합계 (USD / KRW)"
    >
      <PeriodCell label="오늘" period={summary?.today} />
      <PeriodCell label="이번주" period={summary?.week} />
      <PeriodCell label="이번달" period={summary?.month} />
    </div>
  );
}
