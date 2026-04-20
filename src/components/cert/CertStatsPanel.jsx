/**
 * @fileoverview 자격증 학습 누적 통계 패널 (모달 컨테이너).
 * GET /cert/stats 응답을 받아 loading / error / empty(총 풀이 0) / data 의 4-state로 렌더한다.
 * 기존 세션 전용 StudyStats.jsx와 목적이 다르며, 별도 모달로 노출된다.
 */
import { useCallback, useEffect, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import Button from '../common/Button';
import StatsSummaryCards from './StatsSummaryCards';
import StatsBreakdownChart from './StatsBreakdownChart';
import { getCertStats } from '../../services/certApi';
import { showError } from '../../utils/errorHandler';
import { formatDate } from '../../utils/formatters';
import {
  STATS_DIFFICULTY_LABELS,
  STATS_TYPE_LABELS,
} from '../../utils/constants';
import useAppStore from '../../stores/useAppStore';
import useCertStore from '../../stores/useCertStore';

/**
 * 서버 응답 `byDifficulty` 항목을 StatsBreakdownChart 표준 스키마로 변환한다.
 * @param {Array<{difficulty:string,total:number,correct:number,rate:number}>} arr
 */
function adaptDifficulty(arr) {
  return (arr ?? []).map((d) => ({
    key: d.difficulty,
    total: d.total,
    correct: d.correct,
    rate: d.rate,
  }));
}

/**
 * 서버 응답 `byType` 항목을 StatsBreakdownChart 표준 스키마로 변환한다.
 * @param {Array<{type:string,total:number,correct:number,rate:number}>} arr
 */
function adaptType(arr) {
  return (arr ?? []).map((t) => ({
    key: t.type,
    total: t.total,
    correct: t.correct,
    rate: t.rate,
  }));
}

/**
 * 자격증 누적 학습 통계 화면.
 * @param {Function} onDone - 닫기 콜백 (모달에서 주입)
 */
export default function CertStatsPanel({ onDone }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const setActiveModal = useAppStore((s) => s.setActiveModal);
  const setMainMode = useAppStore((s) => s.setMainMode);
  const setCertStep = useCertStore((s) => s.setCertStep);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCertStats();
      setData(res);
      setLastUpdatedAt(Date.now());
    } catch (err) {
      setError(err);
      showError(err, '학습 통계를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  // 마운트 시 1회 로드
  useEffect(() => {
    load();
  }, [load]);

  // 빈 상태에서 "퀴즈 설정 바로가기" 클릭 시 모달을 닫고 자격증 모드 업로드 단계로 이동
  const handleGoToQuizSetup = () => {
    setActiveModal(null);
    setMainMode('cert');
    setCertStep('upload');
  };

  // ---------- loading ----------
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[240px]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ---------- error ----------
  if (error && !data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="border border-danger/40 bg-danger/10 rounded-lg p-4 text-sm text-text-primary">
          통계를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onDone}>닫기</Button>
          <Button variant="primary" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4" />
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  const totalSolved = data?.totalSolved ?? 0;

  // ---------- empty ----------
  if (totalSolved === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <BarChart3 className="w-10 h-10 text-text-tertiary" />
          <p className="text-sm text-text-secondary">아직 풀이한 문제가 없습니다</p>
          <Button variant="primary" size="sm" onClick={handleGoToQuizSetup}>
            퀴즈 설정 바로가기
          </Button>
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onDone}>닫기</Button>
        </div>
      </div>
    );
  }

  // ---------- data ----------
  const byDifficulty = adaptDifficulty(data.byDifficulty);
  const byType = adaptType(data.byType);

  return (
    <div className="flex flex-col gap-5">
      <StatsSummaryCards
        totalSolved={data.totalSolved}
        correctCount={data.correctCount}
        correctRate={data.correctRate}
      />

      <StatsBreakdownChart
        title="난이도별 성적"
        items={byDifficulty}
        labelMap={STATS_DIFFICULTY_LABELS}
      />

      <StatsBreakdownChart
        title="유형별 성적"
        items={byType}
        labelMap={STATS_TYPE_LABELS}
      />

      {/* 하단 액션 바: 좌측 마지막 업데이트, 우측 새로고침/닫기 */}
      <div className="flex items-center justify-between pt-2 border-t border-border-light">
        <span className="text-xs text-text-tertiary">
          마지막 업데이트: {lastUpdatedAt ? formatDate(lastUpdatedAt) : '방금 전'}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button variant="secondary" size="sm" onClick={onDone}>닫기</Button>
        </div>
      </div>
    </div>
  );
}
