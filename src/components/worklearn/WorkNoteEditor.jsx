/**
 * @fileoverview 업무노트 편집 모달.
 *
 * 생성/편집 모두 이 컴포넌트를 재사용한다 — `initial`이 있으면 편집, 없으면 생성.
 * 태그는 쉼표 구분 텍스트로 입력받고 저장 시 배열로 정규화(공백 제거, 중복 제거).
 * 모달 자체의 열기/닫기는 부모가 제어(`open` + `onClose`).
 */
import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import useWorkLearnStore from '../../stores/useWorkLearnStore';

/**
 * @param {object} props
 * @param {boolean} props.open 모달 표시 여부
 * @param {() => void} props.onClose 닫기 콜백 (모달 바깥 클릭 / 취소 / 저장 후)
 * @param {{id:string, title:string, body:string, tags:string[]}} [props.initial]
 *   편집 대상 노트. 없으면 생성 모드.
 */
export default function WorkNoteEditor({ open, onClose, initial }) {
  const addNote = useWorkLearnStore((s) => s.addNote);
  const updateNote = useWorkLearnStore((s) => s.updateNote);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  // 태그는 모달 내부에서 쉼표 구분 문자열로 다루고, 저장 순간에 배열로 변환.
  const [tagsText, setTagsText] = useState('');

  // initial 바뀔 때 폼 리셋 — 편집 노트 전환 시 이전 입력이 남지 않도록.
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setBody(initial?.body ?? '');
    setTagsText((initial?.tags || []).join(', '));
  }, [open, initial]);

  const handleSave = () => {
    const tags = Array.from(
      new Set(
        tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    );
    if (initial) {
      updateNote(initial.id, { title, body, tags });
    } else {
      addNote({ title, body, tags });
    }
    onClose?.();
  };

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title={initial ? '노트 편집' : '노트 추가'}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          제목
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="노트 제목"
            className="px-3 py-2 rounded-md border border-border-light bg-bg-primary text-sm text-text-primary
                       focus:outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          내용
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="마크다운으로 자유롭게 작성"
            rows={8}
            className="px-3 py-2 rounded-md border border-border-light bg-bg-primary text-sm text-text-primary
                       focus:outline-none focus:border-primary font-mono resize-y"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          태그 (쉼표로 구분)
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="회의, 기획안, QA"
            className="px-3 py-2 rounded-md border border-border-light bg-bg-primary text-sm text-text-primary
                       focus:outline-none focus:border-primary"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>취소</Button>
          <Button size="sm" onClick={handleSave} disabled={!title.trim()}>
            {initial ? '저장' : '추가'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
