/**
 * @fileoverview 마인드맵 패널 — 툴바(저장/불러오기/삭제), 노드 추가 입력, 캔버스를 포함하는 전체 레이아웃.
 */
import { useState, useCallback, useEffect } from 'react';
import { Save, Trash2, Plus, FolderOpen, Loader, CheckCircle } from 'lucide-react';

import useMindmapStore from '../../stores/useMindmapStore';
import { saveMindmap, getMindmapList, getMindmap } from '../../services/mindmapApi';
import { showError, showSuccess } from '../../utils/errorHandler';
import Button from '../common/Button';
import MindmapCanvas from './MindmapCanvas';

/** 마지막 저장 시각으로부터 경과 시간을 표시하는 인디케이터 */
function AutoSaveIndicator() {
  const lastSavedAt = useMindmapStore((s) => s.lastSavedAt);
  const [elapsed, setElapsed] = useState(null);

  // 저장 시각 변경 시 1초 간격으로 경과 시간 갱신
  useEffect(() => {
    if (!lastSavedAt) { setElapsed(null); return; }
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - lastSavedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastSavedAt]);

  const label = elapsed === null ? '저장 대기' : elapsed === 0 ? '방금 저장됨' : `${elapsed}초 전 저장됨`;

  return (
    <span className="flex items-center gap-1 text-xs text-success whitespace-nowrap shrink-0">
      <CheckCircle size={14} />
      {label}
    </span>
  );
}

/** 툴바 버튼 (호버 시 툴팁 표시) */
function ToolbarButton({ icon: Icon, label, tooltip, onClick, variant }) {
  const base = 'group relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors';
  const style = variant === 'danger'
    ? 'text-danger hover:bg-danger/10'
    : 'text-text-secondary hover:text-primary hover:bg-bg-secondary';

  return (
    <button className={`${base} ${style}`} onClick={onClick}>
      <Icon size={20} />
      <span>{label}</span>
      <span className="pointer-events-none absolute left-0 top-full mt-2
                        whitespace-nowrap rounded-md bg-gray-800 px-2.5 py-1.5 text-xs text-white
                        opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
        {tooltip}
      </span>
    </button>
  );
}

/** 마인드맵 패널 메인 컴포넌트 */
export default function MindmapPanel() {
  const [inputValue, setInputValue] = useState('');
  const [savedList, setSavedList] = useState([]);
  const [showList, setShowList] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const nodes = useMindmapStore((s) => s.nodes);
  const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
  const addNode = useMindmapStore((s) => s.addNode);
  const clearAll = useMindmapStore((s) => s.clearAll);
  const markSaved = useMindmapStore((s) => s.markSaved);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const handleSave = useCallback(async () => {
    try {
      await saveMindmap({ title: '마인드맵', nodes });
      markSaved();
      showSuccess('마인드맵이 저장되었습니다');
    } catch {
      showError(null, '마인드맵 저장에 실패했습니다');
    }
  }, [nodes, markSaved]);

  const handleClearAll = useCallback(() => {
    if (nodes.length === 0) return;
    if (window.confirm('모든 노드를 삭제하시겠습니까?')) clearAll();
  }, [nodes.length, clearAll]);

  // 선택된 노드의 하위(또는 루트)에 새 노드 추가
  const handleAddNode = useCallback(() => {
    const label = inputValue.trim();
    if (!label) return;
    addNode(selectedNodeId, label);
    setInputValue('');
  }, [inputValue, selectedNodeId, addNode]);

  // IME 조합 중이 아닐 때만 Enter로 노드 추가
  const handleKeyDown = useCallback(
    (e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddNode(); },
    [handleAddNode],
  );

  // 저장된 마인드맵 목록 토글 (열릴 때 서버에서 목록 조회)
  const toggleList = useCallback(async () => {
    if (showList) { setShowList(false); return; }
    setListLoading(true);
    try {
      const list = await getMindmapList();
      setSavedList(list);
    } catch {
      setSavedList([]);
    }
    setListLoading(false);
    setShowList(true);
  }, [showList]);

  // 선택한 마인드맵을 서버에서 불러와 스토어에 반영
  const handleLoad = useCallback(async (id) => {
    try {
      const data = await getMindmap(id);
      useMindmapStore.setState({ nodes: data.nodes, selectedNodeId: null });
      setShowList(false);
    } catch {
      showError(null, '마인드맵 불러오기에 실패했습니다');
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      <div className="px-4 py-3 border-b border-border-light">
        <h2 className="text-base font-semibold text-text-primary flex items-center gap-2 mb-3">
          <span role="img" aria-label="brain">🧠</span> 마인드맵
        </h2>
        <div className="flex items-center gap-2">
          <ToolbarButton icon={FolderOpen} label="불러오기" tooltip="저장된 마인드맵 목록에서 불러옵니다" onClick={toggleList} />
          <ToolbarButton icon={Save} label="저장" tooltip="현재 마인드맵을 서버에 저장합니다" onClick={handleSave} />
          <ToolbarButton icon={Trash2} label="삭제" tooltip="모든 노드를 삭제합니다" onClick={handleClearAll} variant="danger" />
          <div className="flex-1" />
          <AutoSaveIndicator />
        </div>
      </div>

      {showList && (
        <div className="px-3 py-2 border-b border-border-light bg-bg-secondary max-h-36 overflow-y-auto">
          {listLoading ? (
            <div className="flex justify-center py-2"><Loader size={16} className="animate-spin text-text-tertiary" /></div>
          ) : savedList.length === 0 ? (
            <p className="text-xs text-text-tertiary text-center py-2">저장된 마인드맵이 없습니다</p>
          ) : (
            savedList.map((item) => (
              <button
                key={item.id}
                onClick={() => handleLoad(item.id)}
                className="flex items-center justify-between w-full px-2 py-1.5 text-sm rounded hover:bg-bg-tertiary transition-colors"
              >
                <span className="text-text-primary truncate">{item.title}</span>
                <span className="text-xs text-text-tertiary shrink-0 ml-2">{item.nodeCount}개</span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="px-4 py-3 border-b border-border-light space-y-2">
        <p className="text-xs text-text-secondary">
          선택: <span className="font-medium text-text-primary">
            {selectedNode ? selectedNode.label : '노드를 선택하세요'}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedNode ? '하위 노드 이름' : '루트 노드 이름'}
            className="flex-1 px-3 py-1.5 text-sm border border-border-light rounded-lg
                       bg-bg-primary text-text-primary placeholder:text-text-secondary
                       focus:outline-none focus:border-primary transition-colors"
          />
          <Button variant="primary" size="sm" onClick={handleAddNode} disabled={!inputValue.trim()} title="노드 추가">
            <Plus size={16} />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <MindmapCanvas />
      </div>
    </div>
  );
}
