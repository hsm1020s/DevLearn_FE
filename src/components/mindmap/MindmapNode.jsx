/**
 * @fileoverview 마인드맵 개별 노드 컴포넌트.
 * 더블클릭으로 인라인 편집, 색상별 테두리 스타일을 지원한다.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { X } from 'lucide-react';
import useMindmapStore from '../../stores/useMindmapStore';

const handleStyle = {
  width: 8,
  height: 8,
  background: 'var(--color-primary)',
  border: '2px solid white',
};

/** 노드 색상값에 대응하는 Tailwind 테두리 클래스 */
const NODE_COLORS = {
  null: 'border-primary',
  blue: 'border-blue-500',
  green: 'border-green-500',
  red: 'border-red-500',
  yellow: 'border-yellow-500',
  purple: 'border-purple-500',
};

/** 마인드맵 커스텀 노드 (ReactFlow nodeTypes에 등록) */
export default function MindmapNode({ id, data, selected }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const inputRef = useRef(null);
  const updateNode = useMindmapStore((s) => s.updateNode);
  const toggleCollapsed = useMindmapStore((s) => s.toggleCollapsed);
  const deleteNode = useMindmapStore((s) => s.deleteNode);

  // 편집 모드 진입 시 입력 필드에 포커스
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // 외부에서 라벨이 변경되면 로컬 상태 동기화
  useEffect(() => {
    setLabel(data.label);
  }, [data.label]);

  // 편집 확정: 변경된 라벨을 스토어에 반영하거나 원복
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
        group relative px-3 py-2 rounded-lg bg-bg-primary
        text-sm font-medium text-text-primary transition-all
        ${selected ? `border-2 ${borderColor} bg-primary/5 shadow-md` : `border ${borderColor} shadow-sm`}
      `}
    >
      {/* hover 시 우상단에 나타나는 삭제 버튼 — ReactFlow 드래그/편집 핸들러와 분리되도록 stopPropagation */}
      {!editing && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-bg-primary border border-border-light
                     text-text-secondary hover:text-danger hover:border-danger
                     opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity
                     flex items-center justify-center shadow-sm z-10"
          title="노드 삭제"
          aria-label="노드 삭제"
        >
          <X size={12} />
        </button>
      )}
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div className="flex items-center gap-1">
        {editing ? (
          <input
            ref={inputRef}
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 200))}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setLabel(data.label); setEditing(false); } }}
            className="bg-transparent outline-none text-sm w-full min-w-[60px]"
          />
        ) : (
          <span>{data.label}</span>
        )}
        {!editing && data.childCount > 0 && (
          // ReactFlow의 드래그/선택을 막기 위해 mousedown까지 stopPropagation 필요
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleCollapsed(id); }}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="ml-0.5 px-1 py-0 text-[10px] leading-none rounded text-text-secondary hover:text-primary hover:bg-bg-secondary"
            title={data.isCollapsed ? '하위 노드 펼치기' : '하위 노드 접기'}
            aria-label={data.isCollapsed ? '하위 노드 펼치기' : '하위 노드 접기'}
          >
            {data.isCollapsed ? `▸ ${data.childCount}` : '▾'}
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
}
