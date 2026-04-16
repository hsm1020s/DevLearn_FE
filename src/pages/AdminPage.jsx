/**
 * @fileoverview 관리자 대시보드 페이지.
 * 대화, 자격증, RAG 문서, 마인드맵 등 전체 사용 현황 통계를 표시한다.
 */
import { ArrowLeft, MessageSquare, FileText, Brain, Users, TrendingUp, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import useChatStore from '../stores/useChatStore';
import useCertStore from '../stores/useCertStore';
import useRagStore from '../stores/useRagStore';
import useMindmapStore from '../stores/useMindmapStore';

/** 통계 수치를 아이콘과 함께 표시하는 카드 */
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-bg-secondary">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-xs text-text-secondary mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/** 최근 대화 목록 (최대 8건) */
function RecentActivity({ conversations }) {
  if (conversations.length === 0) {
    return <p className="text-sm text-text-tertiary text-center py-6">대화 기록이 없습니다</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      {conversations.slice(0, 8).map((conv) => (
        <div key={conv.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg-secondary transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare size={14} className="text-text-tertiary shrink-0" />
            <span className="text-sm text-text-primary truncate">{conv.title}</span>
          </div>
          <span className="text-xs text-text-tertiary shrink-0 ml-2">{conv.mode}</span>
        </div>
      ))}
    </div>
  );
}

/** 관리자 대시보드 페이지 */
export default function AdminPage() {
  const navigate = useNavigate();
  const conversations = useChatStore((s) => s.conversations);
  const certDocs = useCertStore((s) => s.certDocs);
  const answers = useCertStore((s) => s.answers);
  const ragDocs = useRagStore((s) => s.ragDocs);
  const mindmapNodes = useMindmapStore((s) => s.nodes);

  const stats = [
    { icon: MessageSquare, label: '총 대화', value: conversations.length, color: 'bg-primary' },
    { icon: FileText, label: '자격증 교재', value: certDocs.length, color: 'bg-success' },
    { icon: BookOpen, label: 'RAG 문서', value: ragDocs.length, color: 'bg-warning' },
    { icon: Brain, label: '마인드맵 노드', value: mindmapNodes.length, color: 'bg-purple-500' },
    { icon: TrendingUp, label: '풀이한 문제', value: Object.keys(answers).length, color: 'bg-danger' },
  ];

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center gap-3 px-6 py-3 border-b border-border-light">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft size={18} /> 메인으로
        </Button>
        <h1 className="text-base font-semibold text-text-primary">관리자 대시보드</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 통계 카드 */}
          <section>
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
              사용 현황
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {stats.map((s) => (
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
              <RecentActivity conversations={conversations} />
            </div>
          </section>

          {/* RAG 문서 현황 */}
          <section>
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
              RAG 문서 현황
            </h2>
            <div className="bg-bg-primary border border-border-light rounded-xl p-3">
              {ragDocs.length === 0 ? (
                <p className="text-sm text-text-tertiary text-center py-6">업로드된 문서가 없습니다</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {ragDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg-secondary">
                      <span className="text-sm text-text-primary truncate">{doc.fileName}</span>
                      <span className={`text-xs ${doc.status === 'completed' ? 'text-success' : 'text-warning'}`}>
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
