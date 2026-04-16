import { Trash2, Palette } from 'lucide-react';
import { useEffect, useRef } from 'react';
import useMindmapStore from '../../stores/useMindmapStore';

const COLORS = [
  { value: null, label: '기본', bg: 'bg-primary' },
  { value: 'blue', label: '파랑', bg: 'bg-blue-500' },
  { value: 'green', label: '초록', bg: 'bg-green-500' },
  { value: 'red', label: '빨강', bg: 'bg-red-500' },
  { value: 'yellow', label: '노랑', bg: 'bg-yellow-500' },
  { value: 'purple', label: '보라', bg: 'bg-purple-500' },
];

export default function NodeContextMenu({ nodeId, position, onClose }) {
  const deleteNode = useMindmapStore((s) => s.deleteNode);
  const updateNode = useMindmapStore((s) => s.updateNode);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const handleDelete = () => {
    deleteNode(nodeId);
    onClose();
  };

  const handleColor = (color) => {
    updateNode(nodeId, { color });
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white border border-border-light rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={handleDelete}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-bg-secondary transition-colors"
      >
        <Trash2 size={14} /> 노드 삭제
      </button>
      <div className="border-t border-border-light my-1" />
      <div className="px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-xs text-text-secondary mb-2">
          <Palette size={12} /> 색상 변경
        </span>
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={String(c.value)}
              onClick={() => handleColor(c.value)}
              title={c.label}
              className={`w-5 h-5 rounded-full ${c.bg} hover:ring-2 ring-offset-1 ring-primary/40 transition-all`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
