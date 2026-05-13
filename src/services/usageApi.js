/**
 * @fileoverview LLM 사용량 합계 API 서비스.
 *
 * BE 의 GET /api/usage/summary 를 호출해 오늘/이번주/이번달 합계를 받아 표시한다.
 * USD 가 1차 단위이고 KRW 는 BE 에서 환율(application.yml llm.pricing.krw-per-usd, 기본 1500)
 * 을 곱해 동봉한다. FE 는 단순히 표시만.
 */
import api from './api';

/**
 * 내 사용량 요약.
 * @returns {Promise<{
 *   today: { inputTokens: number, outputTokens: number, costUsd: string|number, costKrw: number },
 *   week:  { ... },
 *   month: { ... },
 *   krwPerUsd: number
 * }>}
 */
export async function getUsageSummary() {
  const { data } = await api.get('/usage/summary');
  return data.data;
}

/**
 * [관리자] 사용자별 LLM 사용량 (Phase 4 에서 사용).
 * @param {string} period today | week | month | total
 */
export async function getAdminUsage(period = 'month') {
  const { data } = await api.get('/admin/usage', { params: { period } });
  return data.data;
}
