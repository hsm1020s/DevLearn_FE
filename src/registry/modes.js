/**
 * @fileoverview 앱 모드 레지스트리 — 일반 / 자격증(학습) / 업무학습 3모드의 메타데이터.
 *
 * 각 모드의 라벨·아이콘·컴포넌트(지연 로드)·사이드바 액션을 선언적으로 관리한다.
 * 새 모드 추가 시 이 파일에 엔트리 하나만 더하면 사이드바/헤더/MainContent가
 * 자동으로 따라붙는다(렌더부는 `MODE_LIST.map(...)`을 사용).
 *
 * 학습 계열 모드는 스타일 칩(파인만/요약)·요약 액션 등을 공유한다. 판단 기준이
 * 여러 곳에 흩어지지 않도록 `LEARNING_MODES` / `isLearningMode`를 한 곳에 둔다.
 */
import { Search, GraduationCap, Briefcase } from 'lucide-react';

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
  study: {
    value: 'study',
    label: '자격증',
    icon: GraduationCap,
    description: 'SQLP · DAP 퀴즈 학습',
    component: () => import('../components/study/StudyMode'),
    actions: [],
  },
  worklearn: {
    value: 'worklearn',
    label: '업무학습',
    icon: Briefcase,
    description: '업무 지식 기록 · 체크리스트 · 학습 채팅',
    component: () => import('../components/worklearn/WorkLearnMode'),
    actions: [],
  },
};

/** 모드 목록 배열 (사이드바 렌더링용) */
export const MODE_LIST = Object.values(MODES);

/** 모드값으로 설정 조회 (없으면 general 폴백) */
export const getModeConfig = (modeValue) => MODES[modeValue] || MODES.general;

/**
 * 학습 계열 모드 집합. 자격증 퀴즈 학습과 업무학습은
 * 스타일 칩(파인만/요약)·요약 액션·학습 채팅 같은 학습 전용 UX를 공유한다.
 */
export const LEARNING_MODES = new Set(['study', 'worklearn']);

/** 학습 계열 모드 여부 — 스타일 칩/요약 액션 등 학습 공통 UX의 분기 기준. */
export const isLearningMode = (mode) => LEARNING_MODES.has(mode);
