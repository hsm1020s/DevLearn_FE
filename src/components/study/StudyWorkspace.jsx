/**
 * @fileoverview 공부 모드 워크스페이스 — 학습 채팅(좌우 분할) 단독.
 *
 * 과거에는 채팅/퀴즈/기록 3-탭 컨테이너였으나, 퀴즈/기록 기능 제거 후 학습 채팅만
 * 남아 탭바 자체가 사라졌다. 진입점(StudyMode → StudyWorkspace)을 1단계로 줄이지
 * 않고 유지한 이유는, 추후 공부 모드 전용 보조 탭(예: 학습 노트)이 다시 들어올
 * 때 이 컨테이너에 얹기 위함.
 */
import SplitLearningWorkspace from './SplitLearningWorkspace';

/** 공부 모드 워크스페이스 — 좌우 분할 학습 채팅. */
export default function StudyWorkspace() {
  return <SplitLearningWorkspace mode="study" />;
}
