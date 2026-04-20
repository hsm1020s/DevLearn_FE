/**
 * @fileoverview 마인드맵 API Mock - 모듈 스코프 Map으로 저장/목록/삭제 간 일관성 유지
 */
import { generateId } from '../../utils/helpers';

const MOCK_DELAY = 300;

/**
 * 모듈 스코프 저장소 — 세션 동안 마인드맵 상태를 유지한다.
 * key: mapId, value: { id, title, mode, nodes, updatedAt }
 */
const mockMaps = new Map();

// 초기 fixture (기존 동작 유지: 빈 상태에서 목록에 2건이 보이던 UX 대체)
(function seedFixtures() {
  if (mockMaps.size > 0) return;
  const now = Date.now();
  mockMaps.set('mm-1', {
    id: 'mm-1',
    title: 'ACID 개념',
    mode: 'general',
    nodes: [{ id: 'n1', label: 'ACID', parentId: null, position: { x: 0, y: 0 } }],
    updatedAt: new Date('2026-04-15T10:00:00Z').getTime(),
  });
  mockMaps.set('mm-2', {
    id: 'mm-2',
    title: 'React 기초',
    mode: 'general',
    nodes: [{ id: 'r1', label: 'React', parentId: null, position: { x: 0, y: 0 } }],
    updatedAt: new Date('2026-04-14T15:30:00Z').getTime(),
  });
  // now 미사용 경고 방지
  void now;
})();

/**
 * 마인드맵 저장을 시뮬레이션한다.
 * - id가 있으면 기존 엔트리를 덮어쓰고, 없으면 새로 발급한다.
 */
export async function saveMindmap({ id, title, mode, nodes }) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const mapId = id || generateId();
  const record = {
    id: mapId,
    title,
    mode,
    nodes: nodes || [],
    updatedAt: Date.now(),
  };
  mockMaps.set(mapId, record);
  return {
    id: mapId,
    title,
    mode,
    nodeCount: record.nodes.length,
    savedAt: new Date(record.updatedAt).toISOString(),
  };
}

/** 모든 마인드맵의 요약 정보를 반환한다 (mode 포함) */
export async function getMindmapList() {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  return Array.from(mockMaps.values()).map((m) => ({
    id: m.id,
    title: m.title,
    mode: m.mode,
    nodeCount: m.nodes.length,
    updatedAt: new Date(m.updatedAt).toISOString(),
  }));
}

/** ID로 특정 마인드맵 상세를 반환한다 */
export async function getMindmap(id) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const m = mockMaps.get(id);
  if (!m) {
    // 저장소에 없으면 최소 골격 반환 (호출부에서 덮어쓸 수 있도록)
    return { id, title: '마인드맵', mode: 'general', nodes: [] };
  }
  return { id: m.id, title: m.title, mode: m.mode, nodes: m.nodes };
}

/** 마인드맵을 삭제한다 */
export async function deleteMindmap(id) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  mockMaps.delete(id);
  return { id };
}
