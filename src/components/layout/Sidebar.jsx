/**
 * @fileoverview 좌측 사이드바 레이아웃 컴포넌트
 * LLM/모드 선택, 대화 목록, 마인드맵 토글, 설정 링크를 제공한다.
 * 접힌 상태(collapsed)에서는 아이콘만 표시한다.
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  BookOpen,
  Brain,
  MessageSquare,
  Trash2,
  X,
} from 'lucide-react';
import useAppStore from '../../stores/useAppStore';
import useChatStore from '../../stores/useChatStore';
import Dropdown from '../common/Dropdown';
import Toggle from '../common/Toggle';
import Button from '../common/Button';
import { LLM_OPTIONS } from '../../utils/constants';
import { MODE_LIST, getModeConfig } from '../../registry/modes';

export default function Sidebar() {
  const navigate = useNavigate();

  const selectedLLM = useAppStore((s) => s.selectedLLM);
  const mainMode = useAppStore((s) => s.mainMode);
  const isMindmapOn = useAppStore((s) => s.isMindmapOn);
  const isSidebarCollapsed = useAppStore((s) => s.isSidebarCollapsed);
  const setLLM = useAppStore((s) => s.setLLM);
  const setMainMode = useAppStore((s) => s.setMainMode);
  const toggleMindmap = useAppStore((s) => s.toggleMindmap);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  const conversations = useChatStore((s) => s.conversations);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const createConversation = useChatStore((s) => s.createConversation);
  const setCurrentConversation = useChatStore((s) => s.setCurrentConversation);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const deleteConversations = useChatStore((s) => s.deleteConversations);

  const collapsed = isSidebarCollapsed;

  // 삭제 모드 상태
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleDeleteMode = useCallback(() => {
    setIsDeleteMode((prev) => !prev);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`${selectedIds.size}개의 대화를 삭제하시겠습니까?`)) {
      deleteConversations([...selectedIds]);
      setIsDeleteMode(false);
      setSelectedIds(new Set());
    }
  }, [selectedIds, deleteConversations]);

  const isAllSelected = conversations.length > 0 && selectedIds.size === conversations.length;

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(conversations.map((c) => c.id)));
    }
  }, [isAllSelected, conversations]);

  // 새 대화 생성 후 기존 메시지 초기화
  const handleNewConversation = () => {
    createConversation(mainMode);
    clearMessages();
  };

  // 대화 선택 시 해당 대화로 전환
  const handleSelectConversation = (id) => {
    setCurrentConversation(id);
  };

  const modeOptions = MODE_LIST.map(({ value, label }) => ({ value, label }));

  return (
    <aside
      className={`
        flex flex-col h-full border-r border-border-light
        bg-bg-primary transition-all duration-300 overflow-hidden
        ${collapsed ? 'w-[60px]' : 'w-[220px]'}
      `}
    >
      {/* Header: Logo + Collapse */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-border-light">
        <div className="flex items-center gap-2 overflow-hidden">
          <BookOpen size={20} className="text-primary shrink-0" />
          {!collapsed && (
            <span className="text-sm font-bold text-text-primary whitespace-nowrap">
              업무공부도구
            </span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-bg-secondary text-text-secondary shrink-0"
          aria-label={collapsed ? '사이드바 열기' : '사이드바 닫기'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* New Conversation */}
      <div className="px-3 py-3 border-b border-border-light">
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={handleNewConversation}
        >
          <Plus size={16} />
          {!collapsed && <span>새 대화</span>}
        </Button>
      </div>

      {/* LLM / Mode / Toggle — hidden labels when collapsed */}
      {!collapsed && (
        <div className="flex flex-col gap-3 px-3 py-3 border-b border-border-light">
          <Dropdown
            label="LLM 선택"
            options={LLM_OPTIONS}
            value={selectedLLM}
            onChange={setLLM}
          />
          <Dropdown
            label="메인 모드"
            options={modeOptions}
            value={mainMode}
            onChange={setMainMode}
          />
          <div>
            <span className="text-xs font-medium text-text-secondary mb-1 block">
              서브 기능
            </span>
            <Toggle
              label="마인드맵"
              checked={isMindmapOn}
              onChange={toggleMindmap}
            />
          </div>
        </div>
      )}

      {/* Collapsed: icon-only controls */}
      {collapsed && (
        <div className="flex flex-col items-center gap-3 px-1 py-3 border-b border-border-light">
          <Brain
            size={18}
            className={`cursor-pointer ${isMindmapOn ? 'text-primary' : 'text-text-secondary'}`}
            onClick={toggleMindmap}
            title="마인드맵 토글"
          />
        </div>
      )}

      {/* Recent Conversations */}
      <div className="flex-1 overflow-y-auto px-1 py-2">
        {!collapsed && (
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="flex items-center gap-1">
              <MessageSquare size={14} className="text-text-secondary" />
              <span className="text-xs font-medium text-text-secondary">최근 대화</span>
            </div>
            {conversations.length > 0 && (
              <button
                onClick={toggleDeleteMode}
                className="p-0.5 rounded hover:bg-bg-secondary text-text-tertiary hover:text-danger transition-colors"
                title={isDeleteMode ? '취소' : '대화 정리'}
              >
                {isDeleteMode ? <X size={14} /> : <Trash2 size={14} />}
              </button>
            )}
          </div>
        )}
        {isDeleteMode && !collapsed && (
          <div className="flex items-center gap-1 px-2 py-1.5 mb-1">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:bg-bg-secondary rounded px-1.5 py-1 transition-colors"
            >
              <input
                type="checkbox"
                checked={isAllSelected}
                readOnly
                className="shrink-0 accent-danger pointer-events-none"
              />
              <span>전체선택</span>
            </button>
            <div className="flex-1" />
            <button
              onClick={toggleDeleteMode}
              className="text-xs px-2 py-1 rounded text-text-secondary hover:bg-bg-secondary transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0}
              className={`text-xs px-2 py-1 rounded transition-colors
                ${selectedIds.size > 0
                  ? 'bg-danger text-white hover:bg-danger/90'
                  : 'bg-bg-secondary text-text-tertiary cursor-not-allowed'}`}
            >
              삭제({selectedIds.size})
            </button>
          </div>
        )}
        <ul className="flex flex-col gap-0.5">
          {conversations.map((conv) => {
            const Icon = getModeConfig(conv.mode).icon;
            const isActive = conv.id === currentConversationId;
            const isSelected = selectedIds.has(conv.id);
            return (
              <li key={conv.id}>
                <button
                  onClick={() => isDeleteMode ? toggleSelect(conv.id) : handleSelectConversation(conv.id)}
                  className={`
                    w-full flex items-center gap-2 px-2 py-1.5 rounded-md
                    text-sm text-left transition-colors
                    ${isDeleteMode && isSelected
                      ? 'bg-danger/10 text-danger'
                      : isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-text-primary hover:bg-bg-secondary'}
                  `}
                  title={collapsed ? conv.title : undefined}
                >
                  {isDeleteMode && !collapsed && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="shrink-0 accent-danger pointer-events-none"
                    />
                  )}
                  <Icon size={16} className="shrink-0" />
                  {!collapsed && (
                    <span className="truncate">{conv.title}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Settings */}
      <div className="border-t border-border-light px-3 py-3">
        <button
          onClick={() => navigate('/admin')}
          className={`
            flex items-center gap-2 w-full px-2 py-1.5 rounded-md
            text-sm text-text-secondary hover:bg-bg-secondary transition-colors
            ${collapsed ? 'justify-center' : ''}
          `}
        >
          <Settings size={18} />
          {!collapsed && <span>설정</span>}
        </button>
      </div>
    </aside>
  );
}
