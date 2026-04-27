/**
 * @fileoverview 로컬 LLM 활동 모니터 본문 — 단독 페이지 / 드로어 양쪽에서 재사용한다.
 *
 * 백엔드 GET /api/public/llm-activity 를 2초 폴링하고 다음 3섹션을 그린다:
 *  1) 진행 중 호출 카드 (source / model / action / target / 경과)
 *  2) 소스별 누적 통계 (호출 수, 실패율, 평균 지연)
 *  3) 최근 완료/실패 로그 표 (ring buffer 200건)
 *
 * 응답에는 식별자(docId 8자, conversationId 8자, chapter 이름) 와 길이 메트릭만 들어 있어
 * 권한 없이 노출돼도 안전하다.
 */
import { useEffect, useRef, useState } from 'react';
import { fetchLlmActivity } from '../../services/monitorApi';

const POLL_INTERVAL_MS = 2000;

/**
 * "doc=abcd1234,chapter=DB 정규화" 같은 target 문자열을 key/value 맵으로 분해.
 * 값이 없으면 빈 객체 반환.
 */
function parseTarget(target) {
  if (!target) return {};
  const out = {};
  for (const part of target.split(',')) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    }
  }
  return out;
}

/**
 * source / action / target 조합을 한 줄짜리 한국어 설명으로 변환한다.
 * 모니터를 보는 사람이 "지금 무슨 작업이 돌고 있는지" 즉시 파악할 수 있도록 한다.
 *
 * 식별자(docId 8자, chapter 이름) 외 민감 정보는 서버에서 이미 마스킹돼 있어 그대로 노출 안전.
 */
function describePurpose(rec) {
  const t = parseTarget(rec.target);
  const ch = t.chapter ? `'${t.chapter}'` : '';
  const doc = t.doc ? `문서 ${t.doc}` : '';
  switch (rec.source) {
    case 'chat':
      return rec.action === 'stream'
        ? `일반 채팅 스트리밍${t.mode ? ` (${t.mode} 모드)` : ''}`
        : `일반 채팅 응답${t.mode ? ` (${t.mode} 모드)` : ''}`;
    case 'feynman-verify':
      return `파인만 검증 — ${ch || '챕터'} 사용자 설명 채점${doc ? ` · ${doc}` : ''}`;
    case 'feynman-stream':
      return `파인만 대화 스트리밍 — ${ch || '챕터'}${doc ? ` · ${doc}` : ''}`;
    case 'feynman-grade':
      return `파인만 답변 채점 — ${ch || '챕터'} 모범답안 대조${doc ? ` · ${doc}` : ''}`;
    case 'feynman-synth':
      return `파인만 질문 합성 — ${ch || '챕터'} 핵심 개념 추출 + 질문 생성${doc ? ` · ${doc}` : ''}`;
    case 'mindmap-synth':
      return `마인드맵 합성 — ${ch || '챕터'} 트리 구조 생성${t.attempt ? ` (시도 ${t.attempt})` : ''}`;
    case 'study-quiz':
      return `학습 모드 퀴즈 생성${t.promptChars ? ` (프롬프트 ${t.promptChars}자)` : ''}`;
    case 'pipeline-toc':
      return '파이프라인: 목차 추출 — PDF 앞부분에서 챕터 목록 LLM 분석';
    case 'pipeline-embed':
      return `파이프라인: 임베딩 — ${ch || '챕터'} 청크 벡터화${doc ? ` · ${doc}` : ''}`;
    case 'embedding-client':
      return '임베딩 — 사용자 입력 벡터화 (RAG 검색용)';
    case 'unknown':
      return '컨텍스트 미상 (호출자 라벨 없음)';
    default:
      return rec.source;
  }
}

function formatDuration(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function InflightCard({ rec, nowMs }) {
  const elapsed = Math.max(0, nowMs - rec.startedAtMs);
  const purpose = describePurpose(rec);
  return (
    <div className="rounded-lg border border-border-light bg-bg-secondary p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary shrink-0">
            {rec.source}
          </span>
        </div>
        <span className="font-mono text-xs text-text-secondary shrink-0">{formatDuration(elapsed)}</span>
      </div>
      <div className="text-sm text-text-primary font-medium mb-1 leading-snug">
        {purpose}
      </div>
      <div className="text-xs text-text-secondary mb-0.5 truncate">
        <span className="font-mono">{rec.model || 'unknown'}</span>
        <span className="text-text-tertiary"> · {rec.action}</span>
        {rec.inputChars > 0 && (
          <span className="text-text-tertiary ml-2">입력 {rec.inputChars.toLocaleString()}자</span>
        )}
      </div>
      {rec.target && (
        <div className="font-mono text-[11px] text-text-tertiary truncate">{rec.target}</div>
      )}
      <div className="font-mono text-[10px] text-text-tertiary mt-1">
        {formatTime(rec.startedAtMs)} · job {rec.jobId.slice(0, 8)}
      </div>
    </div>
  );
}

function RecentRow({ rec }) {
  const isError = rec.status === 'error';
  const purpose = describePurpose(rec);
  return (
    <tr className="border-b border-border-light last:border-0">
      <td className="py-1.5 px-2 font-mono text-xs text-text-tertiary whitespace-nowrap align-top">
        {formatTime(rec.startedAtMs)}
      </td>
      <td className="py-1.5 px-2 align-top">
        <div className="text-xs text-text-primary leading-snug">{purpose}</div>
        <div className="text-[10px] text-text-tertiary mt-0.5 font-mono truncate max-w-[24rem]" title={rec.target || ''}>
          <span className="text-text-secondary">{rec.source}</span>
          <span> · {rec.action}</span>
          {rec.target && <span> · {rec.target}</span>}
        </div>
      </td>
      <td className="py-1.5 px-2 text-xs text-text-primary whitespace-nowrap align-top">{rec.model}</td>
      <td className="py-1.5 px-2 font-mono text-xs text-right whitespace-nowrap align-top">
        {formatDuration(rec.durationMs)}
      </td>
      <td className="py-1.5 px-2 font-mono text-xs text-right whitespace-nowrap text-text-tertiary align-top">
        {rec.inputChars > 0 ? `${rec.inputChars.toLocaleString()}→${(rec.outputChars ?? 0).toLocaleString()}` : '—'}
      </td>
      <td className="py-1.5 px-2 text-xs whitespace-nowrap align-top">
        {isError
          ? <span className="text-danger" title={rec.error || ''}>실패</span>
          : <span className="text-success">ok</span>}
      </td>
    </tr>
  );
}

function StatsCard({ source, view }) {
  const failRate = view.total === 0 ? 0 : (view.failures / view.total) * 100;
  return (
    <div className="rounded-md border border-border-light bg-bg-secondary px-3 py-2">
      <div className="font-mono text-xs text-text-primary truncate">{source}</div>
      <div className="text-[11px] text-text-tertiary mt-0.5">
        총 <span className="font-mono">{view.total}</span> ·
        실패 <span className={`font-mono ${view.failures > 0 ? 'text-danger' : ''}`}>{view.failures}</span>
        {view.total > 0 && (
          <span className={`font-mono ml-1 ${failRate > 0 ? 'text-warning' : ''}`}>
            ({failRate.toFixed(0)}%)
          </span>
        )}
        <span className="ml-2">평균 <span className="font-mono">{formatDuration(view.avgDurationMs)}</span></span>
      </div>
    </div>
  );
}

/**
 * 본문 패널 — 단독 페이지/드로어 어디서든 그대로 렌더한다.
 * @param {boolean} [paused=false] - true 이면 폴링 중단(드로어 닫힘 등에서 호출 부담 줄이기 용)
 * @param {string} [className] - 외곽 컨테이너 추가 클래스
 */
export default function LlmActivityPanel({ paused = false, className = '' }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const intervalRef = useRef(null);
  const tickRef = useRef(null);

  useEffect(() => {
    if (paused) return undefined;
    let cancelled = false;
    async function load() {
      try {
        const snap = await fetchLlmActivity();
        if (!cancelled) {
          setData(snap);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || '연결 실패');
      }
    }
    load();
    intervalRef.current = setInterval(load, POLL_INTERVAL_MS);
    tickRef.current = setInterval(() => setNowMs(Date.now()), 500);
    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
      clearInterval(tickRef.current);
    };
  }, [paused]);

  const inflight = data?.inflight ?? [];
  // 최근 로그는 화면을 길게 차지하지 않도록 상위 10건만 노출. 더 깊은 추적이 필요하면 BE 로그를 본다.
  const recent = (data?.recent ?? []).slice(0, 10);
  const stats = data?.stats ?? {};
  // 백엔드 라이브 로그 테일(가장 최근이 head). 화면에서는 상위 50줄만 그린다.
  const logs = (data?.logs ?? []).slice(0, 50);

  return (
    <div className={`text-text-primary ${className}`}>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs text-text-secondary">
          진행 중 <span className="font-mono">{inflight.length}</span> 건 ·
          최근 로그 <span className="font-mono">{recent.length}</span> 건
        </p>
        <span className="text-[11px] text-text-tertiary font-mono">
          {error ? <span className="text-danger">⚠ {error}</span>
                 : (paused ? '일시 정지됨' : '2s 폴링 · 권한 없이 접근 가능')}
        </span>
      </div>

      <section className="mb-4">
        <h3 className="text-xs font-medium text-text-secondary mb-2">진행 중</h3>
        {inflight.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-light bg-bg-secondary/50 px-4 py-5 text-center text-xs text-text-tertiary">
            현재 진행 중인 LLM 호출이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {inflight.map((rec) => (
              <InflightCard key={rec.jobId} rec={rec} nowMs={nowMs} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-4">
        <h3 className="text-xs font-medium text-text-secondary mb-2">소스별 통계</h3>
        {Object.keys(stats).length === 0 ? (
          <div className="text-xs text-text-tertiary">아직 누적된 호출이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(stats)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([source, view]) => (
                <StatsCard key={source} source={source} view={view} />
              ))}
          </div>
        )}
      </section>

      <section className="mb-4">
        <h3 className="text-xs font-medium text-text-secondary mb-2">백엔드 라이브 로그</h3>
        {logs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-light bg-bg-secondary/50 px-4 py-3 text-center text-xs text-text-tertiary">
            아직 캡처된 로그가 없습니다. (백엔드 com.moon.devlearn.* 패키지의 모든 log.info / .warn / .error 가 흘러옵니다)
          </div>
        ) : (
          <div className="rounded-lg border border-border-light bg-black/85 text-text-primary overflow-hidden">
            <div className="max-h-72 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
              {logs.map((l, i) => (
                <div key={`${l.timestampMs}-${i}`} className="whitespace-pre-wrap break-words">
                  <span className="text-text-tertiary">{formatTime(l.timestampMs)}</span>
                  <span className={`ml-2 ${
                    l.level === 'ERROR' ? 'text-danger' :
                    l.level === 'WARN' ? 'text-warning' :
                    'text-text-secondary'
                  }`}>{l.level.padEnd(5)}</span>
                  <span className="ml-2 text-primary">{l.logger}</span>
                  <span className="ml-2 text-text-primary">{l.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-medium text-text-secondary mb-2">최근 LLM 호출 (최대 10건)</h3>
        <div className="rounded-lg border border-border-light bg-bg-secondary/50 overflow-hidden">
          {recent.length === 0 ? (
            <div className="px-4 py-5 text-center text-xs text-text-tertiary">아직 기록된 호출이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-bg-tertiary/50">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-text-tertiary">
                    <th className="py-1.5 px-2">시각</th>
                    <th className="py-1.5 px-2">작업</th>
                    <th className="py-1.5 px-2">모델</th>
                    <th className="py-1.5 px-2 text-right">지연</th>
                    <th className="py-1.5 px-2 text-right">in→out</th>
                    <th className="py-1.5 px-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((rec) => (
                    <RecentRow key={rec.jobId} rec={rec} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
