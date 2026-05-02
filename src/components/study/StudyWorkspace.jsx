/**
 * @fileoverview 학습 모드 워크스페이스 컨테이너.
 * 상단 StudySubTabs + 하단 현재 탭 본문(Chat/Quiz/Record)을 조합한다.
 * useAppStore.studySubTab을 보고 탭 컴포넌트를 mount/unmount 없이 전환한다.
 * (mount 유지 전략은 각 탭의 로컬 state가 persist되지 않아도 살아있도록 하기 위함.)
 */
import { useEffect } from 'react';
import useAppStore from '../../stores/useAppStore';
import StudySubTabs from './StudySubTabs';
import SplitLearningWorkspace from './SplitLearningWorkspace';
import StudyQuizTab from './StudyQuizTab';
import StudyRecordTab from './StudyRecordTab';

const VALID_TABS = ['chat', 'quiz', 'record'];

/** 학습 워크스페이스 — 탭 바 + 현재 탭 본문. */
export default function StudyWorkspace() {
  const studySubTab = useAppStore((s) => s.studySubTab);
  const setStudySubTab = useAppStore((s) => s.setStudySubTab);

  // persist 잔재(예: 과거 'pipeline' 탭)가 남아 있으면 'chat'으로 보정.
  // 파이프라인 탭은 제거되어 이 워크스페이스에서 렌더하지 않으므로 빈 화면이 뜨는 것을 방지.
  useEffect(() => {
    if (!VALID_TABS.includes(studySubTab)) {
      setStudySubTab('chat');
    }
  }, [studySubTab, setStudySubTab]);

  return (
    <div className="flex flex-col h-full">
      <StudySubTabs />
      {/*
        각 탭을 조건부로 렌더하되, 탭을 벗어날 때 unmount하지 않고 display:none으로
        유지하는 방식도 검토했지만, 각 탭의 무거운 동작(useStreamingChat 구독, 타이머
        useEffect)이 백그라운드에서 계속 돌게 되는 부작용이 있다.
        → 일단은 단순 조건부 렌더로 두고, 탭 이동 시 세션 보존이 필요한 값은 모두
           useStudyStore로 끌어올렸다(quizPaused, currentQuiz, chatStyle 등).
      */}
      <div className="flex-1 flex flex-col min-h-0">
        {studySubTab === 'chat' && <SplitLearningWorkspace mode="study" />}
        {studySubTab === 'quiz' && <StudyQuizTab />}
        {studySubTab === 'record' && <StudyRecordTab />}
      </div>
    </div>
  );
}
