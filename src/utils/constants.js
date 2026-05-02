/**
 * @fileoverview 앱 전역에서 사용하는 상수 정의 (모드, LLM 옵션, 퀴즈 설정, 문서 상태)
 */

export { MODE_LIST as MAIN_MODES } from '../registry/modes';

// LLM 모델 선택 옵션

// 클라우드 3종은 각 벤더의 가성비 티어(2026-04 기준)로 정렬.
// 로컬 3종은 value(ID)를 기존과 동일하게 두어 이전 대화 메타데이터 호환을 유지하고,
// 사용자가 로컬/클라우드를 한눈에 구분할 수 있도록 라벨 뒤에 " (로컬)"만 덧붙인다.
export const LLM_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'llama-8b', label: 'Llama 3.1 8B (로컬)' },
  { value: 'exaone-32b', label: 'EXAONE 3.5 32B (로컬)' },
  { value: 'gpt-oss-20b', label: 'GPT-OSS 20B (로컬)' },
];

// 학습 채팅 스타일 (이해도 점검용 프롬프트 프리셋)
export const CHAT_STYLES = [
  { value: 'general', label: '일반', short: '💬', description: '자유 질의응답' },
  { value: 'feynman', label: '파인만', short: '🧠', description: '내가 설명하면 AI가 빠진 개념을 짚어준다' },
];

// 문서 처리 상태별 라벨 및 색상 매핑
export const DOC_STATUS = {
  processing: { label: '처리중', color: 'text-warning' },
  indexing: { label: '색인중', color: 'text-warning' },
  completed: { label: '완료', color: 'text-success' },
  error: { label: '오류', color: 'text-danger' },
};
