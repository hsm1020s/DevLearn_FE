/**
 * @fileoverview 공부 모드 상단 서브 탭 바.
 * [💬 학습 채팅] [🎯 퀴즈] [📚 기록] 3개의 워크스페이스 탭을 제공하고,
 * 각 탭에 진행/미확인 뱃지를 노출한다. 탭 이동은 useAppStore.studySubTab으로만 관리.
 */
import { MessageCircle, Target, BookMarked } from 'lucide-react';
import useAppStore from '../../stores/useAppStore';
import useStudyStore from '../../stores/useStudyStore';

const TABS = [
  { value: 'chat', label: '학습 채팅', icon: MessageCircle },
  { value: 'quiz', label: '퀴즈', icon: Target },
  { value: 'record', label: '기록', icon: BookMarked },
];

/** 학습 워크스페이스 상단 탭 바 — 탭 뱃지로 진행중/미확인 수 표시. */
export default function StudySubTabs() {
  const studySubTab = useAppStore((s) => s.studySubTab);
  const setStudySubTab = useAppStore((s) => s.setStudySubTab);

  // 활성 과목 기준 진행/오답 뱃지
  const currentQuiz = useStudyStore((s) => s.subjects[s.activeSubject].currentQuiz);
  const currentQuestionIndex = useStudyStore((s) => s.subjects[s.activeSubject].currentQuestionIndex);
  const wrongAnswers = useStudyStore((s) => s.subjects[s.activeSubject].wrongAnswers);

  const total = currentQuiz?.questions?.length || 0;
  // 퀴즈 진행 뱃지: 세션 있으면 "● 7/15"
  const quizBadge = total > 0 ? `${currentQuestionIndex + 1}/${total}` : null;
  // 기록 뱃지: 오답 수
  const recordBadge = wrongAnswers.length > 0 ? String(wrongAnswers.length) : null;

  const getBadge = (value) => {
    if (value === 'quiz') return quizBadge;
    if (value === 'record') return recordBadge;
    return null;
  };

  return (
    <div
      role="tablist"
      className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border-light bg-bg-primary"
    >
      {TABS.map(({ value, label, icon: Icon }) => {
        const active = studySubTab === value;
        const badge = getBadge(value);
        const isProgress = value === 'quiz' && badge;
        return (
          <button
            key={value}
            role="tab"
            aria-selected={active}
            onClick={() => setStudySubTab(value)}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              text-sm font-medium transition-colors
              ${active
                ? 'bg-primary/10 text-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'}
            `}
          >
            <Icon size={16} />
            <span>{label}</span>
            {badge && (
              <span
                className={`
                  ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
                  text-[10px] font-semibold
                  ${isProgress
                    ? 'bg-warning/15 text-warning'
                    : 'bg-danger/10 text-danger'}
                `}
              >
                {isProgress && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                )}
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
