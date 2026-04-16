/**
 * @fileoverview dagre 라이브러리를 활용한 마인드맵 노드 자동 레이아웃 계산 유틸리티
 */

import dagre from 'dagre';

// 노드 기본 크기 (px)
const NODE_WIDTH = 150;
const NODE_HEIGHT = 40;

/**
 * dagre를 사용하여 노드 위치를 자동 계산한다.
 * @param {Array} nodes - store의 노드 배열
 * @returns {Map<string, {x: number, y: number}>} nodeId → position
 */
export function computeLayout(nodes) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 180, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((n) => {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  nodes.forEach((n) => {
    if (n.parentId) {
      g.setEdge(n.parentId, n.id);
    }
  });

  dagre.layout(g);

  const positions = new Map();
  nodes.forEach((n) => {
    const node = g.node(n.id);
    positions.set(n.id, { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 });
  });

  return positions;
}
