import { useCallback, useMemo, useEffect, useState } from 'react';
import ReactFlow, { Background, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';

import useMindmapStore from '../../stores/useMindmapStore';
import MindmapNode from './MindmapNode';
import MindmapControls from './MindmapControls';
import NodeContextMenu from './NodeContextMenu';

const nodeTypes = { mindmapNode: MindmapNode };

const defaultEdgeStyle = { stroke: '#378ADD', strokeWidth: 2 };

export default function MindmapCanvas() {
  const nodes = useMindmapStore((s) => s.nodes);
  const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
  const selectNode = useMindmapStore((s) => s.selectNode);
  const updateNode = useMindmapStore((s) => s.updateNode);

  const [contextMenu, setContextMenu] = useState(null);

  const rfNodes = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        position: n.position,
        data: { label: n.label, color: n.color },
        type: 'mindmapNode',
        selected: n.id === selectedNodeId,
      })),
    [nodes, selectedNodeId],
  );

  const rfEdges = useMemo(
    () =>
      nodes
        .filter((n) => n.parentId)
        .map((n) => ({
          id: `e-${n.parentId}-${n.id}`,
          source: n.parentId,
          target: n.id,
          type: 'smoothstep',
          style: defaultEdgeStyle,
        })),
    [nodes],
  );

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(rfNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(rfEdges);

  useEffect(() => { setFlowNodes(rfNodes); }, [rfNodes, setFlowNodes]);
  useEffect(() => { setFlowEdges(rfEdges); }, [rfEdges, setFlowEdges]);

  const onNodeClick = useCallback(
    (_event, node) => { selectNode(node.id); },
    [selectNode],
  );

  const onNodeDragStop = useCallback(
    (_event, node) => { updateNode(node.id, { position: node.position }); },
    [updateNode],
  );

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    selectNode(node.id);
    setContextMenu({ nodeId: node.id, position: { x: event.clientX, y: event.clientY } });
  }, [selectNode]);

  const onPaneClick = useCallback(() => { setContextMenu(null); }, []);

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#E5E5E5" gap={20} />
        <MindmapControls />
      </ReactFlow>

      {contextMenu && (
        <NodeContextMenu
          nodeId={contextMenu.nodeId}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
