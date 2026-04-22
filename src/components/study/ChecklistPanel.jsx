/**
 * @fileoverview 체크리스트 패널 — 교재/프로젝트 단위의 챕터 완료 체크 UI.
 *
 * 자격증 학습 모드와 업무학습 모드에서 공유된다. 데이터 소스가 서로 다르므로
 * 스토어에 직접 접근하지 않고 prop으로 주입받는다. 완료/전체 카운트 + 진행 바 +
 * 챕터별 체크박스까지 순수 프레젠테이션 컴포넌트로 유지한다.
 *
 * 필요 시 우측에 "삭제" 같은 관리 액션을 꽂을 수 있도록 `renderProjectActions`
 * 슬롯을 노출한다(업무학습의 사용자 정의 체크리스트에서 사용).
 */
import { BookOpen, CheckCircle2 } from 'lucide-react';

/**
 * 체크리스트 프레젠테이션 컴포넌트.
 * @param {object} props
 * @param {Array<{id:string,title:string,chapters:Array<{id:string,label:string,done:boolean}>}>} props.items
 *   프로젝트/교재 배열. 각 프로젝트는 `chapters` 배열을 포함한다.
 * @param {(projectId:string, chapterId:string) => void} props.onToggleChapter 챕터 완료 토글 핸들러
 * @param {(project:object) => import('react').ReactNode} [props.renderProjectActions]
 *   프로젝트 헤더 우측 액션 슬롯 (예: 삭제 버튼). 없으면 렌더하지 않음.
 * @param {(project:object) => import('react').ReactNode} [props.renderProjectFooter]
 *   프로젝트 카드 하단에 붙는 액션 슬롯 (예: 항목 추가 입력).
 * @param {import('react').ReactNode} [props.emptyFallback] 비어있을 때 표시할 fallback UI
 * @param {import('react').ReactNode} [props.footer] 마지막 프로젝트 카드 아래에 렌더할 요소(예: 프로젝트 추가 버튼)
 */
export default function ChecklistPanel({
  items,
  onToggleChapter,
  renderProjectActions,
  renderProjectFooter,
  emptyFallback,
  footer,
}) {
  if (!items || !items.length) {
    // 기본 빈 상태 — 호출부에서 커스텀 안내가 필요하면 emptyFallback으로 덮는다.
    return (
      <div className="flex flex-col gap-4">
        {emptyFallback ?? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <BookOpen size={32} className="text-text-tertiary" />
            <p className="text-sm text-text-secondary">체크리스트가 비어있습니다</p>
          </div>
        )}
        {footer}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((book) => {
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
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-text-secondary">
                  {done}/{total} ({rate}%)
                </span>
                {renderProjectActions?.(book)}
              </div>
            </div>

            {/* 진행 바 */}
            <div className="h-1.5 rounded bg-bg-secondary">
              <div
                className="h-full rounded bg-primary transition-all"
                style={{ width: `${rate}%` }}
              />
            </div>

            {/* 챕터 체크박스 — 비어있으면 안내 메시지 */}
            {book.chapters.length === 0 ? (
              <p className="text-xs text-text-tertiary px-2 py-1">항목이 없습니다</p>
            ) : (
              <div className="flex flex-col gap-1">
                {book.chapters.map((ch) => (
                  <label
                    key={ch.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-secondary cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={ch.done}
                      onChange={() => onToggleChapter(book.id, ch.id)}
                      className="w-4 h-4 rounded border-border-light accent-primary"
                    />
                    <span className={`text-sm ${ch.done ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>
                      {ch.label}
                    </span>
                    {ch.done && <CheckCircle2 size={14} className="text-success ml-auto" />}
                  </label>
                ))}
              </div>
            )}

            {renderProjectFooter?.(book)}
          </div>
        );
      })}
      {footer}
    </div>
  );
}
