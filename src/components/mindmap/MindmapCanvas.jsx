/**
 * @fileoverview 마인드맵 캔버스 — ReactFlow 기반 노드/엣지 렌더링 및 상호작용 처리.
 * 스토어의 노드 데이터를 자동 레이아웃으로 변환하여 표시한다.
 */
import { useCallback, useMemo, useEffect, useState } from 'react';
import ReactFlow, { Background, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';

import useMindmapStore from '../../stores/useMindmapStore';
import { computeLayout } from '../../utils/layoutGraph';
import MindmapNode from './MindmapNode';
import MindmapControls from './MindmapControls';
import NodeContextMenu from './NodeContextMenu';

/** ReactFlow에 등록할 커스텀 노드 타입 */
const nodeTypes = { mindmapNode: MindmapNode };

const defaultEdgeStyle = { stroke: 'var(--color-primary)', strokeWidth: 2 };

/** 마인드맵 캔버스 (ReactFlow 래퍼) */
export default function MindmapCanvas() {
  const nodes = useMindmapStore((s) => s.nodes);
  const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
  const selectNode = useMindmapStore((s) => s.selectNode);
  const updateNode = useMindmapStore((s) => s.updateNode);

  const [contextMenu, setContextMenu] = useState(null);

  // 노드 트리 구조로부터 자동 좌표 계산
  const positions = useMemo(() => computeLayout(nodes), [nodes]);

  // 스토어 노드를 ReactFlow 노드 형식으로 변환
  const rfNodes = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        position: positions.get(n.id) || n.position,
        data: { label: n.label, color: n.color },
        type: 'mindmapNode',
        selected: n.id === selectedNodeId,
      })),
    [nodes, selectedNodeId, positions],
  );

  // 부모-자식 관계를 ReactFlow 엣지로 변환
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

  // 스토어 변경 시 ReactFlow 내부 상태와 동기화
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

  // 우클릭 시 컨텍스트 메뉴 위치·대상 노드 설정
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
        <Background color="var(--color-border-light)" gap={20} />
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
