/**
 * @fileoverview 관리자 화면용 LLM 사용량 대시보드.
 *
 * 기간 토글(오늘/주/달/전체) + 사용자별 표 + 행 펼침으로 모델별 분해 표시.
 * BE 의 GET /api/admin/usage 응답을 그대로 렌더링 — USD/KRW 모두 BE 가 계산해서 내려준다.
 *
 * 사용자별 행은 비용 내림차순(BE 정렬). 사용 기록이 0인 사용자는 응답에 포함되지 않음(INNER JOIN).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { getAdminUsage } from '../../services/usageApi';
import Button from '../common/Button';

/** 기간 토글 옵션 */
const PERIOD_OPTIONS = [
  { value: 'today', label: '오늘' },
  { value: 'week',  label: '이번주' },
  { value: 'month', label: '이번달' },
  { value: 'total', label: '전체' },
];

/** USD — $X.XX */
function fmtUsd(v) {
  if (v == null) return '$0.00';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '$0.00';
}

/** KRW — ₩1,234 */
function fmtKrw(v) {
  if (v == null) return '₩0';
  const n = typeof v === 'string' ? parseInt(v, 10) : v;
  return Number.isFinite(n) ? `₩${n.toLocaleString('ko-KR')}` : '₩0';
}

/** 토큰 — 1,234 */
function fmtTokens(v) {
  if (v == null) return '0';
  const n = typeof v === 'string' ? parseInt(v, 10) : v;
  return Number.isFinite(n) ? n.toLocaleString('ko-KR') : '0';
}

/** ISO/Date → 'yyyy-MM-dd HH:mm' */
function fmtDateTime(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** role 칩 */
function RoleChip({ role }) {
  const isAdmin = role === 'ADMIN';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
      isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
    }`}>
      {role}
    </span>
  );
}

/** 모델별 분해 펼침 행. */
function ModelBreakdownRow({ models }) {
  if (!models || models.length === 0) {
    return (
      <tr>
        <td colSpan={7} className="px-3 py-2 text-xs text-text-tertiary text-center">
          모델별 기록 없음
        </td>
      </tr>
    );
  }
  return models.map((m) => (
    <tr key={m.model} className="bg-bg-secondary/40">
      <td className="px-3 py-1.5 pl-10 text-xs text-text-secondary">{m.model}</td>
      <td className="px-3 py-1.5"></td>
      <td className="px-3 py-1.5 text-xs text-right tabular-nums">{fmtTokens(m.inputTokens)}</td>
      <td className="px-3 py-1.5 text-xs text-right tabular-nums">{fmtTokens(m.outputTokens)}</td>
      <td className="px-3 py-1.5 text-xs text-right tabular-nums">{fmtUsd(m.costUsd)}</td>
      <td className="px-3 py-1.5 text-xs text-right tabular-nums">{fmtKrw(m.costKrw)}</td>
      <td className="px-3 py-1.5 text-xs text-right tabular-nums text-text-tertiary">{fmtTokens(m.calls)}회</td>
    </tr>
  ));
}

/**
 * 관리자 LLM 사용량 대시보드.
 */
export default function AdminUsageBoard() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedUserId, setExpandedUserId] = useState(null);

  const refresh = useCallback(async (p = period) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getAdminUsage(p);
      setData(resp);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    refresh(period);
    // refresh 가 period 에 의존하므로 deps 에서 제외 (무한 루프 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const totalLabel = useMemo(() => {
    const opt = PERIOD_OPTIONS.find((o) => o.value === period);
    return opt ? opt.label : '이번달';
  }, [period]);

  return (
    <div className="flex flex-col gap-3">
      {/* 상단: 기간 토글 + 새로고침 + 합계 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                period === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-bg-primary text-text-secondary hover:bg-bg-tertiary border border-border-light'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refresh(period)}
            disabled={loading}
            className="gap-1.5 ml-1"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            새로고침
          </Button>
        </div>

        <div className="text-xs text-text-secondary">
          <span className="font-medium">{totalLabel}</span> 총{' '}
          <span className="font-semibold text-text-primary">{fmtUsd(data?.totalCostUsd)}</span>{' '}
          / <span className="font-semibold text-text-primary">{fmtKrw(data?.totalCostKrw)}</span>
          {data?.users && ` · 활성 사용자 ${data.users.length}명`}
        </div>
      </div>

      {/* 본문 */}
      {error ? (
        <div className="px-3 py-6 text-sm text-danger text-center">
          오류: {error}
        </div>
      ) : loading && !data ? (
        <div className="px-3 py-6 text-sm text-text-tertiary text-center">
          불러오는 중…
        </div>
      ) : !data?.users || data.users.length === 0 ? (
        <div className="px-3 py-6 text-sm text-text-tertiary text-center flex flex-col items-center gap-2">
          <BarChart3 size={20} className="text-text-tertiary" />
          기간 내 LLM 사용 기록이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-tertiary text-xs border-b border-border-light">
                <th className="px-3 py-2 text-left font-medium">사용자</th>
                <th className="px-3 py-2 text-left font-medium">권한</th>
                <th className="px-3 py-2 text-right font-medium">입력</th>
                <th className="px-3 py-2 text-right font-medium">출력</th>
                <th className="px-3 py-2 text-right font-medium">USD</th>
                <th className="px-3 py-2 text-right font-medium">KRW</th>
                <th className="px-3 py-2 text-right font-medium">마지막</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => {
                const isExpanded = expandedUserId === u.userId;
                return (
                  <>
                    <tr
                      key={u.userId}
                      onClick={() => setExpandedUserId(isExpanded ? null : u.userId)}
                      className="border-b border-border-light/60 hover:bg-bg-secondary/40 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {isExpanded
                            ? <ChevronDown size={12} className="text-text-tertiary shrink-0" />
                            : <ChevronRight size={12} className="text-text-tertiary shrink-0" />}
                          <div className="flex flex-col">
                            <span className="text-text-primary text-sm leading-tight">{u.name}</span>
                            <span className="text-[10px] text-text-tertiary leading-tight">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2"><RoleChip role={u.role} /></td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{fmtTokens(u.inputTokens)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{fmtTokens(u.outputTokens)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtUsd(u.costUsd)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtKrw(u.costKrw)}</td>
                      <td className="px-3 py-2 text-right text-xs text-text-tertiary tabular-nums">{fmtDateTime(u.lastUsedAt)}</td>
                    </tr>
                    {isExpanded && <ModelBreakdownRow key={`${u.userId}-models`} models={u.byModel} />}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
