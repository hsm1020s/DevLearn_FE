/**
 * @fileoverview 파인만 학습 모드 진입점.
 * PDF에서 추출한 챕터를 선택하고, 개념을 자신의 말로 설명하면
 * RAG 기반으로 원본 텍스트와 대조하여 피드백을 받는 학습 페이지.
 */
import FeynmanWorkspace from './FeynmanWorkspace';

export default function FeynmanMode() {
  return <FeynmanWorkspace />;
}
