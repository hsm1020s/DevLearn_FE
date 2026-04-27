/**
 * @fileoverview 우하단 플로팅 버튼 + 우측 슬라이드 드로어 — 어떤 화면에 있든 모니터를 빠르게 열 수 있다.
 *
 * 권한 없이 접근 가능한 /api/public/llm-activity 만 사용하므로 비로그인 화면에서도 안전하게 마운트.
 * 드로어가 닫힌 동안에는 폴링을 멈춰 백엔드 부하를 줄인다.
 */
import { useEffect, useState } from 'react';
import { Activity, X } from 'lucide-react';
import LlmActivityPanel from './LlmActivityPanel';

/** 전역 마운트용 FAB + 드로어. 별도 props 없음. */
export default function LlmActivityFab() {
  const [open, setOpen] = useState(false);

  // ESC 로 닫기
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={open ? '모니터 닫기' : '로컬 LLM 활동 모니터'}
        aria-label="로컬 LLM 활동 모니터"
        className={`
          fixed bottom-4 right-4 z-40
          w-11 h-11 rounded-full shadow-lg
          flex items-center justify-center
          border border-border-light
          ${open ? 'bg-primary text-white' : 'bg-bg-secondary text-text-primary hover:bg-bg-tertiary'}
          transition-colors
        `}
      >
        <Activity size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-label="드로어 닫기"
          />
          <aside
            role="dialog"
            aria-label="로컬 LLM 활동 모니터"
            className="
              relative h-full w-full max-w-[640px]
              bg-bg-primary border-l border-border-light shadow-2xl
              flex flex-col
            "
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-border-light bg-bg-secondary/60">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-primary" />
                <h2 className="text-sm font-semibold">로컬 LLM 활동 모니터</h2>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/llm-activity"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-text-secondary hover:text-text-primary underline-offset-2 hover:underline"
                  title="새 탭에서 전체 화면으로 열기"
                >
                  전체 화면 ↗
                </a>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
                  aria-label="닫기"
                >
                  <X size={16} />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <LlmActivityPanel />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
