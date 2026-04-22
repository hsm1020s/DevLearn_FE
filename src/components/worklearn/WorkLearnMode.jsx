/**
 * @fileoverview 업무학습 모드 진입점.
 *
 * 자격증 모드의 "PDF→퀴즈→오답→통계" 루프가 업무학습에 맞지 않아 별도 모드로 분리.
 * 구조는 학습 채팅 + 업무노트 + 사용자 정의 체크리스트의 3-탭이고, 상단 탭 바 +
 * 본문 분기는 사용자의 기존 학습 모드 3-탭 경험을 그대로 유지한다.
 * 탭 이동은 로컬 state로 관리 (학습 모드와 달리 앱 스토어까지 끌어올릴 가치가
 * 적음 — 업무학습은 자격증 모드처럼 서브탭별 뱃지/세션 보존 로직이 없음).
 */
import { useState } from 'react';
import WorkLearnSubTabs from './WorkLearnSubTabs';
import StudyChatTab from '../study/StudyChatTab';
import WorkNotePanel from './WorkNotePanel';
import WorkLearnChecklistPanel from './WorkLearnChecklistPanel';

/** 업무학습 모드에 어울리는 예시 질문 프리셋 (빈 상태 chips). */
const WORKLEARN_EXAMPLES = [
  '회의록을 bullet 3개로 요약해줘',
  '신규 입사자 온보딩 체크리스트 초안',
  '업무 매뉴얼에 빠진 절차가 있는지 검토해줘',
];

/** 업무학습 모드 컨테이너 — 상단 탭 바 + 현재 탭 본문. */
export default function WorkLearnMode() {
  // 초기 진입은 채팅 탭. 세션 보존 필요 없어 로컬 state로 충분.
  const [subTab, setSubTab] = useState('chat');

  return (
    <div className="flex flex-col h-full">
      <WorkLearnSubTabs value={subTab} onChange={setSubTab} />
      <div className="flex-1 flex flex-col min-h-0">
        {subTab === 'chat' && (
          <StudyChatTab
            mode="worklearn"
            examples={WORKLEARN_EXAMPLES}
            title="업무학습 채팅"
            subtitle="업무 지식을 질문·정리해보세요"
            homeCards={null}
          />
        )}
        {subTab === 'note' && <WorkNotePanel />}
        {subTab === 'checklist' && <WorkLearnChecklistPanel />}
      </div>
    </div>
  );
}
