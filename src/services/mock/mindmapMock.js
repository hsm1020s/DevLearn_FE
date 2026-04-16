/**
 * @fileoverview 마인드맵 API Mock - 마인드맵 저장, 목록/개별 조회 시뮬레이션
 */
import { generateId } from '../../utils/helpers';

const MOCK_DELAY = 300;

/** 마인드맵 저장을 시뮬레이션하고 저장 결과를 반환한다 */
export async function saveMindmap({ title, nodes }) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  return { id: generateId(), title, nodeCount: nodes.length, savedAt: new Date().toISOString() };
}

/** Mock 마인드맵 목록을 반환한다 */
export async function getMindmapList() {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  return [
    { id: 'mm-1', title: 'ACID 개념', nodeCount: 5, updatedAt: '2026-04-15T10:00:00Z' },
    { id: 'mm-2', title: 'React 기초', nodeCount: 8, updatedAt: '2026-04-14T15:30:00Z' },
  ];
}

/** ID로 특정 Mock 마인드맵 데이터를 반환한다 */
export async function getMindmap(id) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  return {
    id,
    title: 'Mock 마인드맵',
    nodes: [
      { id: 'n1', label: '루트 노드', parentId: null, position: { x: 100, y: 300 } },
      { id: 'n2', label: '하위 노드 1', parentId: 'n1', position: { x: 300, y: 200 } },
      { id: 'n3', label: '하위 노드 2', parentId: 'n1', position: { x: 300, y: 400 } },
    ],
  };
}
