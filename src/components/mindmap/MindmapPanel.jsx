import { useState, useCallback, useEffect } from 'react';
import { Save, Trash2, Plus, FolderOpen, Loader } from 'lucide-react';

import useMindmapStore from '../../stores/useMindmapStore';
import { saveMindmap, getMindmapList, getMindmap } from '../../services/mindmapApi';
import { showError, showSuccess } from '../../utils/errorHandler';
import Button from '../common/Button';
import MindmapCanvas from './MindmapCanvas';

export default function MindmapPanel() {
  const [inputValue, setInputValue] = useState('');
  const [savedList, setSavedList] = useState([]);
  const [showList, setShowList] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const nodes = useMindmapStore((s) => s.nodes);
  const selectedNodeId = useMindmapStore((s) => s.selectedNodeId);
  const addNode = useMindmapStore((s) => s.addNode);
  const clearAll = useMindmapStore((s) => s.clearAll);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const handleSave = useCallback(async () => {
    try {
      const result = await saveMindmap({ title: '마인드맵', nodes });
      showSuccess('마인드맵이 저장되었습니다');
    } catch {
      showError(null, '마인드맵 저장에 실패했습니다');
    }
  }, [nodes]);

  const handleClearAll = useCallback(() => {
    if (nodes.length === 0) return;
    if (window.confirm('모든 노드를 삭제하시겠습니까?')) clearAll();
  }, [nodes.length, clearAll]);

  const handleAddNode = useCallback(() => {
    const label = inputValue.trim();
    if (!label) return;
    addNode(selectedNodeId, label);
    setInputValue('');
  }, [inputValue, selectedNodeId, addNode]);

  const handleKeyDown = useCallback(
    (e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddNode(); },
    [handleAddNode],
  );

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
        <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
          <span role="img" aria-label="brain">🧠</span> 마인드맵
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={toggleList} title="불러오기">
            <FolderOpen size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSave} title="저장">
            <Save size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClearAll} title="전체삭제">
            <Trash2 size={16} />
          </Button>
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
