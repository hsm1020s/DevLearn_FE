/**
 * @fileoverview 마인드맵 캔버스 — ReactFlow 기반 노드/엣지 렌더링 및 상호작용 처리.
 * 스토어의 노드 데이터를 자동 레이아웃으로 변환하여 표시한다.
 */
import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import ReactFlow, { Background, useNodesState, useEdgesState, useReactFlow, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';

import useMindmapStore from '../../stores/useMindmapStore';
import { computeLayout } from '../../utils/layoutGraph';
import MindmapNode from './MindmapNode';
import MindmapControls from './MindmapControls';
import NodeContextMenu from './NodeContextMenu';

/** ReactFlow에 등록할 커스텀 노드 타입 */
const nodeTypes = { mindmapNode: MindmapNode };

const defaultEdgeStyle = { stroke: 'var(--color-primary)', strokeWidth: 2 };

/** 마인드맵 캔버스 내부 (ReactFlowProvider 내부에서 useReactFlow 사용) */
function MindmapCanvasInner() {
  // 현재 활성 맵의 노드 목록 구독
  const nodes = useMindmapStore((s) => {
    const { activeMapId, maps } = s;
    return activeMapId && maps[activeMapId] ? maps[activeMapId].nodes : [];
  });
  const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
  const selectNode = useMindmapStore((s) => s.selectNode);
  const updateNode = useMindmapStore((s) => s.updateNode);

  const { fitView } = useReactFlow();
  const [contextMenu, setContextMenu] = useState(null);

  // 부모 id → 직계 자식 id 배열 매핑 (자식 수 표시 + 후손 탐색용)
  const childrenMap = useMemo(() => {
    const m = new Map();
    nodes.forEach((n) => {
      if (!n.parentId) return;
      const arr = m.get(n.parentId);
      if (arr) arr.push(n.id);
      else m.set(n.parentId, [n.id]);
    });
    return m;
  }, [nodes]);

  // 접힌 노드의 모든 후손 id — 렌더링에서 제외할 노드 집합
  const hiddenSet = useMemo(() => {
    const hidden = new Set();
    const walk = (id) => {
      const children = childrenMap.get(id);
      if (!children) return;
      children.forEach((cid) => {
        hidden.add(cid);
        walk(cid);
      });
    };
    nodes.forEach((n) => { if (n.collapsed) walk(n.id); });
    return hidden;
  }, [nodes, childrenMap]);

  // 실제로 그려질 노드만 추려서 레이아웃 계산 — 접힌 영역만큼 자연스럽게 재배치됨
  const visibleNodes = useMemo(
    () => nodes.filter((n) => !hiddenSet.has(n.id)),
    [nodes, hiddenSet],
  );

  const positions = useMemo(() => computeLayout(visibleNodes), [visibleNodes]);

  // 스토어 노드를 ReactFlow 노드 형식으로 변환 (접힘 토글 버튼에 필요한 메타 포함)
  const rfNodes = useMemo(
    () =>
      visibleNodes.map((n) => {
        const childIds = childrenMap.get(n.id);
        return {
          id: n.id,
          position: positions.get(n.id) || n.position,
          data: {
            label: n.label,
            color: n.color,
            childCount: childIds ? childIds.length : 0,
            isCollapsed: !!n.collapsed,
          },
          type: 'mindmapNode',
          selected: n.id === selectedNodeId,
        };
      }),
    [visibleNodes, childrenMap, selectedNodeId, positions],
  );

  // 양 끝이 모두 visible인 엣지만 생성
  const rfEdges = useMemo(
    () =>
      nodes
        .filter((n) => n.parentId && !hiddenSet.has(n.id) && !hiddenSet.has(n.parentId))
        .map((n) => ({
          id: `e-${n.parentId}-${n.id}`,
          source: n.parentId,
          target: n.id,
          type: 'smoothstep',
          style: defaultEdgeStyle,
        })),
    [nodes, hiddenSet],
  );

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(rfNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(rfEdges);

  // 스토어 변경 시 ReactFlow 내부 상태와 동기화
  useEffect(() => { setFlowNodes(rfNodes); }, [rfNodes, setFlowNodes]);
  useEffect(() => { setFlowEdges(rfEdges); }, [rfEdges, setFlowEdges]);

  // 화면에 보이는 노드 수가 바뀔 때(추가/삭제/접기/펼치기) 전체 뷰에 맞게 자동 줌 조절.
  // 단일 setTimeout 디바운스로 단순화: 이전 구현(pendingFit ref + useNodesInitialized)은
  // React StrictMode 가 effect 를 두 번 실행하며 cleanup 으로 RAF 를 취소하는 경로에서 fit 이
  // 아예 실행되지 않거나 stale bbox 로 실행되는 문제가 있었다.
  // - `lastCountRef` 업데이트를 **setTimeout 콜백 안**에서만 수행하는 것이 핵심.
  //   StrictMode 첫 실행 → cleanup → 재실행 사이에 ref 가 아직 옛 값이라 조건이 다시 맞고
  //   재스케줄된다. 디바운스 180ms 가 측정/레이아웃 안정화 시간을 확보한다.
  // - `padding: 0.3` 여유, `maxZoom: 1.2` 로 소수 노드 집합 과확대 방지.
  const lastCountRef = useRef(flowNodes.length);
  useEffect(() => {
    if (flowNodes.length === lastCountRef.current) return;
    const target = flowNodes.length;
    const id = setTimeout(() => {
      fitView({ padding: 0.3, duration: 400, maxZoom: 1.2 });
      lastCountRef.current = target;
    }, 180);
    return () => clearTimeout(id);
  }, [flowNodes.length, fitView]);

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

/** 마인드맵 캔버스 (ReactFlowProvider로 감싸서 useReactFlow 사용 가능하게) */
export default function MindmapCanvas() {
  return (
    <ReactFlowProvider>
      <MindmapCanvasInner />
    </ReactFlowProvider>
  );
}
