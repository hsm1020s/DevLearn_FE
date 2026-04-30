/**
 * @fileoverview 업무학습 모드 진입점.
 *
 * 공부 모드의 "PDF→퀴즈→오답→통계" 루프가 업무학습에 맞지 않아 별도 모드로 분리.
 * 초기에는 학습 채팅 + 업무노트 + 체크리스트 3-탭 구조였지만, 사용자가
 * 업무노트·체크리스트 탭을 필요 없다고 판단해 제거하면서 업무학습 모드는
 * 업무학습 전용 타이틀을 얹은 학습 채팅 단독 화면으로 축소되었다.
 */
import StudyChatTab from '../study/StudyChatTab';

/** 업무학습 모드 컨테이너 — 현재는 학습 채팅 단독. */
export default function WorkLearnMode() {
  return (
    <StudyChatTab
      mode="worklearn"
      title="업무학습 채팅"
      subtitle="업무 지식을 질문·정리해보세요"
      homeCards={null}
    />
  );
}
