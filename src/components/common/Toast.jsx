/**
 * @fileoverview 토스트 알림 시스템
 * Zustand 스토어로 토스트 목록을 관리하고, 3초 후 자동 제거한다.
 * ToastContainer를 앱 루트에 배치하여 사용한다.
 */
import { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { create } from 'zustand';

/** 토스트 상태 관리 스토어 - addToast로 메시지 추가, 3초 후 자동 삭제 */
export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Date.now();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const ICON = { success: CheckCircle, error: AlertCircle, info: AlertCircle };
const COLOR = {
  success: 'bg-success text-white',
  error: 'bg-danger text-white',
  info: 'bg-primary text-white',
};

/** 개별 토스트 아이템 - 타입별 아이콘·색상을 적용하고 수동 닫기 지원 */
function ToastItem({ toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const Icon = ICON[toast.type] || ICON.info;

  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${COLOR[toast.type] || COLOR.info}`}>
      <Icon size={16} className="shrink-0" />
      <span className="text-sm flex-1">{toast.message}</span>
      <button onClick={() => removeToast(toast.id)} className="shrink-0 hover:opacity-70">
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
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
