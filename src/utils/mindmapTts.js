/**
 * @fileoverview 마인드맵 노드 → TTS 낭독 스크립트 변환 (순수 함수).
 * - BFS 순회로 루트 → 1뎁스 전체 → 2뎁스(부모별 묶음) 순서 생성
 * - 자식이 있는 부모 앞에는 "X의 하위 내용은 A, B, C" 안내 문장을 삽입
 * - 접힌(collapsed) 노드는 본인까지 읽고 자식은 스킵
 * - 빈 label 노드는 낭독 엔트리를 스킵, 부모 안내 문구에선 "(이름 없음)" 으로 표기
 */

/**
 * 노드 label을 낭독용 문자열로 변환. 빈 문자열은 "(이름 없음)" 로 대체.
 * @param {{label?: string}} node
 * @returns {string}
 */
function labelForAnnouncement(node) {
  const label = node?.label?.trim();
  return label ? label : '(이름 없음)';
}

/**
 * 마인드맵 노드 배열로부터 TTS 낭독 스크립트를 생성한다.
 *
 * 출력 엔트리:
 * - `{ text, nodeId }` 형태
 * - `nodeId != null` → 해당 노드 label을 읽는 중 (하이라이트 대상)
 * - `nodeId == null` → "X의 하위 내용은 ..." 안내 문장 (하이라이트 없음)
 *
 * @param {Array<{id: string, label: string, parentId: string|null, collapsed?: boolean}>} nodes
 * @returns {Array<{text: string, nodeId: string|null}>}
 */
export function buildTtsScript(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  const root = nodes.find((n) => n.parentId == null);
  if (!root) return [];

  // id → node 조회용 맵 (접힘 체크 O(1))
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // 부모가 접혀있지 않은 경우에만 childrenMap에 포함 → 접힌 서브트리 자연 스킵.
  // 입력 순서를 보존해 낭독 순서의 예측 가능성을 확보한다.
  const childrenMap = new Map();
  nodes.forEach((n) => {
    if (n.parentId == null) return;
    const parent = nodeById.get(n.parentId);
    if (!parent || parent.collapsed) return;
    const arr = childrenMap.get(n.parentId);
    if (arr) arr.push(n);
    else childrenMap.set(n.parentId, [n]);
  });

  const script = [];

  // 루트 낭독 (빈 label이면 스킵하되 흐름은 계속)
  if (root.label && root.label.trim()) {
    script.push({ text: labelForAnnouncement(root), nodeId: root.id });
  }

  // BFS: 부모를 꺼낼 때 "부모의 자식 그룹" 안내 문구를 먼저 삽입한 뒤,
  // 자식들 label을 순서대로 낭독하고, 각 자식을 큐 끝에 추가한다.
  // 이렇게 하면 "1뎁스 전체 → 각 1뎁스 노드별 자식(2뎁스) 묶음" 순서가 자연스럽게 나온다.
  const queue = [root];
  while (queue.length > 0) {
    const parent = queue.shift();
    const children = childrenMap.get(parent.id);
    if (!children || children.length === 0) continue;

    script.push({
      text: `${labelForAnnouncement(parent)}의 하위 내용은 ${children.map(labelForAnnouncement).join(', ')}`,
      nodeId: null,
    });

    children.forEach((c) => {
      if (c.label && c.label.trim()) {
        script.push({ text: labelForAnnouncement(c), nodeId: c.id });
      }
      queue.push(c);
    });
  }

  return script;
}
