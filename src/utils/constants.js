/**
 * @fileoverview 앱 전역에서 사용하는 상수 정의 (모드, LLM 옵션, 퀴즈 설정, 문서 상태)
 */

export { MODE_LIST as MAIN_MODES } from '../registry/modes';

// LLM 모델 선택 옵션

export const LLM_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'claude-3.5', label: 'Claude 3.5' },
  { value: 'gemini', label: 'Gemini Pro' },
  { value: 'llama-8b', label: 'Llama 3.1 8B' },
  { value: 'exaone-32b', label: 'EXAONE 3.5 32B' },
  { value: 'gpt-oss-20b', label: 'GPT-OSS 20B' },
];

// 퀴즈 문항 수 선택지
export const QUIZ_COUNTS = [10, 20, 30];

// 퀴즈 난이도 옵션
export const QUIZ_DIFFICULTIES = [
  { value: 'easy', label: '쉬움' },
  { value: 'mixed', label: '혼합' },
  { value: 'hard', label: '어려움' },
];

// 퀴즈 유형 옵션 — SQLP/DAP 실제 시험 구성이 객관식 + 실기(서술형)이고 단답형이
// 없어 4지선다만 제공한다. 실기 서술형은 앱의 객관식 mock 구조 밖(후속 태스크).
export const QUIZ_TYPES = [
  { value: 'multiple', label: '4지선다' },
];

// 학습 채팅 스타일 (그룹 D — 이해도 점검용 프롬프트 프리셋)
export const CHAT_STYLES = [
  { value: 'general', label: '일반', short: '💬', description: '자유 질의응답' },
  { value: 'feynman', label: '파인만', short: '🧠', description: '내가 설명하면 AI가 빠진 개념을 짚어준다' },
  { value: 'summary', label: '한줄요약', short: '✂️', description: '핵심을 한 문장으로 요약해준다' },
];

// 모의고사 프리셋은 과목별로 분기되어 `src/registry/subjects.js` 에 정의한다.
// (SQLP 180분/72문항, DAP 240분/76문항, custom 30분/30문항)

// 문서 처리 상태별 라벨 및 색상 매핑
export const DOC_STATUS = {
  processing: { label: '처리중', color: 'text-warning' },
  indexing: { label: '색인중', color: 'text-warning' },
  completed: { label: '완료', color: 'text-success' },
  error: { label: '오류', color: 'text-danger' },
};

// 통계 화면에서 사용하는 난이도 key → 한글 라벨 매핑
export const STATS_DIFFICULTY_LABELS = {
  easy: '쉬움',
  mixed: '혼합',
  hard: '어려움',
};

// 통계 화면에서 사용하는 문제 유형 key → 한글 라벨 매핑
export const STATS_TYPE_LABELS = {
  multiple: '4지선다',
};
