export function generateId() {
  return crypto.randomUUID();
}

export function calculateNodePosition(parentId, nodes) {
  if (!parentId) {
    return { x: 100, y: 300 };
  }

  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return { x: 100, y: 100 };

  const siblings = nodes.filter((n) => n.parentId === parentId);
  const x = parent.position.x + 200;
  const y = parent.position.y + siblings.length * 80;

  return { x, y };
}
