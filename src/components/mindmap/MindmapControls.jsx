import { useReactFlow } from 'reactflow';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const btnClass =
  'p-1.5 text-text-secondary hover:text-primary hover:bg-bg-secondary transition-colors';

export default function MindmapControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const actions = [
    { icon: ZoomIn, label: '줌인', handler: () => zoomIn() },
    { icon: ZoomOut, label: '줌아웃', handler: () => zoomOut() },
    { icon: Maximize2, label: '전체보기', handler: () => fitView({ padding: 0.2 }) },
  ];

  return (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col bg-white border border-border-light rounded-lg shadow-sm overflow-hidden">
      {actions.map(({ icon: Icon, label, handler }) => (
        <button
          key={label}
          className={btnClass}
          onClick={handler}
          title={label}
          aria-label={label}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
