/**
 * @fileoverview 관리자 대시보드 API Mock.
 * 실제 백엔드 응답과 동일한 스키마로 고정 샘플 데이터를 반환한다.
 * 스켈레톤 UX 확인을 위해 MOCK_DELAY(400ms)만큼 지연한다.
 */

const MOCK_DELAY = 400;

/** 관리자 대시보드 Mock 응답 — 고정 샘플 데이터 */
export async function getAdminDashboard() {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  return {
    counts: {
      totalConversations: 128,
      totalDocuments: 17,
      totalMindmapNodes: 342,
      totalQuizSolved: 89,
    },
    // 최근 대화 최대 8건 (id/title/mode/updatedAt) — 3개 모드 고루 포함
    recentConversations: [
      { id: 'c-001', title: 'React 18 Suspense 정리', mode: 'general', updatedAt: Date.now() - 1000 * 60 * 3 },
      { id: 'c-002', title: 'SQLP 튜닝 기출 오답노트', mode: 'study', updatedAt: Date.now() - 1000 * 60 * 32 },
      { id: 'c-003', title: '분기 회의록 정리', mode: 'worklearn', updatedAt: Date.now() - 1000 * 60 * 60 * 2 },
      { id: 'c-004', title: 'TypeScript 제네릭 복습', mode: 'general', updatedAt: Date.now() - 1000 * 60 * 60 * 5 },
      { id: 'c-005', title: 'DAP 정규화 핵심 요약', mode: 'study', updatedAt: Date.now() - 1000 * 60 * 60 * 12 },
      { id: 'c-006', title: '신규 인력 온보딩 체크리스트', mode: 'worklearn', updatedAt: Date.now() - 1000 * 60 * 60 * 30 },
      { id: 'c-007', title: 'HTTP 상태 코드 질문', mode: 'general', updatedAt: Date.now() - 1000 * 60 * 60 * 48 },
      { id: 'c-008', title: 'DAP 데이터 표준화 핵심 정리', mode: 'study', updatedAt: Date.now() - 1000 * 60 * 60 * 72 },
    ],
    // 문서 현황 (status 3종 모두 포함)
    documents: [
      { id: 'd-001', fileName: '정보처리기사_필기_요약.pdf', status: 'completed' },
      { id: 'd-002', fileName: '사내_운영_매뉴얼_v3.pdf', status: 'completed' },
      { id: 'd-003', fileName: '신규_규정_초안.pdf', status: 'processing' },
      { id: 'd-004', fileName: '깨진_스캔본.pdf', status: 'failed' },
    ],
  };
}
