/**
 * @fileoverview 채팅 API Mock - 개발/테스트용 채팅 응답 시뮬레이션
 */
import { generateId } from '../../utils/helpers';

const MOCK_DELAY = 300;

/** 모드별 기본 Mock 응답 텍스트 */
const MOCK_RESPONSES = {
  general: '안녕하세요! 무엇이든 물어보세요. 검색, 코딩, 일반 지식 등 다양한 주제에 대해 도움을 드릴 수 있습니다.',
  cert: '자격증 학습을 도와드리겠습니다. 어떤 자격증을 준비하고 계신가요?',
  work: '업무 문서를 기반으로 답변드리겠습니다. 궁금한 내용을 질문해주세요.',
};

/** 단일 메시지 전송을 시뮬레이션하고 Mock 응답을 반환한다 */
export async function sendMessage({ message, mode, llm, conversationId }) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));

  const responseText = MOCK_RESPONSES[mode] ||
    `"${message}"에 대한 답변입니다.\n\n이것은 **Mock 응답**입니다. 백엔드 연동 시 실제 LLM(${llm}) 응답으로 대체됩니다.`;

  return {
    id: generateId(),
    role: 'assistant',
    content: responseText,
    conversationId: conversationId || generateId(),
    sources: mode === 'work'
      ? [{ docId: 'mock-1', docName: '샘플문서.pdf', page: 1, chunk: '관련 내용...', similarity: 0.92 }]
      : undefined,
  };
}

/** 스트리밍 응답을 글자 단위로 시뮬레이션한다 */
export async function streamMessage({ message, mode, llm, conversationId, onToken, onDone, signal }) {
  const fullText = MOCK_RESPONSES[mode] ||
    `"${message}"에 대한 답변입니다.\n\n이것은 **Mock 스트리밍 응답**입니다.`;

  const words = fullText.split('');
  let accumulated = '';

  for (const char of words) {
    if (signal?.aborted) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
    accumulated += char;
    onToken?.(accumulated);
  }

  if (signal?.aborted) return;
  onDone?.({
    conversationId: conversationId || generateId(),
    content: accumulated,
    sources: mode === 'work'
      ? [{ docId: 'mock-1', docName: '샘플문서.pdf', page: 1, chunk: '관련 내용...', similarity: 0.92 }]
      : undefined,
  });
}
