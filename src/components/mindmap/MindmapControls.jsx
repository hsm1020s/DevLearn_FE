/**
 * @fileoverview 마인드맵 캔버스 하단 우측 컨트롤 버튼 (줌인/줌아웃/전체보기/PDF 내보내기).
 */
import { useState, useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { ZoomIn, ZoomOut, Maximize2, Download, Loader2 } from 'lucide-react';
import { exportMindmapToPdf } from '../../utils/exportPdf';
import { useToastStore } from '../common/Toast';
import useMindmapStore from '../../stores/useMindmapStore';

const btnClass =
  'p-1.5 text-text-secondary hover:text-primary hover:bg-bg-secondary transition-colors';

/** 마인드맵 줌/PDF 내보내기 컨트롤 */
export default function MindmapControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [exporting, setExporting] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const nodes = useMindmapStore((s) => s.nodes);
  const markSaved = useMindmapStore((s) => s.markSaved);

  // 캔버스를 fitView 후 DOM 캡처하여 PDF로 내보내기
  const handleExportPdf = useCallback(async () => {
    if (nodes.length === 0) {
      addToast('마인드맵이 비어있습니다.', 'error');
      return;
    }
    setExporting(true);
    try {
      await fitView({ padding: 0.2 });
      await new Promise((r) => setTimeout(r, 300));
      const wrapper = document.querySelector('.react-flow');
      if (!wrapper) throw new Error('캔버스를 찾을 수 없습니다.');
      await exportMindmapToPdf(wrapper);
      markSaved();
      addToast('PDF가 다운로드되었습니다.', 'success');
    } catch (err) {
      console.error(err);
      addToast('PDF 생성에 실패했습니다.', 'error');
    } finally {
      setExporting(false);
    }
  }, [nodes, fitView, addToast, markSaved]);

  const actions = [
    { icon: ZoomIn, label: '줌인', handler: () => zoomIn() },
    { icon: ZoomOut, label: '줌아웃', handler: () => zoomOut() },
    { icon: Maximize2, label: '전체보기', handler: () => fitView({ padding: 0.2 }) },
    { icon: exporting ? Loader2 : Download, label: 'PDF 다운로드', handler: handleExportPdf, spin: exporting, disabled: exporting },
  ];

  return (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col bg-white border border-border-light rounded-lg shadow-sm overflow-hidden">
      {actions.map(({ icon: Icon, label, handler, spin, disabled }) => (
        <button
          key={label}
          className={`${btnClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={disabled ? undefined : handler}
          title={label}
          aria-label={label}
          disabled={disabled}
        >
          <Icon size={16} className={spin ? 'animate-spin' : ''} />
        </button>
      ))}
    </div>
  );
}
