/**
 * @fileoverview 학습 모드 과목 카탈로그 — SQLP · DAP · 정보관리기술사 · 사용자 정의.
 *
 * 과목 축 추상화: 학습 모드는 컨테이너이고, 과목(subject)은 그 안의 네임스페이스다.
 * 오답노트·체크리스트·통계·문서·현재 퀴즈 세션은 과목별로 격리되고,
 * 예시 질문·모의고사 프리셋·기본 체크리스트는 이 파일의 카탈로그에서 제공된다.
 *
 * 새 과목 추가 시 이 파일에 엔트리만 더하면 되도록 설계한다. 실제 기출/커리큘럼
 * 데이터는 후속 태스크에서 백엔드로 이관 예정.
 *
 * 프리셋 값의 근거(실제 시험 규격, 2026-04 확인):
 * - SQLP : 72문항(객관식 70 + 실기 2), 180분, 100점 (과목별 40% + 총점 75점)
 * - DAP  : 76문항(객관식 75 + 실기 1), 240분, 100점 (과목별 40% + 총점 75점)
 * - 정보관리기술사(필기): 4교시·교시당 100분(총 400분) 전면 논술형.
 *   앱의 객관식 mock 구조상 1교시(13중 10선택, 단답/약술) 기준으로 근사한다.
 *   2~4교시 논술·모범답안 키워드 매칭은 별도 태스크에서 설계.
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
  // 실제 3과목 구조(데이터 모델링의 이해 / SQL 기본 및 활용 / SQL 고급 활용 및 튜닝).
  // 기존 chapter id(`sqlp-1-*`, `sqlp-2-*`)는 사용자의 체크 상태 보존을 위해 유지한다.
  checklist: [
    {
      id: 'sqlp-pm',
      title: '1과목 · 데이터 모델링의 이해',
      chapters: [
        { id: 'sqlp-m-1', label: '데이터 모델링 개요', done: false },
        { id: 'sqlp-m-2', label: '엔티티·속성·관계', done: false },
        { id: 'sqlp-m-3', label: '정규화', done: false },
        { id: 'sqlp-m-4', label: '반정규화와 성능 데이터 모델링', done: false },
      ],
    },
    {
      id: 'sqlp-p1',
      title: '2과목 · SQL 기본 및 활용',
      chapters: [
        { id: 'sqlp-1-1', label: '관계형 DB 개요', done: false },
        { id: 'sqlp-1-2', label: 'DML/DDL/DCL', done: false },
        { id: 'sqlp-1-3', label: '조인과 서브쿼리', done: false },
        { id: 'sqlp-1-4', label: '그룹 함수/집계', done: false },
        { id: 'sqlp-1-5', label: '계층형 질의', done: false },
      ],
    },
    {
      id: 'sqlp-p2',
      title: '3과목 · SQL 고급 활용 및 튜닝',
      chapters: [
        { id: 'sqlp-2-1', label: '옵티마이저와 실행계획', done: false },
        { id: 'sqlp-2-2', label: '인덱스 튜닝', done: false },
        { id: 'sqlp-2-3', label: '조인 튜닝', done: false },
        { id: 'sqlp-2-4', label: 'SQL 옵티마이징 원리', done: false },
        { id: 'sqlp-2-5', label: '파티셔닝과 병렬 처리', done: false },
      ],
    },
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
  checklist: [
    {
      id: 'dap-p1',
      title: '1과목 · 전사아키텍처 이해',
      chapters: [
        { id: 'dap-1-1', label: 'EA 개념과 프레임워크', done: false },
        { id: 'dap-1-2', label: '데이터아키텍처 정의', done: false },
      ],
    },
    {
      id: 'dap-p2',
      title: '2과목 · 데이터 요건 분석',
      chapters: [
        { id: 'dap-2-1', label: '정보 요구사항 수집', done: false },
        { id: 'dap-2-2', label: '주제영역 도출', done: false },
      ],
    },
    {
      id: 'dap-p3',
      title: '3과목 · 데이터 표준화',
      chapters: [
        { id: 'dap-3-1', label: '표준 용어/도메인', done: false },
        { id: 'dap-3-2', label: '표준 코드/관리 절차', done: false },
      ],
    },
    {
      id: 'dap-p4',
      title: '4과목 · 데이터 모델링',
      chapters: [
        { id: 'dap-4-1', label: '개념/논리/물리 모델', done: false },
        { id: 'dap-4-2', label: '정규화/반정규화', done: false },
        { id: 'dap-4-3', label: '엔티티·관계 설계', done: false },
      ],
    },
    {
      id: 'dap-p5',
      title: '5과목 · 데이터베이스 설계와 이용',
      chapters: [
        { id: 'dap-5-1', label: '물리 설계 전략', done: false },
        { id: 'dap-5-2', label: '분산/백업/복구', done: false },
      ],
    },
    // 2024 개편으로 추가된 6번째 과목.
    {
      id: 'dap-p6',
      title: '6과목 · 데이터 품질 관리 이해',
      chapters: [
        { id: 'dap-6-1', label: '데이터 품질 기준과 지표', done: false },
        { id: 'dap-6-2', label: '품질 진단·개선 절차', done: false },
        { id: 'dap-6-3', label: '메타데이터·데이터 거버넌스', done: false },
      ],
    },
  ],
};

/**
 * 정보관리기술사 필기 — 4교시·교시당 100분 전면 논술형, 총 400점 중 240점 합격.
 * 앱은 객관식 mock 구조이므로 프리셋은 **1교시(13중 10선택, 단답/약술)** 기준으로
 * 근사한다. 시간은 교시 1회분(100분) 그대로.
 */
const ENG = {
  id: 'eng',
  label: '정보관리기술사',
  description: '정보관리기술사 필기 · 4교시(교시당 100분) 논술형 · 240점 합격',
  // 프리셋은 1교시 기준 — 10문제 선택(단답/약술). 2~4교시 논술 모드는 후속 태스크.
  examPreset: { count: 10, difficulty: 'hard', timerSec: 100 * 60 },
  // 전면 논술형이라 객관식 과목 집계가 의미 없음 → parts/passingCriteria 없음.
  // 결과 화면은 기본(심플) 경로로 폴백.
  parts: null,
  passingCriteria: null,
  examples: [
    'MSA 전환 전략 — 논술 개요(서론/본론/결론) 잡아줘',
    '데이터 거버넌스 체계 수립 시 핵심 토픽 정리',
    'AI 전환(AX) 단계별 접근법과 조직 변화관리',
  ],
  checklist: [
    {
      id: 'eng-arch',
      title: '소프트웨어 아키텍처',
      chapters: [
        { id: 'eng-a-1', label: 'MSA / 이벤트 기반 아키텍처', done: false },
        { id: 'eng-a-2', label: 'DDD · CQRS · Saga', done: false },
        { id: 'eng-a-3', label: '클라우드 네이티브 · 쿠버네티스', done: false },
      ],
    },
    {
      id: 'eng-data',
      title: '데이터·AI',
      chapters: [
        { id: 'eng-d-1', label: '데이터 거버넌스·MDM', done: false },
        { id: 'eng-d-2', label: 'ML Ops · LLM 서비스화', done: false },
        { id: 'eng-d-3', label: 'RAG · 벡터 검색', done: false },
      ],
    },
    {
      id: 'eng-mgmt',
      title: '프로젝트·거버넌스',
      chapters: [
        { id: 'eng-m-1', label: 'IT 거버넌스 · COBIT', done: false },
        { id: 'eng-m-2', label: '정보보호 관리체계(ISMS-P)', done: false },
        { id: 'eng-m-3', label: '프로젝트 리스크/일정 관리', done: false },
      ],
    },
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
  checklist: [],
};

/** 과목 레지스트리. key는 과목 id. */
export const SUBJECT_CATALOG = {
  sqlp: SQLP,
  dap: DAP,
  eng: ENG,
  custom: CUSTOM,
};

/** 사이드 메뉴/드롭다운 렌더링용 배열 (선언 순서 유지). */
export const SUBJECT_LIST = [SQLP, DAP, ENG, CUSTOM];

/** 신규 사용자 기본 과목. 자격증 3종 중 가장 대표적인 SQLP로 시작. */
export const DEFAULT_SUBJECT_ID = 'sqlp';

/** 과목 id로 카탈로그 엔트리를 조회한다. 없으면 custom 폴백. */
export const getSubject = (id) => SUBJECT_CATALOG[id] || SUBJECT_CATALOG.custom;
