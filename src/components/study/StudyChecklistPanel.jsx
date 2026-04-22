/**
 * @fileoverview 자격증 학습 모드 전용 체크리스트 어댑터.
 *
 * 범용 `ChecklistPanel`이 스토어에 의존하지 않도록 학습 모드 전용 어댑터를 얇게 둔다.
 * `useStudyStore`의 활성 과목 체크리스트를 구독해 prop으로 주입한다.
 *
 * 추가로 `SUBJECT_CATALOG[activeSubject].parts`에서 과목별 문항수/배점 메타를 꺼내
 * 각 과목 제목 옆에 "(N문항 · M점)" 형태로 노출한다. parts가 없는 과목(custom 등)은
 * 메타가 비어 기본 UI 그대로.
 */
import useStudyStore from '../../stores/useStudyStore';
import ChecklistPanel from './ChecklistPanel';
import { useActiveSubjectMeta } from '../../hooks/useActiveSubject';

/** 학습 모드 전용 어댑터 — 활성 과목 체크리스트를 ChecklistPanel에 전달. */
export default function StudyChecklistPanel() {
  const items = useStudyStore((s) => s.subjects[s.activeSubject].checklist);
  const onToggleChapter = useStudyStore((s) => s.toggleChecklistChapter);
  const subjectMeta = useActiveSubjectMeta();

  // 체크리스트 book.id와 카탈로그 part.id가 같은 키를 공유하도록 설계돼 있어 단순 lookup.
  const renderProjectMeta = subjectMeta.parts
    ? (book) => {
        const part = subjectMeta.parts.find((p) => p.id === book.id);
        if (!part) return null;
        return (
          <span className="text-[11px] text-text-tertiary shrink-0">
            ({part.questionCount}문항 · {part.points}점)
          </span>
        );
      }
    : undefined;

  return (
    <ChecklistPanel
      items={items}
      onToggleChapter={onToggleChapter}
      renderProjectMeta={renderProjectMeta}
    />
  );
}
