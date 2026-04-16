/**
 * @fileoverview 자격증 API Mock - PDF 업로드, 퀴즈 생성, 답안 채점 시뮬레이션
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

/** 지정된 조건에 맞는 Mock 퀴즈 문제를 생성한다 */
export async function generateQuiz({ docIds, chapters, count, difficulty, types }) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY * 2));

  const questions = Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}`,
    type: types[i % types.length],
    question: `[Mock] 샘플 문제 ${i + 1}번입니다. 다음 중 올바른 것은?`,
    options: ['보기 1', '보기 2', '보기 3', '보기 4'],
    answer: Math.floor(Math.random() * 4),
    explanation: `문제 ${i + 1}의 해설입니다. 정답은 해당 보기가 올바른 설명이기 때문입니다.`,
    chapter: chapters?.[i % (chapters?.length || 1)] || 1,
  }));

  return { quizId: generateId(), questions };
}

/** 답안 제출을 시뮬레이션하고 랜덤 채점 결과를 반환한다 */
export async function submitAnswer({ quizId, questionId, userAnswer }) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const correct = Math.random() > 0.4;
  return {
    correct,
    correctAnswer: correct ? userAnswer : (userAnswer + 1) % 4,
    explanation: '이 문제의 핵심은 개념의 정확한 이해입니다. Mock 해설 데이터입니다.',
  };
}
