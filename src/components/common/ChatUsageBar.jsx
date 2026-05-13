/**
 * @fileoverview 채팅 입력창 위 LLM 사용 금액 표시 바.
 *
 * 오늘 / 이번주 / 이번달 3영역, 각 칸에 USD(굵게) + KRW(가늘게) 두 줄. BE 가 환율을 곱해
 * 함께 내려준 값을 그대로 표시. 마운트 시 1회 fetch, 스트림 종료 후엔 외부에서
 * `useUsageStore.getState().refresh()` 가 호출된다.
 *
 * 일반 채팅(ChatContainer), 학습 모드의 일반 패널(GeneralChatPane), 파인만 패널(FeynmanChatPane)
 * 의 ChatInput 직전에 삽입.
 */
import { useEffect } from 'react';
import useUsageStore from '../../stores/useUsageStore';

/** USD 표시 — 단위 $, 소수 2자리. 0.001 보다 작아도 $0.00 으로 표시. */
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

/** 한 기간 칸: 라벨 + USD + KRW 3줄. */
function PeriodCell({ label, period }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 min-w-[80px]">
      <span className="text-[10px] text-text-tertiary leading-none">{label}</span>
      <span className="text-[12px] font-medium text-text-primary leading-tight">
        {period ? formatUsd(period.costUsd) : '—'}
      </span>
      <span className="text-[10px] text-text-secondary leading-none">
        {period ? formatKrw(period.costKrw) : '—'}
      </span>
    </div>
  );
}

/**
 * 채팅 사용량 바.
 *
 * @param {object} [props]
 * @param {string} [props.className] - 외곽 컨테이너에 덧붙일 추가 클래스
 */
export default function ChatUsageBar({ className = '' }) {
  const summary = useUsageStore((s) => s.summary);
  const refresh = useUsageStore((s) => s.refresh);

  // 마운트 시 1회 fetch (이미 summary 있어도 새 화면이라 최신화)
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div
      className={`flex items-center justify-end gap-1 px-3 py-1.5 text-text-secondary ${className}`}
      title="오늘 / 이번주 / 이번달 LLM 사용 합계 (USD · KRW)"
    >
      <PeriodCell label="오늘" period={summary?.today} />
      <span className="text-border-light">·</span>
      <PeriodCell label="이번주" period={summary?.week} />
      <span className="text-border-light">·</span>
      <PeriodCell label="이번달" period={summary?.month} />
    </div>
  );
}
