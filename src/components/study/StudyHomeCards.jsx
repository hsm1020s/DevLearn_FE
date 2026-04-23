/**
 * @fileoverview 학습 모드 빈 상태 런처 카드.
 * 채팅 탭이 비어있을 때 상단에 표시되는 3-카드(퀴즈/이해도 점검/복습).
 * 각 카드 클릭 시 해당 서브 탭 또는 채팅 스타일로 이동한다.
 */
import { Target, Brain, BookMarked } from 'lucide-react';
import useAppStore from '../../stores/useAppStore';
import useStudyStore from '../../stores/useStudyStore';
import { useActiveSubjectMeta } from '../../hooks/useActiveSubject';

const CARDS = [
  {
    id: 'quiz',
    icon: Target,
    title: '🎯 퀴즈 풀기',
    description: '4지선다·주관식·모의고사',
    subtitle: 'A그룹',
    action: { type: 'tab', value: 'quiz' },
  },
  {
    id: 'comprehend',
    icon: Brain,
    title: '🧠 이해도 점검',
    description: '파인만 기법으로 내 이해를 점검',
    subtitle: 'D그룹',
    action: { type: 'style', value: 'feynman' },
  },
  {
    id: 'record',
    icon: BookMarked,
    title: '📚 복습·기록',
    description: '오답노트 · 과목별 통계',
    subtitle: 'C그룹',
    action: { type: 'tab', value: 'record' },
  },
];

/** 학습 모드 빈 화면의 3개 기능 런처 카드. 상단에 현재 선택된 과목 안내 배너. */
export default function StudyHomeCards() {
  const setStudySubTab = useAppStore((s) => s.setStudySubTab);
  const setChatStyle = useStudyStore((s) => s.setChatStyle);
  const subjectMeta = useActiveSubjectMeta();

  const handleClick = (action) => {
    if (action.type === 'tab') {
      setStudySubTab(action.value);
    } else if (action.type === 'style') {
      // 스타일 카드 클릭 = 해당 스타일로 다음 턴 프리셋 설정 (채팅 탭은 그대로)
      setChatStyle(action.value);
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-center gap-2 text-xs text-text-secondary">
        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
          {subjectMeta.label}
        </span>
        <span>과목으로 학습 · 상단에서 과목 전환</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {CARDS.map(({ id, icon: Icon, title, description, subtitle, action }) => (
        <button
          key={id}
          onClick={() => handleClick(action)}
          className="
            group flex flex-col items-start gap-2 p-4 rounded-xl
            border border-border-light bg-bg-primary
            hover:border-primary/50 hover:bg-primary/5
            transition-all text-left
          "
        >
          <div className="flex items-center justify-between w-full">
            <Icon size={20} className="text-primary" />
            <span className="text-[10px] font-medium text-text-tertiary px-1.5 py-0.5 rounded bg-bg-secondary">
              {subtitle}
            </span>
          </div>
          <span className="text-sm font-semibold text-text-primary">{title}</span>
          <span className="text-xs text-text-secondary">{description}</span>
          {id === 'comprehend' && (
            <span className="mt-1 text-[11px] text-text-tertiary">
              클릭 시 파인만 스타일 프리셋 적용
            </span>
          )}
        </button>
      ))}
      </div>
    </div>
  );
}
