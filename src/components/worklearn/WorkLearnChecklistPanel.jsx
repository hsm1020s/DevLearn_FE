/**
 * @fileoverview 업무학습 모드의 사용자 정의 체크리스트 패널.
 *
 * 자격증 모드의 체크리스트는 `SUBJECT_CATALOG`에서 시드된 고정 챕터를 쓰지만,
 * 업무학습은 프로젝트·항목 모두 사용자가 자유롭게 만들고 지운다.
 * 범용 `ChecklistPanel`을 재사용하고, 프로젝트 추가/항목 추가/삭제 UI만 이 곳에서
 * 슬롯으로 주입한다.
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Button from '../common/Button';
import ChecklistPanel from '../study/ChecklistPanel';
import useWorkLearnStore from '../../stores/useWorkLearnStore';

/** 항목 추가 인라인 입력 — 엔터로 확정, 빈값은 무시. */
function AddItemInput({ onAdd }) {
  const [value, setValue] = useState('');
  const confirm = () => {
    const v = value.trim();
    if (!v) return;
    onAdd(v);
    setValue('');
  };
  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // IME 조합 중 Enter 무시 — 한글 입력 안정성 확보
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            confirm();
          }
        }}
        placeholder="새 항목 입력 후 Enter"
        className="flex-1 px-2.5 py-1.5 rounded-md border border-border-light bg-bg-primary text-xs
                   focus:outline-none focus:border-primary"
      />
      <Button size="sm" variant="secondary" onClick={confirm} disabled={!value.trim()}>
        추가
      </Button>
    </div>
  );
}

/** 업무학습 체크리스트 패널 — 프로젝트 CRUD + 항목 CRUD. */
export default function WorkLearnChecklistPanel() {
  const checklist = useWorkLearnStore((s) => s.checklist);
  const toggleChecklistChapter = useWorkLearnStore((s) => s.toggleChecklistChapter);
  const addChecklistProject = useWorkLearnStore((s) => s.addChecklistProject);
  const removeChecklistProject = useWorkLearnStore((s) => s.removeChecklistProject);
  const addChecklistItem = useWorkLearnStore((s) => s.addChecklistItem);

  // 프로젝트 추가 입력 상태
  const [projectInput, setProjectInput] = useState('');
  const [showProjectInput, setShowProjectInput] = useState(false);
  // 프로젝트 삭제 팝오버 대상 id
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState(null);

  const handleAddProject = () => {
    const v = projectInput.trim();
    if (!v) return;
    addChecklistProject({ title: v });
    setProjectInput('');
    setShowProjectInput(false);
  };

  // 프로젝트 헤더 우측 — 삭제 버튼 + 팝오버 확인
  const renderProjectActions = (project) => (
    <div className="relative">
      <button
        onClick={() => setConfirmDeleteProjectId(project.id)}
        title="프로젝트 삭제"
        className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
      >
        <Trash2 size={13} />
      </button>
      {confirmDeleteProjectId === project.id && (
        <div
          className="absolute right-0 top-full mt-2 z-50 bg-bg-primary border border-border-light
                     rounded-lg shadow-lg p-3 min-w-[200px] animate-popover-in"
        >
          <p className="text-xs text-text-primary mb-2.5">프로젝트와 모든 항목을 삭제할까요?</p>
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => setConfirmDeleteProjectId(null)}
              className="text-xs px-2.5 py-1 rounded text-text-secondary hover:bg-bg-secondary transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => {
                removeChecklistProject(project.id);
                setConfirmDeleteProjectId(null);
              }}
              className="text-xs px-2.5 py-1 rounded bg-danger text-white hover:bg-danger/90 transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // 프로젝트 카드 하단 — 항목 추가 입력
  const renderProjectFooter = (project) => (
    <AddItemInput onAdd={(label) => addChecklistItem(project.id, label)} />
  );

  // 카드 리스트 끝에 "프로젝트 추가" 액션
  const footer = (
    <div>
      {showProjectInput ? (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border-light">
          <input
            type="text"
            value={projectInput}
            onChange={(e) => setProjectInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleAddProject();
              }
            }}
            placeholder="프로젝트 이름"
            autoFocus
            className="flex-1 px-2.5 py-1.5 rounded-md border border-border-light bg-bg-primary text-sm
                       focus:outline-none focus:border-primary"
          />
          <Button size="sm" onClick={handleAddProject} disabled={!projectInput.trim()}>
            추가
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setShowProjectInput(false); setProjectInput(''); }}
          >
            취소
          </Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setShowProjectInput(true)}>
          <Plus className="w-4 h-4" />
          프로젝트 추가
        </Button>
      )}
    </div>
  );

  const emptyFallback = (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
      <p className="text-sm text-text-secondary">프로젝트가 비어있습니다</p>
      <p className="text-xs text-text-tertiary">
        아래 "프로젝트 추가"로 업무 단위 체크리스트를 만드세요
      </p>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="max-w-3xl mx-auto">
        <ChecklistPanel
          items={checklist}
          onToggleChapter={toggleChecklistChapter}
          renderProjectActions={renderProjectActions}
          renderProjectFooter={renderProjectFooter}
          emptyFallback={emptyFallback}
          footer={footer}
        />
      </div>
    </div>
  );
}
