/**
 * @fileoverview 관리자 대시보드 데이터 로딩 훅.
 * 마운트 시 1회 서버 호출 후 {data, loading, error, refresh}를 반환한다.
 * refresh는 진행 중 호출을 차단(race 방지)하고, 실패 시 사용자 메시지는
 * err.userMessage 또는 기본 문구로 설정한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAdminDashboard } from '../services/adminApi';

/**
 * 관리자 대시보드 데이터 로딩 훅
 * @returns {{ data: object|null, loading: boolean, error: string|null, refresh: () => Promise<void> }}
 */
export default function useAdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // 진행 중 호출 여부를 ref로 추적하여 연속 refresh race 방지
  const inflightRef = useRef(false);

  const load = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminDashboard();
      setData(result);
    } catch (err) {
      // userMessage가 인터셉터에서 채워지므로 우선 사용, 없으면 기본 문구
      setError(err?.userMessage || '대시보드를 불러오지 못했습니다');
    } finally {
      setLoading(false);
      inflightRef.current = false;
    }
  }, []);

  // 마운트 시 1회 로드
  useEffect(() => {
    load();
  }, [load]);

  /** 수동 새로고침 — 진행 중이면 무시 */
  const refresh = useCallback(async () => {
    if (inflightRef.current) return;
    await load();
  }, [load]);

  return { data, loading, error, refresh };
}
