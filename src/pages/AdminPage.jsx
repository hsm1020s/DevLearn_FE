/**
 * @fileoverview 관리자 대시보드 페이지.
 * 서버 집계(GET /admin/dashboard)를 우선 표시하며, 실패 시 기존 로컬 스토어
 * (useChatStore/useDocStore/useMindmapStore/useStudyStore) 데이터로 폴백 렌더한다.
 * 진입 가드: isLoggedIn=false면 메인으로 리다이렉트한다. role 기반 가드는 Phase B에서 추가.
 */
import { useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  MessageSquare,
  Brain,
  TrendingUp,
  BookOpen,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import StatCard from '../components/admin/StatCard';
import RecentConversations from '../components/admin/RecentConversations';
import DocumentTable from '../components/admin/DocumentTable';
import DashboardSkeleton from '../components/admin/DashboardSkeleton';
import DashboardError from '../components/admin/DashboardError';
import useAdminDashboard from '../hooks/useAdminDashboard';
import useAuthStore from '../stores/useAuthStore';
// 폴백용 — 서버 호출 실패 시 로컬 스토어 집계를 사용한다
import useChatStore from '../stores/useChatStore';
import useStudyStore from '../stores/useStudyStore';
import useDocStore from '../stores/useDocStore';
import useMindmapStore from '../stores/useMindmapStore';

/** 관리자 대시보드 페이지 */
export default function AdminPage() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  // 서버 데이터 훅
  const { data, loading, error, refresh } = useAdminDashboard();

  // 폴백용 로컬 스토어 구독 (서버 실패 시에만 사용)
  const conversations = useChatStore((s) => s.conversations);
  const answers = useStudyStore((s) => s.answers);
  const docs = useDocStore((s) => s.docs);
  const maps = useMindmapStore((s) => s.maps);

  // 진입 가드: 비로그인 시 메인으로 리다이렉트 (Phase A — role 가드 미포함)
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/', { replace: true });
    }
  }, [isLoggedIn, navigate]);

  // 로컬 스토어 기반 폴백 집계 — 서버 데이터가 없을 때만 소비한다
  const fallbackCounts = useMemo(
    () => ({
      totalConversations: conversations.length,
      totalDocuments: docs.length,
      totalMindmapNodes: Object.values(maps).reduce(
        (s, m) => s + (m.nodes?.length || 0),
        0,
      ),
      totalQuizSolved: Object.keys(answers).length,
    }),
    [conversations, docs, maps, answers],
  );

  // 서버 우선, 실패/미도착 시 폴백 사용
  const counts = data?.counts ?? fallbackCounts;
  const recentConversations = data?.recentConversations ?? conversations.slice(0, 8);
  const documents = data?.documents ?? docs;

  // 카드 메타 구성 (서버 또는 폴백의 counts 값을 그대로 주입)
  const statCards = [
    { icon: MessageSquare, label: '총 대화', value: counts.totalConversations, color: 'bg-primary' },
    { icon: BookOpen, label: '업로드 문서', value: counts.totalDocuments, color: 'bg-success' },
    { icon: Brain, label: '마인드맵 노드', value: counts.totalMindmapNodes, color: 'bg-purple-500' },
    { icon: TrendingUp, label: '풀이한 문제', value: counts.totalQuizSolved, color: 'bg-danger' },
  ];

  // 최초 로딩 — 서버 데이터가 아직 없고 로딩 중이면 전체 스켈레톤
  if (loading && !data) {
    return (
      <div className="h-screen flex flex-col">
        <header className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border-light">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft size={18} /> 메인으로
            </Button>
            <h1 className="text-base font-semibold text-text-primary">관리자 대시보드</h1>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  // 서버 에러 + 폴백조차 유의미하지 않은 경우(= 아무 로컬 데이터도 없을 때)만 전체 에러 화면
  const hasAnyFallback =
    conversations.length > 0 || docs.length > 0 ||
    Object.keys(maps).length > 0 || Object.keys(answers).length > 0;

  if (error && !data && !hasAnyFallback) {
    return (
      <div className="h-screen flex flex-col">
        <header className="flex items-center gap-3 px-6 py-3 border-b border-border-light">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft size={18} /> 메인으로
          </Button>
          <h1 className="text-base font-semibold text-text-primary">관리자 대시보드</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <DashboardError message={error} onRetry={refresh} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border-light">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft size={18} /> 메인으로
          </Button>
          <h1 className="text-base font-semibold text-text-primary">관리자 대시보드</h1>
        </div>
        {/* 새로고침: 진행 중엔 비활성화 + 아이콘 회전 */}
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
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 서버 실패 + 폴백 데이터로 렌더 중일 때의 경고 배너 */}
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

          {/* 문서 현황 */}
          <section>
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
              문서 현황
            </h2>
            <div className="bg-bg-primary border border-border-light rounded-xl p-3">
              <DocumentTable documents={documents} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
