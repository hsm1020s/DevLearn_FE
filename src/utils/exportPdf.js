import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

/**
 * ReactFlow 뷰포트를 캡처하여 PDF로 다운로드한다.
 * @param {HTMLElement} wrapperEl - ReactFlow 래퍼 요소 (.react-flow)
 */
export async function exportMindmapToPdf(wrapperEl) {
  const viewport = wrapperEl.querySelector('.react-flow__viewport');
  if (!viewport) throw new Error('ReactFlow 뷰포트를 찾을 수 없습니다.');

  const dataUrl = await toPng(viewport, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  });

  const img = new Image();
  img.src = dataUrl;
  await new Promise((resolve) => { img.onload = resolve; });

  const imgW = img.width;
  const imgH = img.height;
  const orientation = imgW >= imgH ? 'landscape' : 'portrait';

  const pdf = new jsPDF({ orientation, unit: 'px', format: [imgW, imgH] });
  pdf.addImage(dataUrl, 'PNG', 0, 0, imgW, imgH);
  pdf.save('mindmap.pdf');
}
