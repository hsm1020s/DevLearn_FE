/**
 * @fileoverview 업무학습 모드 상단 서브 탭 바.
 * [💬 학습 채팅] [📝 업무노트] [✅ 체크리스트] 3개 탭을 제공한다.
 * 자격증 모드의 StudySubTabs와 달리 뱃지·드롭다운이 없어 훨씬 단순하다.
 */
import { MessageCircle, Notebook, CheckSquare } from 'lucide-react';
import useWorkLearnStore from '../../stores/useWorkLearnStore';

const TABS = [
  { value: 'chat', label: '학습 채팅', icon: MessageCircle },
  { value: 'note', label: '업무노트', icon: Notebook },
  { value: 'checklist', label: '체크리스트', icon: CheckSquare },
];

/**
 * 업무학습 서브 탭 바.
 * @param {object} props
 * @param {'chat'|'note'|'checklist'} props.value 현재 활성 탭
 * @param {(next:string) => void} props.onChange 탭 변경 콜백
 */
export default function WorkLearnSubTabs({ value, onChange }) {
  // 업무노트·체크리스트 수를 탭 옆에 조그만 뱃지로 노출해 사용자가 쌓인 양을 즉시 인지하도록.
  const noteCount = useWorkLearnStore((s) => s.notes.length);
  const checklistCount = useWorkLearnStore((s) => s.checklist.length);

  const countFor = (v) => (v === 'note' ? noteCount : v === 'checklist' ? checklistCount : 0);

  return (
    <div
      role="tablist"
      className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-border-light bg-bg-primary"
    >
      {TABS.map(({ value: v, label, icon: Icon }) => {
        const active = value === v;
        const count = countFor(v);
        return (
          <button
            key={v}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
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
            {count > 0 && (
              <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-bg-secondary text-text-secondary">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
