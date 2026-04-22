/**
 * @fileoverview 학습 모드 과목 선택 드롭다운.
 *
 * StudySubTabs 좌측에 배치되어 활성 과목(SQLP / DAP / 사용자정의)을 전환한다.
 * 과목별 오답노트·통계·현재 퀴즈 세션이 `subjects[id]` 버킷에 격리돼 있으므로,
 * 이 컴포넌트에서 activeSubject만 바꿔도 각 패널 구독이 즉시 교체된다.
 *
 * 별도 컴포넌트로 분리한 이유: 탭 바 본체(StudySubTabs)의 책임은 "채팅/퀴즈/기록" 탭
 * 전환이고, 과목 전환은 축이 직교한다(탭 × 과목). 한 컴포넌트에 섞으면 뱃지·상태 계산이
 * 복잡해진다.
 */
import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, Check } from 'lucide-react';
import useStudyStore from '../../stores/useStudyStore';
import { SUBJECT_LIST } from '../../registry/subjects';

/** 학습 과목 드롭다운 — 외부 클릭 시 자동 닫힘. */
export default function SubjectSelector() {
  const activeSubject = useStudyStore((s) => s.activeSubject);
  const setActiveSubject = useStudyStore((s) => s.setActiveSubject);

  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const active = SUBJECT_LIST.find((s) => s.id === activeSubject) || SUBJECT_LIST[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={active.description}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium
                   bg-bg-secondary text-text-primary hover:bg-bg-tertiary transition-colors"
      >
        <BookOpen size={14} className="text-primary" />
        <span>{active.label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1 z-50 min-w-[220px]
                     rounded-lg border border-border-light bg-bg-primary shadow-lg
                     animate-popover-in py-1"
        >
          {SUBJECT_LIST.map((s) => {
            const selected = s.id === activeSubject;
            return (
              <button
                key={s.id}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setActiveSubject(s.id);
                  setOpen(false);
                }}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                  transition-colors
                  ${selected ? 'bg-primary/5 text-primary' : 'text-text-primary hover:bg-bg-secondary'}
                `}
              >
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-[11px] text-text-tertiary truncate">{s.description}</span>
                </div>
                {selected && <Check size={14} className="text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
