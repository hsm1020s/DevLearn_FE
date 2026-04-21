/**
 * @fileoverview 학습 모드 진입점.
 * 내부적으로 StudyWorkspace(채팅/퀴즈/기록 3탭 컨테이너)를 렌더한다.
 * 과거에는 단일 채팅 화면이었으나 A·C·D 기능군을 탭 기반으로 통합했다.
 */
import StudyWorkspace from './StudyWorkspace';

/** 학습 모드 — 탭 기반 워크스페이스. */
export default function StudyMode() {
  return <StudyWorkspace />;
}
