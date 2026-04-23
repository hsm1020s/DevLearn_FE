/**
 * @fileoverview 사이드바에서 파인만 파이프라인 화면을 큰 팝업으로 띄우기 위한 모달.
 * 내부에 기존 `FeynmanPipelineTab` 컴포넌트를 그대로 렌더하여 파인만 모드 탭과 동일한
 * UX(PDF 업로드 · 파이프라인 실행 · 상태 폴링)를 사이드바 경로에서도 제공한다.
 * isOpen=false 일 때는 자식이 마운트되지 않으므로 폴링/초기 로드가 발생하지 않는다.
 */
import { useEffect } from 'react';
import { X } from 'lucide-react';
import FeynmanPipelineTab from '../feynman/FeynmanPipelineTab';

/**
 * 문서 파이프라인 모달
 * @param {object} props
 * @param {boolean} props.isOpen - 모달 표시 여부
 * @param {() => void} props.onClose - 모달 닫기 콜백 (오버레이/X/ESC 공통)
 */
export default function FeynmanPipelineModal({ isOpen, onClose }) {
  // ESC 키로 닫기 — 열려 있는 동안만 리스너 부착
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="모달 닫기"
      />
      {/* 본체 */}
      <div
        className="
          relative bg-bg-primary rounded-xl border border-border-light shadow-xl
          w-[90vw] max-w-5xl h-[85vh]
          flex flex-col overflow-hidden
          animate-popover-in
        "
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border-light">
          <h2 className="text-base font-semibold text-text-primary">문서 파이프라인</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-secondary text-text-secondary"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </header>
        {/* FeynmanPipelineTab이 내부에서 flex-col h-full 로 본문 영역을 채운다 */}
        <div className="flex-1 min-h-0">
          <FeynmanPipelineTab />
        </div>
      </div>
    </div>
  );
}
