/**
 * @fileoverview 채팅 API Mock - 개발/테스트용 채팅 응답 시뮬레이션.
 *
 * 학습 모드 스타일 지시문(`[학습 모드 지시문] … 파인만 기법 …`)을 문자열 시작 토큰 +
 * 키워드 조합으로 감지해 응답을 변형한다. 지시문 포맷은
 * `src/hooks/useStreamingChat.js`의 `STYLE_PROMPT`와 동기화되어야 한다.
 */
import { generateId } from '../../utils/helpers';

const MOCK_DELAY = 300;

/** 모듈 스코프 Mock 대화 저장소 — 목록/수정/삭제 API에서 공유한다 */
const mockConversations = [];

/** 모드별 기본 Mock 응답 텍스트 */
const MOCK_RESPONSES = {
  general: '안녕하세요! 무엇이든 물어보세요. 검색, 코딩, 일반 지식 등 다양한 주제에 대해 도움을 드릴 수 있습니다.',
  study: '학습을 도와드리겠습니다. 어떤 주제를 준비하고 계신가요?',
};

/** 학습 스타일별 응답 빌더 — 실제 LLM 연동 전 UX 확인용 간이 응답. */
function buildStyledResponse(topic, style) {
  // 지시문 전체 블록을 떼어내고 실제 사용자 질문만 남긴다(`사용자 메시지:\n` 뒤 본문).
  const m = topic.match(/사용자 메시지:\s*\n([\s\S]*)$/);
  const cleanTopic = (m ? m[1] : topic).trim() || '해당 주제';
  if (style === 'feynman') {
    return [
      `🧠 **파인만 모드** — "${cleanTopic}"에 대해 본인의 말로 설명해보세요.`,
      '',
      '설명을 받으면 다음을 점검해드리겠습니다:',
      '1. 누락된 핵심 개념',
      '2. 잘못 이해하고 있는 부분',
      '3. 초보자가 이해하기 어려운 표현',
      '',
      '_(Mock 응답입니다. 백엔드 연결 시 실제 점검 프롬프트로 대체됩니다.)_',
    ].join('\n');
  }
  return null;
}

/**
 * 메시지 내용에서 학습 스타일 지시문을 감지한다.
 * `STYLE_PROMPT` 포맷은 `[학습 모드 지시문] …` 으로 시작하고 본문에 "파인만 기법"
 * 키워드를 포함한다. 시작 토큰이 없거나 키워드가 없으면 'general'.
 */
function detectStyle(message) {
  if (!message || !message.startsWith('[학습 모드 지시문]')) return 'general';
  if (message.includes('파인만 기법')) return 'feynman';
  return 'general';
}

/** 단일 메시지 전송을 시뮬레이션하고 Mock 응답을 반환한다 */
export async function sendMessage({ message, mode, llm, conversationId }) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));

  const style = detectStyle(message);
  const styled = buildStyledResponse(message, style);
  const responseText = styled
    || MOCK_RESPONSES[mode]
    || `"${message}"에 대한 답변입니다.\n\n이것은 **Mock 응답**입니다. 백엔드 연동 시 실제 LLM(${llm}) 응답으로 대체됩니다.`;

  return {
    id: generateId(),
    role: 'assistant',
    content: responseText,
    conversationId: conversationId || generateId(),
  };
}

/** 스트리밍 응답을 글자 단위로 시뮬레이션한다 */
export async function streamMessage({ message, mode, llm, conversationId, onToken, onDone, signal }) {
  const style = detectStyle(message);
  const styled = buildStyledResponse(message, style);
  const fullText = styled
    || MOCK_RESPONSES[mode]
    || `"${message}"에 대한 답변입니다.\n\n이것은 **Mock 스트리밍 응답**입니다.`;

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
  });
}

/** 서버에 저장된 대화 목록을 반환하는 Mock */
export async function listConversations() {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  return mockConversations.map((c) => ({ ...c }));
}

/** 대화 메타데이터를 부분 갱신하는 Mock */
export async function updateConversation(id, patch) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const idx = mockConversations.findIndex((c) => c.id === id);
  if (idx === -1) {
    // 존재하지 않으면 새로 추가 (로컬에서 만든 대화가 서버에 없는 경우 대비)
    const now = new Date().toISOString();
    const created = { id, createdAt: now, updatedAt: now, ...patch };
    mockConversations.unshift(created);
    return { ...created };
  }
  mockConversations[idx] = {
    ...mockConversations[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return { ...mockConversations[idx] };
}

/** 대화 목록을 일괄 삭제하는 Mock */
export async function deleteConversations(ids) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const idSet = new Set(ids);
  const before = mockConversations.length;
  for (let i = mockConversations.length - 1; i >= 0; i--) {
    if (idSet.has(mockConversations[i].id)) mockConversations.splice(i, 1);
  }
  const deleted = before - mockConversations.length;
  return { deletedIds: deleted > 0 ? ids : [] };
}
