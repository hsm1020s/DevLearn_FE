/**
 * @fileoverview 모의고사 타이머.
 * useStudyStore.quizTimerSec이 null이 아니면 자동으로 1초마다 감소시키며
 * 0에 도달하면 onExpire 콜백을 호출한다. quizPaused 플래그에 따라 일시정지된다.
 */
import { useEffect } from 'react';
import { Clock, Pause, Play } from 'lucide-react';
import useStudyStore from '../../stores/useStudyStore';

/** mm:ss 포맷 */
function formatMMSS(totalSec) {
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * 모의고사 타이머 위젯 + 수동 일시정지 버튼.
 * @param {Function} [onExpire] - 남은 시간 0초 도달 시 호출
 */
export default function QuizTimer({ onExpire }) {
  const timerSec = useStudyStore((s) => s.quizTimerSec);
  const paused = useStudyStore((s) => s.quizPaused);
  const tick = useStudyStore((s) => s.tickQuizTimer);
  const setPaused = useStudyStore((s) => s.setQuizPaused);

  // 1초마다 감소 — paused 또는 timerSec null이면 스킵
  useEffect(() => {
    if (timerSec === null || paused) return;
    if (timerSec <= 0) {
      onExpire?.();
      return;
    }
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timerSec, paused, tick, onExpire]);

  if (timerSec === null) return null;

  const danger = timerSec <= 60;
  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium tabular-nums
          ${danger ? 'bg-danger/10 text-danger' : 'bg-bg-secondary text-text-primary'}
        `}
        title="남은 시간"
      >
        <Clock size={14} />
        {formatMMSS(timerSec)}
      </div>
      <button
        onClick={() => setPaused(!paused)}
        title={paused ? '재개' : '일시정지'}
        className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
    </div>
  );
}
