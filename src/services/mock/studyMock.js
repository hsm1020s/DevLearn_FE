/**
 * @fileoverview 학습 API Mock - PDF 업로드, 퀴즈 생성, 답안 채점 시뮬레이션
 */
import { generateId } from '../../utils/helpers';

const MOCK_DELAY = 500;

/** PDF 업로드를 시뮬레이션하고 Mock 문서 정보를 반환한다 */
export async function uploadPdf(file) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  return {
    docId: generateId(),
    fileName: file.name,
    pages: Math.floor(Math.random() * 200) + 50,
    chunks: Math.floor(Math.random() * 800) + 200,
    status: 'completed',
  };
}

/** 과목 id → 문제 텍스트 프리픽스 매핑. 시연 시 과목 구분이 눈에 보이도록 한다. */
const SUBJECT_PREFIX = {
  sqlp: '[SQLP]',
  dap: '[DAP]',
  eng: '[정보관리기술사]',
  custom: '[사용자 PDF]',
};

/**
 * 지정된 조건에 맞는 Mock 퀴즈 문제를 생성한다.
 * subject가 주어지면 문제 텍스트에 프리픽스를 덧붙여 과목 분기가 작동함을 가시화한다.
 */
export async function generateQuiz({ subject, docIds, chapters, count, difficulty, types }) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY * 2));

  const prefix = SUBJECT_PREFIX[subject] || '[Mock]';
  const questions = Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}`,
    type: types[i % types.length],
    question: `${prefix} 샘플 문제 ${i + 1}번입니다. 다음 중 올바른 것은?`,
    options: ['보기 1', '보기 2', '보기 3', '보기 4'],
    answer: Math.floor(Math.random() * 4),
    explanation: `문제 ${i + 1}의 해설입니다. 정답은 해당 보기가 올바른 설명이기 때문입니다.`,
    chapter: chapters?.[i % (chapters?.length || 1)] || 1,
  }));

  return { quizId: generateId(), subject, questions };
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
    eng:    { totalSolved:  18, correctCount:  9, correctRate: 0.50, hardRate: 0.30 },
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
      { type: 'multiple', total: Math.round(s.totalSolved * 0.60), correct: Math.round(s.correctCount * 0.60), rate: 0.75 },
      { type: 'ox',       total: Math.round(s.totalSolved * 0.25), correct: Math.round(s.correctCount * 0.28), rate: 0.80 },
      { type: 'short',    total: Math.round(s.totalSolved * 0.15), correct: Math.round(s.correctCount * 0.12), rate: 0.55 },
    ],
  };
}
