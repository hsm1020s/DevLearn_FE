/**
 * @fileoverview 공부 모드 학습 컨텍스트 카탈로그.
 *
 * 과거에는 SQLP/DAP/사용자 정의 3개 자격증 과목으로 분기했으나, 지금은 자격증
 * 색채를 걷어내고 단일 "공부" 컨텍스트로 통합한다. 외부 API/스토어 호환을 위해
 * bucket id `'sqlp'`는 그대로 두지만(persist 마이그레이션 회피), 사용자에게
 * 노출되는 라벨/설명/예시는 자격증과 무관한 일반 학습 표현으로 변경.
 *
 * 새로운 학습 컨텍스트(예: 추후 영어 학습 등)를 추가하려면 이 파일에 엔트리만
 * 더하면 된다. parts/passingCriteria는 nullable 이며 null이면 모의고사 결과
 * 화면이 단순 정답률만 표시한다.
 */

/** 공부 모드 단일 학습 컨텍스트 — PDF 기반 자유 학습. */
const STUDY = {
  id: 'sqlp', // 기존 persist 데이터 호환을 위해 bucket key 유지
  label: '공부',
  description: 'PDF 업로드 후 자동 출제 · 즉시 채점 · 오답 정리',
  examPreset: { count: 30, difficulty: 'mixed', timerSec: 30 * 60 },
  parts: null,
  passingCriteria: null,
  examples: [
    '핵심 개념 3개로 요약해줘',
    '이 문서의 토픽을 트리로 정리해줘',
    '헷갈릴 만한 용어 비교표 만들어줘',
  ],
};

/** 학습 컨텍스트 레지스트리. key는 bucket id. */
export const SUBJECT_CATALOG = {
  sqlp: STUDY,
};

/** 신규 사용자 버킷 초기화에 사용. */
export const SUBJECT_LIST = [STUDY];

/** 기본 활성 컨텍스트 id. */
export const DEFAULT_SUBJECT_ID = 'sqlp';

/**
 * 컨텍스트 id로 카탈로그 엔트리를 조회. 미일치 시 기본 STUDY로 폴백.
 * 기존 사용자 persist 데이터에 dap/custom 버킷이 남아 있을 수 있어 이 폴백이
 * 안전망 역할을 한다.
 */
export const getSubject = (id) => SUBJECT_CATALOG[id] || STUDY;
