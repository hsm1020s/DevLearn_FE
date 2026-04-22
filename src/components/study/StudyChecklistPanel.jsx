/**
 * @fileoverview 자격증 학습 모드 전용 체크리스트 어댑터.
 *
 * 범용 `ChecklistPanel`이 스토어에 의존하지 않도록 학습 모드 전용 어댑터를 얇게 둔다.
 * `useStudyStore`의 활성 과목 체크리스트를 구독해 prop으로 주입한다.
 * (SQLP/DAP/정보관리기술사/custom 중 현재 선택된 과목의 체크리스트가 표시됨)
 */
import useStudyStore from '../../stores/useStudyStore';
import ChecklistPanel from './ChecklistPanel';

/** 학습 모드 전용 어댑터 — 활성 과목 체크리스트를 ChecklistPanel에 전달. */
export default function StudyChecklistPanel() {
  const items = useStudyStore((s) => s.subjects[s.activeSubject].checklist);
  const onToggleChapter = useStudyStore((s) => s.toggleChecklistChapter);
  return <ChecklistPanel items={items} onToggleChapter={onToggleChapter} />;
}
