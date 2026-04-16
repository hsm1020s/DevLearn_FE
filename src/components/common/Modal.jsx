/**
 * @fileoverview 공통 모달 다이얼로그 컴포넌트
 * 오버레이 배경 클릭 또는 닫기 버튼으로 닫을 수 있다.
 */
import { X } from 'lucide-react';

/**
 * 모달 다이얼로그
 * @param {boolean} isOpen - 모달 표시 여부
 * @param {Function} onClose - 모달 닫기 콜백
 * @param {string} title - 모달 헤더 제목
 * @param {ReactNode} children - 모달 본문 콘텐츠
 */
export default function Modal({ isOpen, onClose, title, children, className = '' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="모달 닫기"
      />
      <div
        className={`
          relative bg-white rounded-lg border border-border-light
          w-full max-w-lg mx-4 max-h-[80vh] flex flex-col
          ${className}
        `}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-secondary text-text-secondary"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
