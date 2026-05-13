/**
 * @fileoverview 관리자 대시보드 페이지 — 좌측 탭 메뉴 + 우측 컨텐츠 레이아웃.
 *
 * 한 화면에 모든 섹션을 위→아래로 쌓던 기존 단일 컬럼 구조를, 좌측 탭(`<nav>`) +
 * 우측 메인 영역(`<main>`) 2분할로 재구성한다. 데이터 흐름과 자식 컴포넌트는
 * 그대로(`StatCard`/`RecentConversations`/`DocumentTable`/`AdminUsageBoard`/
 * `AdminConversationsBoard`/`SuggestionsBoard`) — 레이아웃만 변경한다.
 *
 * 탭 구성:
 *  - dashboard : 사용 현황(StatCards) + 최근 대화 (개요 페이지)
 *  - documents : 문서 현황
 *  - usage     : LLM 사용량
 *  - chats     : 사용자 채팅
 *  - suggestions : 기능개선 제안
 *
 * URL 동기화(/admin/usage 등 라우팅 매핑)는 이번 PR 의 스코프 밖. 새로고침 시
 * dashboard 로 돌아간다.
 *
 * 서버 집계(GET /admin/dashboard)를 우선 표시하며, 실패 시 기존 로컬 스토어
 * (useChatStore/useMindmapStore/useStudyStore) 데이터로 폴백 렌더한다.
 * 진입 가드: isLoggedIn=false 거나 role !== 'ADMIN' 이면 메인으로 리다이렉트.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ArrowLeft,
  MessageSquare,
  Brain,
  TrendingUp,
  BookOpen,
  RefreshCw,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  LayoutDashboard,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import StatCard from '../components/admin/StatCard';
import RecentConversations from '../components/admin/RecentConversations';
import DocumentTable from '../components/admin/DocumentTable';
import DashboardSkeleton from '../components/admin/DashboardSkeleton';
import DashboardError from '../components/admin/DashboardError';
import SuggestionsBoard from '../components/admin/SuggestionsBoard';
import AdminUsageBoard from '../components/admin/AdminUsageBoard';
import AdminConversationsBoard from '../components/admin/AdminConversationsBoard';
import useAdminDashboard from '../hooks/useAdminDashboard';
import useAuthStore from '../stores/useAuthStore';
import { listAdminSuggestions } from '../services/suggestionApi';
// 폴백용 — 서버 호출 실패 시 로컬 스토어 집계를 사용한다
import useChatStore from '../stores/useChatStore';
import useStudyStore from '../stores/useStudyStore';
import useMindmapStore from '../stores/useMindmapStore';

/** 탭 메타 — id 는 URL 동기화 도입 시 path 로도 쓸 수 있도록 케밥/소문자로 둔다. */
const TABS = [
  { id: 'dashboard', label: '개요', icon: LayoutDashboard },
  { id: 'documents', label: '문서 현황', icon: BookOpen },
  { id: 'usage', label: 'LLM 사용량', icon: BarChart3 },
  { id: 'chats', label: '사용자 채팅', icon: MessageSquare },
  { id: 'suggestions', label: '기능개선 제안', icon: Lightbulb },
];

/**
 * 좌측 탭 nav. 데스크톱(md 이상) 에서는 세로 컬럼, 모바일에서는 가로 스크롤 바.
 * 활성 탭 표시는 좌측 2px primary 보더 + 배경 강조로 통일.
 */
function AdminTabsNav({ activeTab, onSelect }) {
  return (
    <nav
      className="
        shrink-0 border-border-light
        md:w-56 md:border-r md:py-4
        flex md:flex-col overflow-x-auto md:overflow-x-visible
        border-b md:border-b-0
        bg-bg-primary
      "
      aria-label="관리자 메뉴"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap
              transition-colors
              md:border-l-2
              ${isActive
                ? 'bg-bg-secondary text-text-primary font-medium md:border-primary'
                : 'text-text-secondary hover:bg-bg-secondary/50 md:border-transparent'}
            `}
          >
            <Icon size={15} className="shrink-0" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** 관리자 대시보드 페이지 */
export default function AdminPage() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  // 활성 탭. URL 동기화는 이번 PR 스코프 밖.
  const [activeTab, setActiveTab] = useState('dashboard');

  // 서버 데이터 훅
  const { data, loading, error, refresh } = useAdminDashboard();

  // 폴백용 로컬 스토어 구독 (서버 실패 시에만 사용)
  const conversations = useChatStore((s) => s.conversations);
  // 과목 축 도입 후: 모든 과목 버킷의 answers를 합산해 폴백 카운트에 사용.
  // v8 마이그레이션에서 subjects 필드가 제거되어 초기 상태에서는 undefined 이므로 빈 객체로 폴백한다.
  const allSubjects = useStudyStore((s) => s.subjects) ?? {};
  const answerCount = useMemo(
    () => Object.values(allSubjects).reduce((n, b) => n + Object.keys(b?.answers || {}).length, 0),
    [allSubjects],
  );
  const maps = useMindmapStore((s) => s.maps);

  const userRole = useAuthStore((s) => s.user?.role);

  // 진입 가드: 비로그인 또는 ADMIN이 아니면 메인으로 리다이렉트
  useEffect(() => {
    if (!isLoggedIn || userRole !== 'ADMIN') {
      navigate('/', { replace: true });
    }
  }, [isLoggedIn, userRole, navigate]);

  // 기능개선 제안 — 관리자 전용 게시판. 대시보드와 별개로 비동기 로드.
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);

  const refreshSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const list = await listAdminSuggestions();
      setSuggestions(list);
    } catch (err) {
      setSuggestionsError(err?.response?.data?.message || err?.message || '알 수 없는 오류');
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && userRole === 'ADMIN') refreshSuggestions();
  }, [isLoggedIn, userRole, refreshSuggestions]);

  // 로컬 스토어 기반 폴백 집계 — 서버 데이터가 없을 때만 소비한다.
  // useDocStore가 제거된 이후 문서 수는 서버 응답이 있을 때만 의미를 가지므로 폴백은 0.
  const fallbackCounts = useMemo(
    () => ({
      totalConversations: conversations.length,
      totalDocuments: 0,
      totalMindmapNodes: Object.values(maps).reduce(
        (s, m) => s + (m.nodes?.length || 0),
        0,
      ),
      totalQuizSolved: answerCount,
    }),
    [conversations, maps, answerCount],
  );

  // 서버 우선, 실패/미도착 시 폴백 사용
  const counts = data?.counts ?? fallbackCounts;
  const recentConversations = data?.recentConversations ?? conversations.slice(0, 8);
  const documents = data?.documents ?? [];

  // 카드 메타 구성 (서버 또는 폴백의 counts 값을 그대로 주입)
  const statCards = [
    { icon: MessageSquare, label: '총 대화', value: counts.totalConversations, color: 'bg-primary' },
    { icon: BookOpen, label: '업로드 문서', value: counts.totalDocuments, color: 'bg-success' },
    { icon: Brain, label: '마인드맵 노드', value: counts.totalMindmapNodes, color: 'bg-purple-500' },
    { icon: TrendingUp, label: '풀이한 문제', value: counts.totalQuizSolved, color: 'bg-danger' },
  ];

  // 서버 에러 + 폴백조차 유의미하지 않은 경우(= 아무 로컬 데이터도 없을 때)만 우측 영역에 에러 화면.
  const hasAnyFallback =
    conversations.length > 0 || documents.length > 0 ||
    Object.keys(maps).length > 0 || answerCount > 0;

  /**
   * 현재 활성 탭의 우측 메인 컨텐츠를 렌더한다.
   * 데이터 로딩/에러 분기는 dashboard 탭에서만 의미가 있고, 다른 탭의 컴포넌트들은
   * 각자 내부적으로 데이터 페치 + 로딩/에러를 처리하므로 그대로 마운트한다.
   */
  const renderTabContent = () => {
    if (activeTab === 'dashboard') {
      // dashboard 자체가 로딩 중(서버 첫 응답 대기) → 스켈레톤
      if (loading && !data) return <DashboardSkeleton />;
      // 서버 실패 + 폴백조차 없는 빈 환경 → 에러 + 재시도
      if (error && !data && !hasAnyFallback) {
        return <DashboardError message={error} onRetry={refresh} />;
      }
      return (
        <div className="space-y-6">
          {/* 서버 실패 + 폴백 데이터로 렌더 중일 때만 노출되는 경고 배너 */}
          {error && !data && hasAnyFallback && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border-light bg-bg-secondary">
              <AlertTriangle size={16} className="text-warning shrink-0" />
              <p className="text-xs text-text-secondary flex-1">
                서버 지표를 불러오지 못해 로컬 저장 데이터로 표시 중입니다. ({error})
              </p>
              <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
                다시 시도
              </Button>
            </div>
          )}

          {/* 통계 카드 */}
          <section>
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
              사용 현황
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {statCards.map((s) => (
                <StatCard key={s.label} {...s} />
              ))}
            </div>
          </section>

          {/* 최근 대화 */}
          <section>
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
              최근 대화
            </h2>
            <div className="bg-bg-primary border border-border-light rounded-xl p-3">
              <RecentConversations conversations={recentConversations.slice(0, 8)} />
            </div>
          </section>
        </div>
      );
    }

    if (activeTab === 'documents') {
      return (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            문서 현황
          </h2>
          <div className="bg-bg-primary border border-border-light rounded-xl p-3">
            <DocumentTable documents={documents} />
          </div>
        </section>
      );
    }

    if (activeTab === 'usage') {
      return (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <BarChart3 size={14} />
            LLM 사용량
          </h2>
          <div className="bg-bg-secondary/40 border border-border-light rounded-xl p-3">
            <AdminUsageBoard />
          </div>
        </section>
      );
    }

    if (activeTab === 'chats') {
      return (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <MessageSquare size={14} />
            사용자 채팅
            <span className="ml-1 text-[10px] font-normal text-text-tertiary">
              관리자 전용 · 사용자 채팅 본문이 표시됩니다
            </span>
          </h2>
          <div className="bg-bg-secondary/40 border border-border-light rounded-xl p-3">
            <AdminConversationsBoard />
          </div>
        </section>
      );
    }

    if (activeTab === 'suggestions') {
      return (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb size={14} />
              기능개선 제안
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshSuggestions}
              disabled={suggestionsLoading}
              className="gap-1.5"
            >
              <RefreshCw size={13} className={suggestionsLoading ? 'animate-spin' : ''} />
              새로고침
            </Button>
          </div>
          <div className="bg-bg-secondary/40 border border-border-light rounded-xl p-3">
            <SuggestionsBoard
              suggestions={suggestions}
              loading={suggestionsLoading}
              error={suggestionsError}
            />
          </div>
        </section>
      );
    }

    return null;
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border-light">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft size={18} /> 메인으로
          </Button>
          <h1 className="text-base font-semibold text-text-primary">관리자 대시보드</h1>
        </div>
        {/* 새로고침 — dashboard 탭에서만 의미가 있어 그때만 노출 */}
        {activeTab === 'dashboard' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            새로고침
          </Button>
        )}
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <AdminTabsNav activeTab={activeTab} onSelect={setActiveTab} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {renderTabContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
