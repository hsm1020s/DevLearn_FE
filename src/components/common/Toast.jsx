import { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { create } from 'zustand';

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
