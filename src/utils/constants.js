export const LLM_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'claude-3.5', label: 'Claude 3.5' },
  { value: 'gemini', label: 'Gemini Pro' },
];

export const MAIN_MODES = [
  { value: 'general', label: '일반검색', icon: 'Search', description: '자유로운 질의응답' },
  { value: 'cert', label: '자격증', icon: 'FileText', description: 'PDF 기반 퀴즈 학습' },
  { value: 'work', label: '업무학습', icon: 'Briefcase', description: 'PDF RAG 질의응답' },
];

export const MODE_ICONS = {
  general: 'Search',
  cert: 'FileText',
  work: 'Briefcase',
};

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
