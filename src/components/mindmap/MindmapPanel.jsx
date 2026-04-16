/**
 * @fileoverview 마인드맵 패널 — 모드별 마인드맵 목록 관리, 생성/선택/삭제, 노드 추가, 캔버스 표시.
 * 현재 모드에 해당하는 마인드맵만 필터링하여 보여준다.
 */
import { useState, useCallback } from 'react';
import { Plus, Trash2, ChevronDown, X, Edit3 } from 'lucide-react';

import useAppStore from '../../stores/useAppStore';
import useMindmapStore from '../../stores/useMindmapStore';
import { showSuccess } from '../../utils/errorHandler';
import Button from '../common/Button';
import MindmapCanvas from './MindmapCanvas';

/** 마인드맵 패널 메인 컴포넌트 */
export default function MindmapPanel() {
  const mainMode = useAppStore((s) => s.mainMode);

  const activeMapId = useMindmapStore((s) => s.activeMapId);
  const maps = useMindmapStore((s) => s.maps);
  const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
  const createMap = useMindmapStore((s) => s.createMap);
  const deleteMap = useMindmapStore((s) => s.deleteMap);
  const loadMap = useMindmapStore((s) => s.loadMap);
  const renameMap = useMindmapStore((s) => s.renameMap);
  const addNode = useMindmapStore((s) => s.addNode);
  const clearAll = useMindmapStore((s) => s.clearAll);
  const getMapsByMode = useMindmapStore((s) => s.getMapsByMode);

  const activeMap = activeMapId ? maps[activeMapId] : null;
  const nodes = activeMap ? activeMap.nodes : [];
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // 현재 모드의 마인드맵 목록
  const modeMapList = getMapsByMode(mainMode);

  const [nodeInput, setNodeInput] = useState('');
  const [showList, setShowList] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  /** 새 마인드맵 생성 */
  const handleCreate = useCallback(() => {
    createMap(mainMode);
    setShowList(false);
    showSuccess('새 마인드맵이 생성되었습니다');
  }, [mainMode, createMap]);

  /** 마인드맵 선택 */
  const handleSelect = useCallback((mapId) => {
    loadMap(mapId);
    setShowList(false);
  }, [loadMap]);

  /** 마인드맵 삭제 (확인 후) */
  const handleDelete = useCallback((mapId) => {
    deleteMap(mapId);
    setShowDeleteConfirm(null);
    showSuccess('마인드맵이 삭제되었습니다');
  }, [deleteMap]);

  /** 현재 맵의 모든 노드 삭제 (확인 후) */
  const handleClearNodes = useCallback(() => {
    clearAll();
    setShowClearConfirm(false);
  }, [clearAll]);

  /** 노드 추가 */
  const handleAddNode = useCallback(() => {
    const label = nodeInput.trim();
    if (!label) return;
    // 활성 맵이 없으면 자동 생성
    if (!activeMapId) {
      createMap(mainMode);
    }
    addNode(selectedNodeId, label);
    setNodeInput('');
  }, [nodeInput, selectedNodeId, addNode, activeMapId, createMap, mainMode]);

  /** IME 조합 중이 아닐 때만 Enter로 노드 추가 */
  const handleKeyDown = useCallback(
    (e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddNode(); },
    [handleAddNode],
  );

  /** 제목 인라인 편집 시작 */
  const startRename = useCallback(() => {
    if (!activeMap) return;
    setTitleInput(activeMap.title);
    setEditingTitle(true);
  }, [activeMap]);

  /** 제목 편집 완료 */
  const commitRename = useCallback(() => {
    const trimmed = titleInput.trim();
    if (trimmed && activeMapId) {
      renameMap(activeMapId, trimmed);
    }
    setEditingTitle(false);
  }, [titleInput, activeMapId, renameMap]);

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* 상단: 마인드맵 선택/생성 헤더 */}
      <div className="px-4 py-3 border-b border-border-light">
        <div className="flex items-center gap-2 mb-2">
          <span role="img" aria-label="brain" className="text-base">🧠</span>

          {/* 현재 맵 제목 또는 선택 안내 */}
          {editingTitle ? (
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitRename();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              autoFocus
              className="flex-1 px-2 py-0.5 text-sm font-semibold border border-primary rounded
                         bg-bg-primary text-text-primary focus:outline-none"
            />
          ) : (
            <button
              onClick={activeMap ? startRename : undefined}
              className="flex-1 text-left text-sm font-semibold text-text-primary truncate
                         hover:text-primary transition-colors"
              title={activeMap ? '클릭하여 이름 변경' : undefined}
            >
              {activeMap ? activeMap.title : '마인드맵을 선택하세요'}
            </button>
          )}

          {activeMap && !editingTitle && (
            <button onClick={startRename} className="text-text-tertiary hover:text-primary transition-colors" title="이름 변경">
              <Edit3 size={14} />
            </button>
          )}

          {/* 목록 토글 */}
          <button
            onClick={() => setShowList((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary
                       hover:text-primary hover:bg-bg-secondary rounded-lg transition-colors"
          >
            목록
            <ChevronDown size={14} className={`transition-transform ${showList ? 'rotate-180' : ''}`} />
          </button>

          {/* 새 마인드맵 */}
          <Button variant="primary" size="sm" onClick={handleCreate} title="새 마인드맵">
            <Plus size={16} />
          </Button>
        </div>

        {/* 마인드맵 목록 드롭다운 */}
        {showList && (
          <div className="mb-2 border border-border-light rounded-lg bg-bg-secondary max-h-40 overflow-y-auto">
            {modeMapList.length === 0 ? (
              <p className="text-xs text-text-tertiary text-center py-3">
                이 모드에 저장된 마인드맵이 없습니다
              </p>
            ) : (
              modeMapList.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer
                    hover:bg-bg-tertiary transition-colors
                    ${m.id === activeMapId ? 'bg-primary/10 text-primary' : 'text-text-primary'}`}
                >
                  <button
                    onClick={() => handleSelect(m.id)}
                    className="flex-1 text-left truncate"
                  >
                    {m.title}
                    <span className="ml-2 text-xs text-text-tertiary">{m.nodes.length}개 노드</span>
                  </button>

                  {/* 삭제 버튼 */}
                  {showDeleteConfirm === m.id ? (
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="px-2 py-0.5 text-xs text-white bg-danger rounded hover:bg-danger/80"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="text-text-tertiary hover:text-text-primary"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(m.id)}
                      className="text-text-tertiary hover:text-danger shrink-0 ml-2 opacity-0 group-hover:opacity-100
                                 transition-opacity"
                      style={{ opacity: 1 }}
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 노드 수 + 전체 삭제 */}
        {activeMap && (
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span>{nodes.length}개 노드</span>
            {nodes.length > 0 && (
              showClearConfirm ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleClearNodes}
                    className="px-2 py-0.5 text-xs text-white bg-danger rounded hover:bg-danger/80"
                  >
                    확인
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="text-text-tertiary hover:text-text-primary"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="text-danger hover:text-danger/80 transition-colors"
                >
                  전체 노드 삭제
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* 노드 추가 입력 (활성 맵이 있거나, 입력하면 자동 생성) */}
      <div className="px-4 py-3 border-b border-border-light space-y-2">
        <p className="text-xs text-text-secondary">
          선택: <span className="font-medium text-text-primary">
            {selectedNode ? selectedNode.label : '노드를 선택하세요'}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={nodeInput}
            onChange={(e) => setNodeInput(e.target.value.slice(0, 200))}
            onKeyDown={handleKeyDown}
            maxLength={200}
            placeholder={selectedNode ? '하위 노드 이름' : '루트 노드 이름'}
            className="flex-1 px-3 py-1.5 text-sm border border-border-light rounded-lg
                       bg-bg-primary text-text-primary placeholder:text-text-secondary
                       focus:outline-none focus:border-primary transition-colors"
          />
          <Button variant="primary" size="sm" onClick={handleAddNode} disabled={!nodeInput.trim()} title="노드 추가">
            <Plus size={16} />
          </Button>
        </div>
      </div>

      {/* 캔버스 */}
      <div className="flex-1 min-h-0">
        {activeMap ? (
          <MindmapCanvas />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
            마인드맵을 선택하거나 새로 만드세요
          </div>
        )}
      </div>
    </div>
  );
}
