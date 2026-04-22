/**
 * @fileoverview 학습 워크스페이스 — 기록 탭 (그룹 C).
 * 내부에 세로 sub-탭 [오답노트 | 체크리스트 | 통계] 을 제공하고 각 패널을 렌더한다.
 * sub-탭은 URL/스토어까지 가지 않고 컴포넌트 로컬 state로 관리 (비교적 짧은 상태).
 */
import { useState } from 'react';
import { BookMarked, CheckSquare, BarChart3 } from 'lucide-react';
import WrongAnswerPanel from './WrongAnswerPanel';
import StudyChecklistPanel from './StudyChecklistPanel';
import StudyStatsTab from './StudyStatsTab';

const SUB_TABS = [
  { value: 'wrong', label: '오답노트', icon: BookMarked },
  { value: 'checklist', label: '체크리스트', icon: CheckSquare },
  { value: 'stats', label: '통계', icon: BarChart3 },
];

/** 기록 탭 — 세로 sub-탭 컨테이너. */
export default function StudyRecordTab() {
  const [subTab, setSubTab] = useState('wrong');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* sub-탭 바 */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border-light bg-bg-primary">
        {SUB_TABS.map(({ value, label, icon: Icon }) => {
          const active = subTab === value;
          return (
            <button
              key={value}
              onClick={() => setSubTab(value)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                ${active
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'}
              `}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {subTab === 'wrong' && <WrongAnswerPanel />}
          {subTab === 'checklist' && <StudyChecklistPanel />}
          {subTab === 'stats' && <StudyStatsTab />}
        </div>
      </div>
    </div>
  );
}
