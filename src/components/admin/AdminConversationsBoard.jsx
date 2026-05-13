/**
 * @fileoverview 관리자 — 사용자 채팅 모니터링 보드.
 *
 * 검색바(debounce 300ms) + 모드/기간 토글 + 페이징 + 행 펼침으로 모든 사용자의 대화·메시지를
 * 들여다본다. BE 의 /api/admin/conversations 와 /messages 를 호출하며, 본문 fetch 는 행을
 * 펼칠 때 lazy 로 한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronRight, ChevronLeft, MessageSquare, RefreshCw, Search, User as UserIcon,
} from 'lucide-react';
import {
  listAdminConversations,
  fetchAdminConversationDetail,
} from '../../services/adminChatApi';
import Button from '../common/Button';

const MODE_OPTIONS = [
  { value: 'all',       label: '전체' },
  { value: 'general',   label: '일반' },
  { value: 'study',     label: '공부' },
  { value: 'worklearn', label: '업무학습' },
];

const PERIOD_OPTIONS = [
  { value: 'total', label: '전체 기간' },
  { value: 'today', label: '오늘' },
  { value: 'week',  label: '이번주' },
  { value: 'month', label: '이번달' },
];

const PAGE_SIZE = 20;

const MODE_LABELS = { general: '일반', study: '공부', worklearn: '업무학습' };

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
    }`}>{role}</span>
  );
}

/** 메시지 1건 — role 에 따라 좌/색상 다르게. */
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
      <span className="text-[10px] text-text-tertiary">
        {isUser ? '사용자' : '어시스턴트'} · {fmtDateTime(msg.createdAt)}
      </span>
      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap break-words
        ${isUser
          ? 'bg-primary/10 text-text-primary border border-primary/20'
          : 'bg-bg-secondary text-text-primary border border-border-light'}`}>
        {msg.content}
      </div>
    </div>
  );
}

/** 펼침 영역 — lazy 로딩, 결과 캐시. */
function ConversationDetailRow({ conversationId, detail, loading, error }) {
  if (loading) {
    return (
      <tr className="bg-bg-secondary/40">
        <td colSpan={6} className="px-3 py-4 text-xs text-text-tertiary text-center">불러오는 중…</td>
      </tr>
    );
  }
  if (error) {
    return (
      <tr className="bg-danger/5">
        <td colSpan={6} className="px-3 py-4 text-xs text-danger text-center">{error}</td>
      </tr>
    );
  }
  if (!detail || !detail.messages || detail.messages.length === 0) {
    return (
      <tr className="bg-bg-secondary/40">
        <td colSpan={6} className="px-3 py-4 text-xs text-text-tertiary text-center">메시지가 없습니다.</td>
      </tr>
    );
  }
  return (
    <tr className="bg-bg-secondary/40">
      <td colSpan={6} className="px-3 py-3">
        <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-2">
          {detail.messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
        </div>
      </td>
    </tr>
  );
}

export default function AdminConversationsBoard() {
  // 필터·검색
  const [qInput, setQInput] = useState('');     // 입력 raw
  const [q, setQ] = useState('');                // debounce 후 적용
  const [mode, setMode] = useState('all');
  const [period, setPeriod] = useState('total');
  const [page, setPage] = useState(0);

  // 목록
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 펼침
  const [expandedId, setExpandedId] = useState(null);
  const [detailMap, setDetailMap] = useState({}); // id → { detail, loading, error }
  const detailRef = useRef(detailMap);
  detailRef.current = detailMap;

  // q debounce — 300ms
  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  // 모드/기간 변경 시 페이지 0 으로 리셋
  useEffect(() => { setPage(0); }, [mode, period]);

  // 목록 fetch
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpandedId(null);
    try {
      const resp = await listAdminConversations({ q, mode, period, page, size: PAGE_SIZE });
      setList(resp);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [q, mode, period, page]);

  useEffect(() => { refresh(); }, [refresh]);

  // 행 클릭 → 펼침 토글 + lazy fetch
  const toggleExpand = useCallback(async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (detailRef.current[id]?.detail) return; // 캐시 hit
    setDetailMap((prev) => ({ ...prev, [id]: { loading: true } }));
    try {
      const detail = await fetchAdminConversationDetail(id);
      setDetailMap((prev) => ({ ...prev, [id]: { detail, loading: false } }));
    } catch (err) {
      setDetailMap((prev) => ({ ...prev, [id]: {
        loading: false,
        error: err?.response?.data?.message || err?.message || '대화 상세 조회 실패',
      } }));
    }
  }, [expandedId]);

  const totalPages = list?.totalPages ?? 0;
  const totalCount = list?.totalCount ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {/* 상단: 검색 + 모드 + 기간 + 새로고침 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="사용자/제목/본문 검색"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border-light bg-bg-primary
              text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
          />
        </div>

        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-md border border-border-light bg-bg-primary
            text-text-primary focus:outline-none focus:border-primary"
          title="모드 필터"
        >
          {MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-md border border-border-light bg-bg-primary
            text-text-primary focus:outline-none focus:border-primary"
          title="기간 필터"
        >
          {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          새로고침
        </Button>
      </div>

      {/* 본문 */}
      {error ? (
        <div className="px-3 py-6 text-sm text-danger text-center">오류: {error}</div>
      ) : loading && !list ? (
        <div className="px-3 py-6 text-sm text-text-tertiary text-center">불러오는 중…</div>
      ) : !list?.items || list.items.length === 0 ? (
        <div className="px-3 py-6 text-sm text-text-tertiary text-center flex flex-col items-center gap-2">
          <MessageSquare size={20} className="text-text-tertiary" />
          {q ? '검색 결과가 없습니다.' : '대화 기록이 없습니다.'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-tertiary text-xs border-b border-border-light">
                  <th className="px-3 py-2 text-left font-medium">사용자</th>
                  <th className="px-3 py-2 text-left font-medium">권한</th>
                  <th className="px-3 py-2 text-left font-medium">모드</th>
                  <th className="px-3 py-2 text-left font-medium">대화 제목</th>
                  <th className="px-3 py-2 text-right font-medium">메시지</th>
                  <th className="px-3 py-2 text-right font-medium">마지막</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((c) => {
                  const isOpen = expandedId === c.conversationId;
                  const det = detailMap[c.conversationId];
                  return (
                    <>
                      <tr
                        key={c.conversationId}
                        onClick={() => toggleExpand(c.conversationId)}
                        className="border-b border-border-light/60 hover:bg-bg-secondary/40 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            {isOpen
                              ? <ChevronDown size={12} className="text-text-tertiary shrink-0" />
                              : <ChevronRight size={12} className="text-text-tertiary shrink-0" />}
                            <UserIcon size={11} className="text-text-tertiary shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-text-primary text-sm leading-tight">{c.user?.name}</span>
                              <span className="text-[10px] text-text-tertiary leading-tight">{c.user?.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2"><RoleChip role={c.user?.role} /></td>
                        <td className="px-3 py-2 text-xs text-text-secondary">
                          {MODE_LABELS[c.mode] ?? c.mode ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-sm text-text-primary max-w-[320px] truncate" title={c.title}>
                          {c.title || '(제목 없음)'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{c.messageCount}</td>
                        <td className="px-3 py-2 text-right text-xs text-text-tertiary tabular-nums">
                          {fmtDateTime(c.lastMessageAt || c.updatedAt)}
                        </td>
                      </tr>
                      {isOpen && (
                        <ConversationDetailRow
                          conversationId={c.conversationId}
                          detail={det?.detail}
                          loading={det?.loading}
                          error={det?.error}
                        />
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이징 */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-text-tertiary">
              총 {totalCount.toLocaleString('ko-KR')}건 · {page + 1} / {Math.max(totalPages, 1)}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                className="gap-1"
              >
                <ChevronLeft size={13} /> 이전
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page + 1 >= totalPages || loading}
                className="gap-1"
              >
                다음 <ChevronRight size={13} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
