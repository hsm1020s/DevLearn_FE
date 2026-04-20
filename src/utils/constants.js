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
];

// 퀴즈 문항 수 선택지
export const QUIZ_COUNTS = [10, 20, 30];

// 퀴즈 난이도 옵션
export const QUIZ_DIFFICULTIES = [
  { value: 'easy', label: '쉬움' },
  { value: 'mixed', label: '혼합' },
  { value: 'hard', label: '어려움' },
];

// 퀴즈 유형 옵션
export const QUIZ_TYPES = [
  { value: 'multiple', label: '4지선다' },
  { value: 'ox', label: 'OX' },
  { value: 'short', label: '단답형' },
];

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
  ox: 'OX',
  short: '단답형',
};
