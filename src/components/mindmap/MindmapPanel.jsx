/**
 * @fileoverview 마인드맵 패널 — 모드별 마인드맵 목록 관리, 생성/선택/삭제, 노드 추가, 캔버스 표시.
 * 상단 탭: "내 마인드맵" (수동) | "자동 생성" (문서 기반 LLM 생성)
 * 현재 모드에 해당하는 마인드맵만 필터링하여 보여준다.
 */
import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, X, Edit3, Loader2, Check, AlertTriangle, BrainCircuit, PenTool, CheckSquare, Square } from 'lucide-react';

import useAppStore from '../../stores/useAppStore';
import useAuthStore from '../../stores/useAuthStore';
import useMindmapStore from '../../stores/useMindmapStore';
import { showSuccess, showError } from '../../utils/errorHandler';
import { useToastStore } from '../common/Toast';
import Button from '../common/Button';
import MindmapCanvas from './MindmapCanvas';
import AutoMindmapTab from './AutoMindmapTab';

/** 마인드맵 패널 메인 컴포넌트 */
export default function MindmapPanel() {
  const [panelTab, setPanelTab] = useState('manual'); // 'manual' | 'auto'
  const mainMode = useAppStore((s) => s.mainMode);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const activeMapId = useMindmapStore((s) => s.activeMapId);
  const maps = useMindmapStore((s) => s.maps);
  const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
  const createMap = useMindmapStore((s) => s.createMap);
  const deleteMap = useMindmapStore((s) => s.deleteMap);
  const deleteManyMaps = useMindmapStore((s) => s.deleteManyMaps);
  const loadMap = useMindmapStore((s) => s.loadMap);
  const renameMap = useMindmapStore((s) => s.renameMap);
  const addNode = useMindmapStore((s) => s.addNode);
  const deleteNode = useMindmapStore((s) => s.deleteNode);
  const clearAll = useMindmapStore((s) => s.clearAll);
  const getMapsByMode = useMindmapStore((s) => s.getMapsByMode);
  const fetchMapList = useMindmapStore((s) => s.fetchMapList);
  const loadMapFromServer = useMindmapStore((s) => s.loadMapFromServer);
  const saveActiveNow = useMindmapStore((s) => s.saveActiveNow);
  const syncStatus = useMindmapStore((s) => s.syncStatus);
  const lastServerSyncAt = useMindmapStore((s) => s.lastServerSyncAt);
  const addToast = useToastStore((s) => s.addToast);

  const activeMap = activeMapId ? maps[activeMapId] : null;
  const nodes = activeMap ? activeMap.nodes : [];
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  // 맵당 루트는 하나만 — 이미 있으면 루트 추가 UI를 막는다.
  const hasRoot = nodes.some((n) => n.parentId == null);
  const rootBlocked = !selectedNode && hasRoot;

  // 현재 모드의 마인드맵 목록
  const modeMapList = getMapsByMode(mainMode);

  const [nodeInput, setNodeInput] = useState('');
  const [showList, setShowList] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  /** 다중 선택(체크박스) 모드 — 활성 시 단건 호버 휴지통 숨김 + 행 클릭 = 토글 */
  const [selectionMode, setSelectionMode] = useState(false);
  /** 체크된 mapId 들. Set 으로 추가/제거 O(1). */
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  /** 일괄 삭제 확인 팝오버 표시 여부 */
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  /** 인디케이터 상대 시간 표시 갱신용 틱 (lastServerSyncAt 변경과 별개로 30초마다 재렌더) */
  const [, setNowTick] = useState(0);

  // 마운트 시 서버 목록 pull — 로컬 nodes는 보존하고 메타데이터만 병합된다.
  // 비로그인 상태에서 호출하면 401 → 전역 refresh 실패 → 강제 리로드로
  // 모드/패널 상태가 초기화되는 문제를 피하기 위해 로그인 시에만 호출한다.
  useEffect(() => {
    if (isLoggedIn) fetchMapList();
  }, [isLoggedIn, fetchMapList]);

  // 활성 맵이 변경되고 nodes가 비어있는 placeholder 상태이면 상세를 서버에서 당겨온다.
  useEffect(() => {
    if (!isLoggedIn) return;
    const active = activeMapId ? maps[activeMapId] : null;
    if (active && active.nodes.length === 0 && !active.isLocal) {
      loadMapFromServer(active.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMapId, isLoggedIn]);

  // "N초 전" 표시 주기적 갱신 (30초)
  useEffect(() => {
    const handle = setInterval(() => setNowTick((t) => t + 1), 30000);
    return () => clearInterval(handle);
  }, []);

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

  /** 선택 모드 종료 — 체크 비우고 팝오버도 닫는다 */
  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setShowBatchConfirm(false);
  }, []);

  /** 체크박스 토글 */
  const toggleSelected = useCallback((mapId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(mapId)) next.delete(mapId);
      else next.add(mapId);
      return next;
    });
  }, []);

  /** 현재 모드 mindmap 이 모두 체크돼 있는지 (전체선택 토글 라벨/아이콘 분기에 사용) */
  const allSelected = modeMapList.length > 0
    && modeMapList.every((m) => selectedIds.has(m.id));

  /** 전체선택 / 전체해제 토글 — 현재 모드의 살아있는 mindmap 만 대상 */
  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(modeMapList.map((m) => m.id)));
    }
  }, [allSelected, modeMapList]);

  /** 일괄 삭제 실행 — 팝오버 [확인] 클릭 시 호출 */
  const confirmBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setShowBatchConfirm(false);
    try {
      const deletedCount = await deleteManyMaps(ids);
      if (deletedCount > 0) {
        addToast(`${deletedCount}개 마인드맵이 삭제되었습니다`, 'success');
      } else {
        // 서버에 이미 없던 케이스 (중복 삭제 등)
        addToast('삭제할 마인드맵이 없었습니다', 'info');
      }
      exitSelectionMode();
    } catch (err) {
      showError(err, '마인드맵 삭제에 실패했습니다');
    }
  }, [selectedIds, deleteManyMaps, addToast, exitSelectionMode]);

  // 모드 탭 전환 시 선택 모드 자동 종료 (UX 일관성)
  useEffect(() => {
    exitSelectionMode();
  }, [mainMode, exitSelectionMode]);

  /** 현재 맵의 모든 노드 삭제 (확인 후) */
  const handleClearNodes = useCallback(() => {
    clearAll();
    setShowClearConfirm(false);
  }, [clearAll]);

  /** 선택된 노드 삭제 (확인 후) */
  const handleDeleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    deleteNode(selectedNodeId);
    setShowDeleteSelectedConfirm(false);
    showSuccess('노드가 삭제되었습니다');
  }, [selectedNodeId, deleteNode]);

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
      {/* 탭 전환: 내 마인드맵 | 자동 생성 */}
      <div className="flex border-b border-border-light shrink-0">
        <button
          onClick={() => setPanelTab('manual')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium
            transition-colors ${panelTab === 'manual'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-tertiary hover:text-text-secondary'}`}
        >
          <PenTool size={13} />
          내 마인드맵
        </button>
        <button
          onClick={() => setPanelTab('auto')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium
            transition-colors ${panelTab === 'auto'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-tertiary hover:text-text-secondary'}`}
        >
          <BrainCircuit size={13} />
          자동 생성
        </button>
      </div>

      {/* 자동 생성 탭 */}
      {panelTab === 'auto' ? (
        <AutoMindmapTab onOpenMap={() => setPanelTab('manual')} />
      ) : (
      <>
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

          {/* 서버 동기화 상태 인디케이터 */}
          {activeMap && !editingTitle && (
            <SyncIndicator
              mapId={activeMap.id}
              isLocal={!!activeMap.isLocal}
              status={syncStatus[activeMap.id]}
              lastSyncAt={lastServerSyncAt[activeMap.id]}
              onRetry={saveActiveNow}
            />
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
          <div className="mb-2 border border-border-light rounded-lg bg-bg-secondary overflow-hidden">
            {/* 선택 모드 헤더 — 전체선택 토글 + 안내 + 닫기 */}
            {selectionMode && (
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border-light bg-bg-primary">
                <div className="flex items-center gap-2 min-w-0">
                  {modeMapList.length > 0 && (
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1 text-xs text-text-secondary hover:text-primary transition-colors shrink-0"
                      title={allSelected ? '전체 해제' : '전체 선택'}
                    >
                      {allSelected
                        ? <CheckSquare size={14} className="text-primary" />
                        : <Square size={14} />}
                      {allSelected ? '전체해제' : '전체선택'}
                    </button>
                  )}
                  <span className="text-xs text-text-tertiary truncate">
                    클릭하여 선택
                  </span>
                </div>
                <button
                  onClick={exitSelectionMode}
                  className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors shrink-0"
                  title="선택 모드 종료"
                >
                  <X size={13} /> 닫기
                </button>
              </div>
            )}

            {/* 스크롤 영역 — 액션바를 항상 보이게 하려고 분리 */}
            <div className="max-h-40 overflow-y-auto">
              {modeMapList.length === 0 ? (
                <p className="text-xs text-text-tertiary text-center py-3">
                  이 모드에 저장된 마인드맵이 없습니다
                </p>
              ) : (
                modeMapList.map((m) => {
                  const checked = selectedIds.has(m.id);
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors
                        ${selectionMode
                          ? `cursor-pointer ${checked ? 'bg-primary/10' : 'hover:bg-bg-tertiary'}`
                          : 'cursor-pointer hover:bg-bg-tertiary'}
                        ${!selectionMode && m.id === activeMapId ? 'bg-primary/10 text-primary' : 'text-text-primary'}`}
                      onClick={selectionMode ? () => toggleSelected(m.id) : undefined}
                    >
                      {/* 체크박스 (선택 모드 시) */}
                      {selectionMode && (
                        <span className="shrink-0 text-primary" aria-hidden>
                          {checked ? <CheckSquare size={16} /> : <Square size={16} className="text-text-tertiary" />}
                        </span>
                      )}

                      {selectionMode ? (
                        <span className="flex-1 text-left truncate">
                          {m.title}
                          <span className="ml-2 text-xs text-text-tertiary">{m.nodes.length}개 노드</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSelect(m.id)}
                          className="flex-1 text-left truncate"
                        >
                          {m.title}
                          <span className="ml-2 text-xs text-text-tertiary">{m.nodes.length}개 노드</span>
                        </button>
                      )}

                      {/* 단건 삭제 — 선택 모드 시 숨김 */}
                      {!selectionMode && (
                        showDeleteConfirm === m.id ? (
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
                            className="text-text-tertiary hover:text-danger shrink-0 ml-2 transition-colors"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 평시 푸터 — 선택 모드 진입 토글 */}
            {!selectionMode && modeMapList.length > 0 && (
              <div className="flex justify-end px-3 py-1.5 border-t border-border-light bg-bg-primary">
                <button
                  onClick={() => setSelectionMode(true)}
                  className="flex items-center gap-1 text-xs text-text-secondary hover:text-primary transition-colors"
                  title="여러 개 선택해서 한 번에 삭제"
                >
                  <CheckSquare size={13} /> 여러 개 선택
                </button>
              </div>
            )}

            {/* 선택 모드 액션바 — 확인 팝오버 인라인 노출 */}
            {selectionMode && (
              <div className="border-t border-border-light bg-bg-primary">
                {showBatchConfirm && (
                  <div className="px-3 py-2 border-b border-border-light bg-danger/5">
                    <p className="text-xs text-text-primary mb-1">
                      <span className="font-semibold text-danger">{selectedIds.size}개</span> 마인드맵을 삭제할까요?
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      삭제된 마인드맵은 보관되지만, 목록에서는 사라집니다.
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">{selectedIds.size}개</span> 선택됨
                  </span>
                  <div className="flex items-center gap-1.5">
                    {showBatchConfirm ? (
                      <>
                        <button
                          onClick={() => setShowBatchConfirm(false)}
                          className="px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary rounded transition-colors"
                        >
                          취소
                        </button>
                        <button
                          onClick={confirmBatchDelete}
                          className="px-2.5 py-1 text-xs text-white bg-danger rounded hover:bg-danger/80 transition-colors"
                        >
                          삭제
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowBatchConfirm(true)}
                        disabled={selectedIds.size === 0}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-danger rounded
                                   hover:bg-danger/80 disabled:bg-text-tertiary/40 disabled:cursor-not-allowed
                                   transition-colors"
                      >
                        <Trash2 size={12} /> 삭제
                      </button>
                    )}
                  </div>
                </div>
              </div>
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
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-text-secondary">
            선택: <span className="font-medium text-text-primary">
              {selectedNode ? selectedNode.label : '노드를 선택하세요'}
            </span>
          </p>
          {/* 선택된 노드가 있을 때만 인라인 삭제 진입점 노출 */}
          {selectedNode && (
            showDeleteSelectedConfirm ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDeleteSelected}
                  className="px-2 py-0.5 text-xs text-white bg-danger rounded hover:bg-danger/80"
                >
                  확인
                </button>
                <button
                  onClick={() => setShowDeleteSelectedConfirm(false)}
                  className="text-text-tertiary hover:text-text-primary"
                  aria-label="삭제 취소"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteSelectedConfirm(true)}
                className="flex items-center gap-1 text-xs text-danger hover:text-danger/80 transition-colors"
                title="선택 노드 삭제"
              >
                <Trash2 size={12} /> 선택 삭제
              </button>
            )
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={nodeInput}
            onChange={(e) => setNodeInput(e.target.value.slice(0, 200))}
            onKeyDown={handleKeyDown}
            maxLength={200}
            placeholder={
              selectedNode
                ? '하위 노드 이름'
                : hasRoot
                  ? '루트가 이미 있습니다 — 부모를 선택하세요'
                  : '루트 노드 이름'
            }
            className="flex-1 px-3 py-1.5 text-sm border border-border-light rounded-lg
                       bg-bg-primary text-text-primary placeholder:text-text-secondary
                       focus:outline-none focus:border-primary transition-colors"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleAddNode}
            disabled={!nodeInput.trim() || rootBlocked}
            title={rootBlocked ? '루트가 이미 있습니다 — 부모를 선택하세요' : '노드 추가'}
          >
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
      </>
      )}
    </div>
  );
}

/**
 * 서버 동기화 상태 인디케이터.
 * @param {object} props
 * @param {string} props.mapId
 * @param {boolean} props.isLocal — true면 "아직 저장 안 됨"
 * @param {'idle'|'saving'|'saved'|'error'|undefined} props.status
 * @param {number|undefined} props.lastSyncAt
 * @param {() => void} props.onRetry — error 상태에서 클릭 시 재시도
 */
function SyncIndicator({ isLocal, status, lastSyncAt, onRetry }) {
  if (isLocal) {
    return (
      <span className="text-[10px] text-warning shrink-0" title="아직 서버에 저장되지 않았습니다">
        아직 저장 안 됨
      </span>
    );
  }

  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-text-tertiary shrink-0">
        <Loader2 size={12} className="animate-spin" />
        저장 중
      </span>
    );
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1 text-[10px] text-danger hover:text-danger/80 shrink-0"
        title="클릭하여 재시도"
      >
        <AlertTriangle size={12} />
        저장 실패
      </button>
    );
  }

  if (status === 'saved' && lastSyncAt) {
    const diffMs = Date.now() - lastSyncAt;
    const label = formatSyncTimeLabel(diffMs, lastSyncAt);
    return (
      <span className="flex items-center gap-1 text-[10px] text-text-tertiary shrink-0">
        <Check size={12} className="text-success/70" />
        {label}
      </span>
    );
  }

  // idle / undefined → 표시 안함
  return null;
}

/** 경과 시간에 따라 "방금 전 저장됨" / "N초 전 저장됨" / HH:MM 형태로 렌더 */
function formatSyncTimeLabel(diffMs, lastSyncAt) {
  const TWO_MIN = 2 * 60 * 1000;
  if (diffMs < 10 * 1000) return '방금 저장됨';
  if (diffMs < 60 * 1000) return `${Math.floor(diffMs / 1000)}초 전 저장됨`;
  if (diffMs < TWO_MIN) return `${Math.floor(diffMs / 1000)}초 전 저장됨`;
  const d = new Date(lastSyncAt);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} 저장됨`;
}
