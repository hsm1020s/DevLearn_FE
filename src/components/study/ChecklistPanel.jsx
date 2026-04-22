/**
 * @fileoverview 학습 체크리스트 패널 (그룹 C #30).
 * 교재별/챕터별 완료 체크박스를 제공하고 교재마다 진행률 %를 표시한다.
 * 체크 상태는 useStudyStore.checklist에 persist된다.
 */
import { BookOpen, CheckCircle2 } from 'lucide-react';
import useStudyStore from '../../stores/useStudyStore';

/** 교재/챕터 체크리스트 패널. 활성 과목의 체크리스트만 표시. */
export default function ChecklistPanel() {
  const checklist = useStudyStore((s) => s.subjects[s.activeSubject].checklist);
  const toggleChapter = useStudyStore((s) => s.toggleChecklistChapter);

  if (!checklist.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <BookOpen size={32} className="text-text-tertiary" />
        <p className="text-sm text-text-secondary">체크리스트가 비어있습니다</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {checklist.map((book) => {
        const total = book.chapters.length;
        const done = book.chapters.filter((c) => c.done).length;
        const rate = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <div
            key={book.id}
            className="flex flex-col gap-3 p-4 rounded-lg border border-border-light bg-bg-primary"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <BookOpen size={16} className="text-primary" />
                {book.title}
              </div>
              <span className="text-xs tabular-nums text-text-secondary">
                {done}/{total} ({rate}%)
              </span>
            </div>

            {/* 진행 바 */}
            <div className="h-1.5 rounded bg-bg-secondary">
              <div
                className="h-full rounded bg-primary transition-all"
                style={{ width: `${rate}%` }}
              />
            </div>

            {/* 챕터 체크박스 */}
            <div className="flex flex-col gap-1">
              {book.chapters.map((ch) => (
                <label
                  key={ch.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-secondary cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={ch.done}
                    onChange={() => toggleChapter(book.id, ch.id)}
                    className="w-4 h-4 rounded border-border-light accent-primary"
                  />
                  <span className={`text-sm ${ch.done ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>
                    {ch.label}
                  </span>
                  {ch.done && <CheckCircle2 size={14} className="text-success ml-auto" />}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
