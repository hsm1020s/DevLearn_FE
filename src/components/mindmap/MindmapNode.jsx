/**
 * @fileoverview 마인드맵 개별 노드 컴포넌트.
 * - 더블클릭으로 라벨 인라인 편집
 * - hover 시 우상단 오버레이(연필 + X)
 * - description이 있으면 짧은 호버 지연 후 툴팁을 body에 portal로 띄움 (ReactFlow pane overflow 회피)
 * - 연필 클릭 시 화면 중앙 portal 모달에 textarea 편집 팝오버
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from 'reactflow';
import { X, Pencil } from 'lucide-react';
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

/** 툴팁을 보여주기 전 호버 유지 시간(ms) — 사실상 즉시 노출 */
const TOOLTIP_HOVER_DELAY = 10;
/** 설명 최대 길이 */
const DESCRIPTION_MAX = 500;

/** 마인드맵 커스텀 노드 (ReactFlow nodeTypes에 등록) */
export default function MindmapNode({ id, data, selected }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const labelInputRef = useRef(null);
  const updateNode = useMindmapStore((s) => s.updateNode);
  const toggleCollapsed = useMindmapStore((s) => s.toggleCollapsed);
  const deleteNode = useMindmapStore((s) => s.deleteNode);

  // 설명 편집 상태
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(data.description || '');
  const descTextareaRef = useRef(null);

  // hover → 지연 후 툴팁 노출 (마우스 벗어나면 즉시 숨김)
  // rect는 포털로 띄울 툴팁의 앵커 좌표 (호버 시작 시점의 노드 위치, viewport 기준)
  const nodeRootRef = useRef(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipRect, setTooltipRect] = useState(null);
  const tooltipTimerRef = useRef(null);

  // 편집 모드 진입 시 입력 필드에 포커스
  useEffect(() => {
    if (editing) labelInputRef.current?.focus();
  }, [editing]);

  // 설명 편집 진입 시 textarea 포커스 + 커서 맨 뒤
  useEffect(() => {
    if (editingDesc) {
      const ta = descTextareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    }
  }, [editingDesc]);

  // 외부에서 라벨이 변경되면 로컬 상태 동기화
  useEffect(() => {
    setLabel(data.label);
  }, [data.label]);

  // 외부(스토어) description 변경 시 로컬 draft 동기화 — 편집 중이 아닐 때만
  useEffect(() => {
    if (!editingDesc) setDescDraft(data.description || '');
  }, [data.description, editingDesc]);

  // 편집 확정: 변경된 라벨을 스토어에 반영하거나 원복
  const commitLabel = useCallback(() => {
    const trimmed = label.trim();
    if (trimmed && trimmed !== data.label) {
      updateNode(id, { label: trimmed });
    } else {
      setLabel(data.label);
    }
    setEditing(false);
  }, [label, data.label, id, updateNode]);

  /** 설명 저장 */
  const commitDesc = useCallback(() => {
    const next = descDraft.slice(0, DESCRIPTION_MAX);
    if (next !== (data.description || '')) {
      updateNode(id, { description: next });
    }
    setEditingDesc(false);
  }, [descDraft, data.description, id, updateNode]);

  /** 설명 편집 취소 (원복) */
  const cancelDesc = useCallback(() => {
    setDescDraft(data.description || '');
    setEditingDesc(false);
  }, [data.description]);

  // hover 진입 — 지연 후 툴팁 활성화 + 현재 노드의 viewport 좌표 캡쳐
  const handleMouseEnter = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => {
      if (nodeRootRef.current) {
        const r = nodeRootRef.current.getBoundingClientRect();
        setTooltipRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
      setTooltipOpen(true);
    }, TOOLTIP_HOVER_DELAY);
  }, []);

  // hover 이탈 — 즉시 숨김 + 타이머 정리
  const handleMouseLeave = useCallback(() => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setTooltipOpen(false);
  }, []);

  // 언마운트 시 타이머 정리
  useEffect(() => () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
  }, []);

  const borderColor = NODE_COLORS[data.color] || NODE_COLORS[null];
  const hasDescription = !!(data.description && data.description.trim());
  // 편집 중(라벨/설명)엔 툴팁 숨김 — 중복 UI 방지
  const showTooltip = tooltipOpen && hasDescription && !editing && !editingDesc;

  // TTS 재생 중인 노드는 앰버 톤으로 강조 — selected 스타일보다 우선해서 보이도록
  // 인라인 style로 덮어써 className의 border/bg를 모두 치환한다.
  const playingStyle = data.isPlaying ? {
    borderColor: 'var(--color-highlight-tts-border)',
    borderWidth: '2px',
    borderStyle: 'solid',
    backgroundColor: 'var(--color-highlight-tts-bg)',
    boxShadow: '0 0 0 3px var(--color-highlight-tts-border)',
  } : undefined;

  return (
    <div
      ref={nodeRootRef}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={playingStyle}
      className={`
        group relative px-3 py-2 rounded-lg bg-bg-primary
        text-sm font-medium text-text-primary transition-all
        ${selected ? `border-2 ${borderColor} bg-primary/5 shadow-md` : `border ${borderColor} shadow-sm`}
      `}
    >
      {/* hover 오버레이 — 연필(설명 편집) + X(삭제). 편집 중엔 숨김 */}
      {!editing && !editingDesc && (
        <div
          className="absolute -top-2 -right-2 flex items-center gap-1 z-10
                     opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditingDesc(true); }}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="w-5 h-5 rounded-full bg-bg-primary border border-border-light
                       text-text-secondary hover:text-primary hover:border-primary
                       flex items-center justify-center shadow-sm"
            title={hasDescription ? '설명 편집' : '설명 추가'}
            aria-label={hasDescription ? '설명 편집' : '설명 추가'}
          >
            <Pencil size={11} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="w-5 h-5 rounded-full bg-bg-primary border border-border-light
                       text-text-secondary hover:text-danger hover:border-danger
                       flex items-center justify-center shadow-sm"
            title="노드 삭제"
            aria-label="노드 삭제"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* 설명 툴팁 — ReactFlow pane의 overflow:hidden 에 잘리지 않도록 body에 portal 렌더링.
          rect는 hover 시작 시점 viewport 좌표 (팬·줌 중엔 이탈로 자연스럽게 닫힘). */}
      {showTooltip && tooltipRect && createPortal(
        <div
          role="tooltip"
          className="fixed z-[90] pointer-events-none
                     px-3 py-2 rounded-lg bg-bg-primary border border-border-light
                     shadow-lg text-xs text-text-primary whitespace-pre-wrap break-words"
          style={{
            // 노드 중앙에 앵커
            left: tooltipRect.left + tooltipRect.width / 2,
            // 위쪽 공간이 너무 좁으면(뷰포트 상단 근접) 아래쪽으로 flip
            top: tooltipRect.top > 120
              ? tooltipRect.top - 10
              : tooltipRect.top + tooltipRect.height + 10,
            transform: tooltipRect.top > 120
              ? 'translate(-50%, -100%)'
              : 'translate(-50%, 0)',
            maxWidth: 'min(240px, 90vw)',
          }}
        >
          {data.description}
        </div>,
        document.body,
      )}

      {/* 설명 편집 모달 — ReactFlow pane 경계(overflow)로 잘리지 않도록 body에 portal 렌더링 */}
      {editingDesc && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onMouseDown={(e) => {
            // 바깥 클릭 시 취소 (내부 카드는 stopPropagation)
            if (e.target === e.currentTarget) cancelDesc();
          }}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-[360px] p-4 rounded-lg bg-bg-primary border border-border-light shadow-xl space-y-3"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">
                설명 편집 — <span className="text-text-secondary">{data.label}</span>
              </span>
              <button
                type="button"
                onClick={cancelDesc}
                className="text-text-tertiary hover:text-text-primary"
                aria-label="닫기"
              >
                <X size={16} />
              </button>
            </div>
            <textarea
              ref={descTextareaRef}
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value.slice(0, DESCRIPTION_MAX))}
              onKeyDown={(e) => {
                // IME 조합 중엔 확정 무시
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Escape') { e.preventDefault(); cancelDesc(); }
                // Cmd/Ctrl+Enter = 저장 (단순 Enter는 줄바꿈)
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commitDesc(); }
              }}
              rows={6}
              maxLength={DESCRIPTION_MAX}
              placeholder="이 노드에 대한 설명을 입력하세요"
              className="w-full px-2 py-1.5 text-sm border border-border-light rounded
                         bg-bg-primary text-text-primary placeholder:text-text-secondary
                         focus:outline-none focus:border-primary resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-tertiary">
                {descDraft.length}/{DESCRIPTION_MAX} · ⌘/Ctrl+Enter 저장 · Esc 취소
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelDesc}
                  className="px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={commitDesc}
                  className="px-3 py-1 text-xs text-white bg-primary rounded hover:bg-primary/80"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div className="flex items-center gap-1">
        {editing ? (
          <input
            ref={labelInputRef}
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 200))}
            onBlur={commitLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') { setLabel(data.label); setEditing(false); } }}
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
