/**
 * @fileoverview RAG API Mock - 문서 업로드, 목록 조회, 질의응답, 원문 조회, 삭제 시뮬레이션.
 * 모듈 스코프 Map을 사용하여 업로드/조회/삭제가 일관된 상태를 공유한다.
 */
import { generateId } from '../../utils/helpers';

const MOCK_DELAY = 500;

/**
 * 모듈 스코프 문서 저장소 (업로드/목록/삭제 공유용)
 * @type {Map<string, {docId: string, fileName: string, pages: number, chunks: number, status: string, progress: number, uploadedAt: number}>}
 */
const mockDocs = new Map();

/** 현재까지 업로드된 문서 목록을 반환한다 */
export async function listRagDocs() {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  // 스토어가 기대하는 필드: { id, fileName, status, progress, pages, chunks }
  return Array.from(mockDocs.values()).map((d) => ({
    id: d.docId,
    fileName: d.fileName,
    status: d.status,
    progress: d.progress,
    pages: d.pages,
    chunks: d.chunks,
  }));
}

/** 문서 업로드를 시뮬레이션하고 Mock 청크 분할 결과를 반환한다 */
export async function uploadDocument(file) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const docId = generateId();
  const doc = {
    docId,
    fileName: file.name,
    pages: Math.floor(Math.random() * 100) + 20,
    chunks: Math.floor(Math.random() * 300) + 50,
    status: 'completed',
    progress: 100,
    uploadedAt: Date.now(),
  };
  mockDocs.set(docId, doc);
  return {
    docId,
    fileName: doc.fileName,
    pages: doc.pages,
    chunks: doc.chunks,
    status: doc.status,
  };
}

/** RAG 질의를 시뮬레이션하고 Mock 답변과 출처를 반환한다 */
export async function queryRag({ query, topK = 5 }) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY * 2));
  return {
    answer: `"${query}"에 대한 RAG 기반 답변입니다.\n\n사내 문서를 기반으로 답변을 생성했습니다. 이것은 Mock 데이터입니다.`,
    sources: [
      {
        chunkId: 'mock-chunk-0',
        docId: 'mock-doc-1',
        docName: '사내규정.pdf',
        page: 24,
        chunk: '관련 내용이 여기에 표시됩니다...',
        similarity: 0.94,
      },
      {
        chunkId: 'mock-chunk-1',
        docId: 'mock-doc-2',
        docName: '개발가이드.pdf',
        page: 12,
        chunk: '추가 관련 내용입니다...',
        similarity: 0.87,
      },
    ],
  };
}

/** 청크 ID로 원문 텍스트 조회를 시뮬레이션한다 */
export async function getSource(chunkId) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  return {
    chunkId,
    docName: '사내규정.pdf',
    page: 24,
    fullText: 'Mock 원문 텍스트입니다. 실제 API 연동 시 원문 내용이 표시됩니다.',
    highlightRange: [0, 50],
  };
}

/** 문서 삭제를 시뮬레이션한다 */
export async function deleteDocument(docId) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  mockDocs.delete(docId);
  return { success: true };
}
