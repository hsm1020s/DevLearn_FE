import { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import useMindmapStore from '../../stores/useMindmapStore';

const handleStyle = {
  width: 8,
  height: 8,
  background: 'var(--color-primary)',
  border: '2px solid white',
};

const NODE_COLORS = {
  null: 'border-primary',
  blue: 'border-blue-500',
  green: 'border-green-500',
  red: 'border-red-500',
  yellow: 'border-yellow-500',
  purple: 'border-purple-500',
};

export default function MindmapNode({ id, data, selected }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const inputRef = useRef(null);
  const updateNode = useMindmapStore((s) => s.updateNode);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setLabel(data.label);
  }, [data.label]);

  const commit = useCallback(() => {
    const trimmed = label.trim();
    if (trimmed && trimmed !== data.label) {
      updateNode(id, { label: trimmed });
    } else {
      setLabel(data.label);
    }
    setEditing(false);
  }, [label, data.label, id, updateNode]);

  const borderColor = NODE_COLORS[data.color] || NODE_COLORS[null];

  return (
    <div
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={`
        px-3 py-2 rounded-lg bg-white
        text-sm font-medium text-text-primary transition-all
        ${selected ? `border-2 ${borderColor} bg-primary/5 shadow-md` : `border ${borderColor} shadow-sm`}
      `}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      {editing ? (
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setLabel(data.label); setEditing(false); } }}
          className="bg-transparent outline-none text-sm w-full min-w-[60px]"
        />
      ) : (
        <span>{data.label}</span>
      )}
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
}
