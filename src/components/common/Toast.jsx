/**
 * @fileoverview 토스트 알림 시스템.
 * Zustand 스토어로 토스트 목록을 관리하고, 타입별 자동 제거 시간을 적용한다.
 * (success/info 3초, error 5초 — 에러 본문은 백엔드 메시지가 길어질 수 있어 더 오래 띄움.)
 *
 * 메시지는 두 가지 형태를 모두 받는다:
 *  - 문자열 — 기존 단일 라인 노출
 *  - 객체 `{ title?, body, code? }` — 제목(굵게)·본문·errorCode 칩 분리 노출.
 *
 * ToastContainer를 앱 루트에 배치하여 사용한다.
 */
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { create } from 'zustand';

/** 토스트 타입별 자동 제거 시간(ms). */
const AUTO_DISMISS_MS = {
  success: 3000,
  info: 3000,
  error: 5000,
};

/** 토스트 상태 관리 스토어 — addToast로 메시지 추가, 타입별로 자동 삭제. */
export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    const timeout = AUTO_DISMISS_MS[type] ?? 3000;
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, timeout);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const ICON = { success: CheckCircle, error: AlertCircle, info: AlertCircle };
const COLOR = {
  success: 'bg-success text-white',
  error: 'bg-danger text-white',
  info: 'bg-primary text-white',
};

/** 메시지가 객체이면 분해, 아니면 문자열 그대로 본문에 사용. */
function normalizeMessage(message) {
  if (message && typeof message === 'object') {
    return {
      title: message.title || null,
      body: message.body || '',
      code: message.code || null,
    };
  }
  return { title: null, body: String(message ?? ''), code: null };
}

/** 개별 토스트 아이템 — 타입별 아이콘·색상 적용, 제목/본문/errorCode 분리 렌더. */
function ToastItem({ toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const Icon = ICON[toast.type] || ICON.info;
  const { title, body, code } = normalizeMessage(toast.message);

  return (
    <div
      role="status"
      className={`flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg ${COLOR[toast.type] || COLOR.info}`}
    >
      <Icon size={16} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-sm">
        {title && <div className="font-semibold leading-tight mb-0.5">{title}</div>}
        <div className="leading-snug break-words">{body}</div>
        {code && (
          <div className="mt-1 inline-block px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono tracking-wide">
            {code}
          </div>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        aria-label="토스트 닫기"
        className="shrink-0 hover:opacity-70 mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/** 토스트 목록을 화면 우하단에 렌더링하는 컨테이너 */
export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
