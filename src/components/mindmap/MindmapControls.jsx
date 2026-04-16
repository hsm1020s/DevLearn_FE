/**
 * @fileoverview 마인드맵 캔버스 하단 우측 컨트롤 바
 * 줌인/줌아웃 | 전체보기 | PDF 다운로드를 가로 한 줄로 배치한다.
 */
import { useState, useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { ZoomIn, ZoomOut, Maximize2, Download, Loader2 } from 'lucide-react';
import { exportMindmapToPdf } from '../../utils/exportPdf';
import { useToastStore } from '../common/Toast';
import useMindmapStore from '../../stores/useMindmapStore';

/** 마인드맵 줌/전체보기/PDF 컨트롤 바 */
export default function MindmapControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [exporting, setExporting] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  // 현재 활성 맵의 노드 목록 구독
  const nodes = useMindmapStore((s) => {
    const { activeMapId, maps } = s;
    return activeMapId && maps[activeMapId] ? maps[activeMapId].nodes : [];
  });
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

  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-0.5
                    bg-bg-primary border border-border-light rounded-xl shadow-md px-1 py-1">
      {/* 줌 그룹 */}
      <button
        onClick={() => zoomOut()}
        className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
        title="줌아웃"
      >
        <ZoomOut size={18} />
      </button>
      <button
        onClick={() => zoomIn()}
        className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
        title="줌인"
      >
        <ZoomIn size={18} />
      </button>

      {/* 구분선 */}
      <div className="w-px h-6 bg-border-light mx-1" />

      {/* 전체보기 */}
      <button
        onClick={() => fitView({ padding: 0.2, duration: 300 })}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm
                   text-text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
        title="전체보기"
      >
        <Maximize2 size={18} />
        <span>전체</span>
      </button>

      {/* 구분선 */}
      <div className="w-px h-6 bg-border-light mx-1" />

      {/* PDF 다운로드 */}
      <button
        onClick={exporting ? undefined : handleExportPdf}
        disabled={exporting}
        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm transition-colors
          ${exporting
            ? 'text-text-tertiary cursor-not-allowed'
            : 'text-text-secondary hover:text-primary hover:bg-bg-secondary'
          }`}
        title="PDF 다운로드"
      >
        {exporting
          ? <Loader2 size={18} className="animate-spin" />
          : <Download size={18} />
        }
        <span>PDF</span>
      </button>
    </div>
  );
}
