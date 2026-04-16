import { Search, FileText, Briefcase, Upload, BarChart3, BookOpen } from 'lucide-react';

export const MODES = {
  general: {
    value: 'general',
    label: '일반검색',
    icon: Search,
    description: '자유로운 질의응답',
    component: () => import('../components/chat/ChatContainer'),
    actions: [],
  },
  cert: {
    value: 'cert',
    label: '자격증',
    icon: FileText,
    description: 'PDF 기반 퀴즈 학습',
    component: () => import('../components/cert/CertMode'),
    actions: [
      { label: 'PDF 업로드', icon: Upload, action: 'certUpload' },
      { label: '학습현황', icon: BarChart3, action: 'studyStats' },
    ],
  },
  work: {
    value: 'work',
    label: '업무학습',
    icon: Briefcase,
    description: 'PDF RAG 질의응답',
    component: () => import('../components/work/WorkStudyMode'),
    actions: [
      { label: 'PDF 업로드', icon: Upload, action: 'ragUpload' },
      { label: '문서관리', icon: BookOpen, action: 'docManage' },
    ],
  },
};

export const MODE_LIST = Object.values(MODES);
export const getModeConfig = (modeValue) => MODES[modeValue] || MODES.general;
