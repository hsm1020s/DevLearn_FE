/**
 * @fileoverview 학습 API Mock - 퀴즈 생성, 답안 채점, 통계 조회 시뮬레이션.
 * (PDF 업로드는 파인만 파이프라인으로 통합 — feynmanApi/mock 참조)
 */
import { generateId } from '../../utils/helpers';
import { getSubject } from '../../registry/subjects';
import { distributeCountsByParts } from '../../utils/examScoring';

const MOCK_DELAY = 500;

/** 과목 id → 문제 텍스트 프리픽스 매핑. 시연 시 과목 구분이 눈에 보이도록 한다. */
const SUBJECT_PREFIX = {
  sqlp: '[SQLP]',
  dap: '[DAP]',
  custom: '[사용자 PDF]',
};

/**
 * 지정된 조건에 맞는 Mock 퀴즈 문제를 생성한다.
 *
 * 카탈로그에 `parts`가 있는 과목(SQLP/DAP)은 실제 시험처럼 과목별 비율로 문항을
 * 배분하고 각 문제에 `part` id 태그를 붙여 결과 화면의 과목별 집계가 가능하게 한다.
 * parts가 없는 과목(custom 등)은 기존 균등 생성으로 폴백.
 */
export async function generateQuiz({ subject, chapters, count, types }) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY * 2));

  const prefix = SUBJECT_PREFIX[subject] || '[Mock]';
  const meta = subject ? getSubject(subject) : null;
  const parts = meta?.parts;

  // parts 존재 시: 과목별 비율로 배분 → [{partId, count}] → 순차 확장하며 part 태그 부여.
  // 없으면: 기존처럼 part 태그 없이 count만큼 균등 생성.
  const partAssignments = parts
    ? distributeCountsByParts(parts, count).flatMap((row) => {
        const partLabel = parts.find((p) => p.id === row.partId)?.label || row.partId;
        return Array.from({ length: row.count }, () => ({ partId: row.partId, partLabel }));
      })
    : Array.from({ length: count }, () => ({ partId: null, partLabel: null }));

  const questions = partAssignments.map((assign, i) => {
    const partSuffix = assign.partLabel ? ` · ${assign.partLabel}` : '';
    return {
      id: `q${i + 1}`,
      type: types[i % types.length],
      question: `${prefix}${partSuffix} — 샘플 문제 ${i + 1}번입니다. 다음 중 올바른 것은?`,
      options: ['보기 1', '보기 2', '보기 3', '보기 4'],
      answer: Math.floor(Math.random() * 4),
      explanation: `문제 ${i + 1}의 해설입니다. 정답은 해당 보기가 올바른 설명이기 때문입니다.`,
      chapter: chapters?.[i % (chapters?.length || 1)] || 1,
      // 과목 집계용 — parts 없으면 undefined로 남아 computePartsScore가 null 반환
      part: assign.partId || undefined,
    };
  });

  return { quizId: generateId(), subject, status: 'completed', questions };
}

/** 퀴즈 상태 폴링 Mock — 즉시 completed 반환(실 서비스 흐름을 단순 모사). */
export async function fetchQuizStatus(quizId) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return { quizId, status: 'completed', questions: [] };
}

/** 답안 제출을 시뮬레이션하고 랜덤 채점 결과를 반환한다 */
export async function submitAnswer({ subject, quizId, questionId, userAnswer }) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const correct = Math.random() > 0.4;
  return {
    correct,
    correctAnswer: correct ? userAnswer : (userAnswer + 1) % 4,
    // 채점 응답에도 subject를 에코해 호출부에서 상관관계를 확인할 수 있게 한다.
    subject,
    explanation: '이 문제의 핵심은 개념의 정확한 이해입니다. Mock 해설 데이터입니다.',
  };
}

/** 학습 누적 학습 통계 Mock 응답을 반환한다. subject 기반 다른 샘플 수치를 돌려준다. */
export async function getStudyStats(params = {}) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const { subject } = params;
  // 과목별로 다른 mock 수치 — 과목 스위칭 시 숫자가 바뀌는지 육안 확인용
  const SAMPLE = {
    sqlp:   { totalSolved:  72, correctCount: 54, correctRate: 0.75, hardRate: 0.52 },
    dap:    { totalSolved:  40, correctCount: 28, correctRate: 0.70, hardRate: 0.40 },
    custom: { totalSolved: 128, correctCount: 92, correctRate: 0.72, hardRate: 0.428 },
  };
  const s = SAMPLE[subject] || SAMPLE.custom;
  return {
    subject: subject || 'custom',
    totalSolved: s.totalSolved,
    correctCount: s.correctCount,
    correctRate: s.correctRate,
    byDifficulty: [
      { difficulty: 'easy',  total: Math.round(s.totalSolved * 0.45), correct: Math.round(s.correctCount * 0.55), rate: 0.86 },
      { difficulty: 'mixed', total: Math.round(s.totalSolved * 0.35), correct: Math.round(s.correctCount * 0.30), rate: 0.70 },
      { difficulty: 'hard',  total: Math.round(s.totalSolved * 0.20), correct: Math.round(s.correctCount * 0.15), rate: s.hardRate },
    ],
    byType: [
      { type: 'multiple', total: s.totalSolved, correct: s.correctCount, rate: s.correctRate },
    ],
  };
}
