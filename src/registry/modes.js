/**
 * @fileoverview 앱 모드 레지스트리 — 일반검색, 자격증, 업무학습 모드의 메타데이터 정의.
 * 각 모드의 라벨, 아이콘, 컴포넌트(지연 로드), 사이드바 액션을 선언적으로 관리한다.
 */
import { Search, FileText, Briefcase } from 'lucide-react';

/** 모드별 설정 레지스트리 (컴포넌트는 dynamic import로 지연 로드) */
export const MODES = {
  general: {
    value: 'general',
    label: '일반',
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
    actions: [],
  },
  work: {
    value: 'work',
    label: '업무학습',
    icon: Briefcase,
    description: 'PDF RAG 질의응답',
    component: () => import('../components/work/WorkStudyMode'),
    actions: [],
  },
};

/** 모드 목록 배열 (사이드바 렌더링용) */
export const MODE_LIST = Object.values(MODES);

/** 모드값으로 설정 조회 (없으면 general 폴백) */
export const getModeConfig = (modeValue) => MODES[modeValue] || MODES.general;
