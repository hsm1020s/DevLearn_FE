/**
 * @fileoverview 학습 모드 과목 카탈로그 — SQLP · DAP · 사용자 정의.
 *
 * 과목 축 추상화: 학습 모드는 컨테이너이고, 과목(subject)은 그 안의 네임스페이스다.
 * 오답노트·통계·문서·현재 퀴즈 세션은 과목별로 격리되고, 예시 질문·모의고사
 * 프리셋·과목별 배점(parts)은 이 파일의 카탈로그에서 제공된다.
 *
 * 새 과목 추가 시 이 파일에 엔트리만 더하면 되도록 설계한다. 실제 기출/커리큘럼
 * 데이터는 후속 태스크에서 백엔드로 이관 예정.
 *
 * 프리셋 값의 근거(실제 시험 규격, 2026-04 확인):
 * - SQLP : 72문항(객관식 70 + 실기 2), 180분, 100점 (과목별 40% + 총점 75점)
 * - DAP  : 76문항(객관식 75 + 실기 1), 240분, 100점 (과목별 40% + 총점 75점)
 *
 * 정보관리기술사(논술형)는 객관식 mock과 맞지 않아 이전 단계에서 제거됨. 별도
 * 논술 모드 설계 후 재도입 예정.
 */

/** SQLP (SQL 전문가) — 72문항·180분 모의고사 */
const SQLP = {
  id: 'sqlp',
  label: 'SQLP',
  description: 'SQL 전문가 · 72문항 180분 · 과목별 40% / 총점 75점',
  examPreset: { count: 72, difficulty: 'mixed', timerSec: 180 * 60 },
  // 객관식 70문항 + 실기 2문항 중 객관식만 카운팅. 실기 30점은 이번 스코프 밖.
  parts: [
    { id: 'sqlp-pm', label: '데이터 모델링의 이해',   questionCount: 10, points: 10 },
    { id: 'sqlp-p1', label: 'SQL 기본 및 활용',       questionCount: 20, points: 20 },
    { id: 'sqlp-p2', label: 'SQL 고급 활용 및 튜닝',  questionCount: 40, points: 40 },
  ],
  passingCriteria: { totalMin: 75, partMinPercent: 40 },
  examples: [
    '옵티마이저 실행 계획 읽는 법 알려줘',
    'B-Tree 인덱스와 비트맵 인덱스 차이 설명해줘',
    '조인 수행 원리(NL/Sort Merge/Hash) 정리해줘',
  ],
};

/** DAP (데이터아키텍처 전문가) — 76문항·240분 모의고사. 2024년 이후 개편 6과목. */
const DAP = {
  id: 'dap',
  label: 'DAP',
  description: '데이터아키텍처 전문가 · 76문항 240분 · 과목별 40% / 총점 75점',
  examPreset: { count: 76, difficulty: 'mixed', timerSec: 240 * 60 },
  // 객관식 75문항(60점) + 실기 1문항(40점) 중 객관식 부분만 집계. 실기 40점은 이번 스코프 밖.
  parts: [
    { id: 'dap-p1', label: '전사아키텍처 이해',        questionCount: 10, points: 8 },
    { id: 'dap-p2', label: '데이터 요건 분석',          questionCount: 10, points: 8 },
    { id: 'dap-p3', label: '데이터 표준화',             questionCount: 10, points: 8 },
    { id: 'dap-p4', label: '데이터 모델링',             questionCount: 25, points: 20 },
    { id: 'dap-p5', label: '데이터베이스 설계와 이용',  questionCount: 10, points: 8 },
    { id: 'dap-p6', label: '데이터 품질 관리 이해',     questionCount: 10, points: 8 },
  ],
  passingCriteria: { totalMin: 75, partMinPercent: 40 },
  examples: [
    '정규화와 반정규화 판단 기준은?',
    '데이터 표준화 절차를 단계별로 정리해줘',
    '주제영역 도출 방법과 CRUD 매트릭스 활용법',
  ],
};

/** 사용자 정의 — 자유 업로드 PDF 기반 학습. 기존 data는 이 버킷으로 마이그레이션. */
const CUSTOM = {
  id: 'custom',
  label: '기타/사용자 정의',
  description: '사용자가 직접 업로드한 PDF 기반 학습',
  examPreset: { count: 30, difficulty: 'mixed', timerSec: 30 * 60 },
  // 사용자 임의 PDF라 과목 분류가 없음 → 과목별 집계 비활성.
  parts: null,
  passingCriteria: null,
  examples: [
    '핵심 개념 3개로 요약해줘',
    '이 문서의 토픽을 트리로 정리해줘',
    '헷갈릴 만한 용어 비교표 만들어줘',
  ],
};

/** 과목 레지스트리. key는 과목 id. */
export const SUBJECT_CATALOG = {
  sqlp: SQLP,
  dap: DAP,
  custom: CUSTOM,
};

/** 사이드 메뉴/드롭다운 렌더링용 배열 (선언 순서 유지). */
export const SUBJECT_LIST = [SQLP, DAP, CUSTOM];

/** 신규 사용자 기본 과목. 자격증 중 가장 대표적인 SQLP로 시작. */
export const DEFAULT_SUBJECT_ID = 'sqlp';

/** 과목 id로 카탈로그 엔트리를 조회한다. 없으면 custom 폴백. */
export const getSubject = (id) => SUBJECT_CATALOG[id] || SUBJECT_CATALOG.custom;
