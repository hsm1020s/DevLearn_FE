export { MODE_LIST as MAIN_MODES } from '../registry/modes';

export const LLM_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'claude-3.5', label: 'Claude 3.5' },
  { value: 'gemini', label: 'Gemini Pro' },
];

export const QUIZ_COUNTS = [10, 20, 30];

export const QUIZ_DIFFICULTIES = [
  { value: 'easy', label: '쉬움' },
  { value: 'mixed', label: '혼합' },
  { value: 'hard', label: '어려움' },
];

export const QUIZ_TYPES = [
  { value: 'multiple', label: '4지선다' },
  { value: 'ox', label: 'OX' },
  { value: 'short', label: '단답형' },
];

export const DOC_STATUS = {
  processing: { label: '처리중', color: 'text-warning' },
  indexing: { label: '색인중', color: 'text-warning' },
  completed: { label: '완료', color: 'text-success' },
  error: { label: '오류', color: 'text-danger' },
};
