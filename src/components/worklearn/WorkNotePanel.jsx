/**
 * @fileoverview 업무노트 패널 — 카드 리스트 + 태그 필터 + 추가/편집/삭제.
 *
 * 삭제는 CLAUDE.md 규칙대로 팝오버 확인. 카드 클릭 시 편집 모달이 바로 뜨도록 해
 * "보기→편집"의 별도 화면 이동을 생략한다(업무노트는 길이가 짧은 경우가 많음).
 * 본문 마크다운은 카드에서는 3줄까지 clamp, 편집 모달에서 전체 노출.
 */
import { useMemo, useState } from 'react';
import { Plus, Trash2, Tag, Notebook } from 'lucide-react';
import Button from '../common/Button';
import useWorkLearnStore from '../../stores/useWorkLearnStore';
import WorkNoteEditor from './WorkNoteEditor';
import { formatDate } from '../../utils/formatters';

/** 업무노트 카드 리스트 컨테이너. */
export default function WorkNotePanel() {
  const notes = useWorkLearnStore((s) => s.notes);
  const removeNote = useWorkLearnStore((s) => s.removeNote);

  // 편집/생성 모달 상태 — editing=null이면 생성, editing=note면 편집
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  // 삭제 팝오버 표시 대상 id (팝오버는 한 번에 하나만 열림)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  // 태그 필터 — 선택한 태그가 포함된 노트만 보여준다. null이면 전체.
  const [activeTag, setActiveTag] = useState(null);

  // 전체 태그 집합 — 필터 칩 렌더링용
  const allTags = useMemo(() => {
    const set = new Set();
    notes.forEach((n) => (n.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [notes]);

  const filtered = useMemo(
    () => (activeTag ? notes.filter((n) => n.tags.includes(activeTag)) : notes),
    [notes, activeTag],
  );

  const openCreate = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (note) => { setEditing(note); setEditorOpen(true); };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        {/* 상단 액션 바 — 노트 추가 + 태그 필터 */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag size={14} className="text-text-tertiary" />
            <button
              onClick={() => setActiveTag(null)}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors
                ${activeTag === null
                  ? 'bg-primary text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'}`}
            >
              전체
            </button>
            {allTags.map((t) => {
              const active = t === activeTag;
              return (
                <button
                  key={t}
                  onClick={() => setActiveTag(active ? null : t)}
                  className={`px-2.5 py-1 rounded-full text-xs transition-colors
                    ${active
                      ? 'bg-primary text-white'
                      : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'}`}
                >
                  #{t}
                </button>
              );
            })}
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            노트 추가
          </Button>
        </div>

        {/* 빈 상태 */}
        {notes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Notebook size={32} className="text-text-tertiary" />
            <p className="text-sm text-text-secondary">아직 업무노트가 비어있습니다</p>
            <p className="text-xs text-text-tertiary">
              회의록·절차·링크·아이디어 등 업무 관련 지식을 자유롭게 기록하세요
            </p>
          </div>
        )}

        {/* 필터 결과 빈 상태 */}
        {notes.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-text-tertiary text-center py-8">
            선택한 태그와 일치하는 노트가 없습니다
          </p>
        )}

        {/* 카드 리스트 */}
        <div className="flex flex-col gap-3">
          {filtered.map((note) => (
            <div
              key={note.id}
              className="flex flex-col gap-2 p-4 rounded-lg border border-border-light bg-bg-primary
                         hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => openEdit(note)}
                  className="flex-1 text-left"
                  title="클릭하여 편집"
                >
                  <p className="text-sm font-medium text-text-primary">{note.title}</p>
                </button>
                {/* 삭제 버튼 + 팝오버 확인 */}
                <div className="relative">
                  <button
                    onClick={() => setConfirmDeleteId(note.id)}
                    title="삭제"
                    className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                  {confirmDeleteId === note.id && (
                    <div
                      className="absolute right-0 top-full mt-2 z-50 bg-bg-primary border border-border-light
                                 rounded-lg shadow-lg p-3 min-w-[180px] animate-popover-in"
                    >
                      <p className="text-xs text-text-primary mb-2.5">삭제할까요?</p>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs px-2.5 py-1 rounded text-text-secondary hover:bg-bg-secondary transition-colors"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => { removeNote(note.id); setConfirmDeleteId(null); }}
                          className="text-xs px-2.5 py-1 rounded bg-danger text-white hover:bg-danger/90 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 본문 미리보기 — 3줄 clamp. 편집 모달에서 전체 보기 */}
              {note.body && (
                <button
                  onClick={() => openEdit(note)}
                  className="text-left text-xs text-text-secondary whitespace-pre-wrap line-clamp-3"
                >
                  {note.body}
                </button>
              )}

              {/* 메타 — 태그 + 최종 수정일 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 flex-wrap">
                  {note.tags.map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-bg-secondary text-text-secondary">
                      #{t}
                    </span>
                  ))}
                </div>
                <span className="text-[10px] text-text-tertiary">
                  {formatDate(note.updatedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <WorkNoteEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initial={editing}
      />
    </div>
  );
}
