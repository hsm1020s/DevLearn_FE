/**
 * @fileoverview 좌측 사이드바 레이아웃 컴포넌트
 * LLM/모드 선택, 대화 목록, 마인드맵 토글, 설정 링크를 제공한다.
 * 접힌 상태(collapsed)에서는 아이콘만 표시한다.
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  MoreHorizontal,
  Pencil,
  Star,
  Lightbulb,
  Paperclip,
  User,
  LogOut,
  ChevronUp,
} from 'lucide-react';
import SuggestionModal from '../common/SuggestionModal';
import PdfUploadModal from '../common/PdfUploadModal';
import LoginModal from '../common/LoginModal';
import useAuthStore from '../../stores/useAuthStore';
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
  const renameConversation = useChatStore((s) => s.renameConversation);
  const toggleFavorite = useChatStore((s) => s.toggleFavorite);

  // 즐겨찾기 목록 (최대 3개)
  const favorites = conversations.filter((c) => c.isFavorite).slice(0, 3);

  const collapsed = isSidebarCollapsed;

  // 인증 상태
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // 모달 상태
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [showPdfUpload, setShowPdfUpload] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // 로그아웃 드롭다운 상태
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const userBtnRef = useRef(null);

  // 삭제 모드 상태
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // ··· 컨텍스트 메뉴 상태
  const [menuOpenId, setMenuOpenId] = useState(null);
  const menuRef = useRef(null);

  // 사이드바 하단 버튼 ref (팝오버 앵커용)
  const pdfBtnRef = useRef(null);
  const suggestionBtnRef = useRef(null);
  const loginBtnRef = useRef(null);

  // 새 채팅명 입력 상태
  const [newConvTitle, setNewConvTitle] = useState('');

  // 삭제 확인 팝오버 상태 ({ type: 'single'|'batch', id?, rect })
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const deleteConfirmRef = useRef(null);

  // 인라인 편집 상태
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef(null);

  // 유저 메뉴 바깥 클릭 시 닫기
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClick = (e) => {
      if (
        userMenuRef.current && !userMenuRef.current.contains(e.target) &&
        userBtnRef.current && !userBtnRef.current.contains(e.target)
      ) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showUserMenu]);

  // 메뉴 바깥 클릭 시 닫기
  useEffect(() => {
    if (!menuOpenId) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpenId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId]);

  // 삭제 확인 팝오버 바깥 클릭 시 닫기
  useEffect(() => {
    if (!deleteConfirm) return;
    const handleClickOutside = (e) => {
      if (deleteConfirmRef.current && !deleteConfirmRef.current.contains(e.target)) {
        setDeleteConfirm(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [deleteConfirm]);

  // 편집 모드 진입 시 input 포커스
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = useCallback((conv) => {
    setEditingId(conv.id);
    setEditValue(conv.title);
    setMenuOpenId(null);
  }, []);

  const handleConfirmRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && editingId) renameConversation(editingId, trimmed);
    setEditingId(null);
    setEditValue('');
  }, [editingId, editValue, renameConversation]);

  // 개별 삭제 — 삭제 버튼 위치에 확인 팝오버 표시
  const handleDeleteSingle = useCallback((id, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuOpenId(null);
    setDeleteConfirm({ type: 'single', id, rect });
  }, []);

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

  // 다중 삭제 — 삭제 버튼 위치에 확인 팝오버 표시
  const handleDeleteSelected = useCallback((e) => {
    if (selectedIds.size === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDeleteConfirm({ type: 'batch', rect });
  }, [selectedIds]);

  // 삭제 확인 팝오버에서 "삭제" 클릭 시 실제 삭제 수행
  const confirmDelete = useCallback(() => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'single') {
      deleteConversations([deleteConfirm.id]);
    } else {
      deleteConversations([...selectedIds]);
      setIsDeleteMode(false);
      setSelectedIds(new Set());
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteConversations, selectedIds]);

  const isAllSelected = conversations.length > 0 && selectedIds.size === conversations.length;

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(conversations.map((c) => c.id)));
    }
  }, [isAllSelected, conversations]);

  // 새 채팅 생성 후 기존 메시지 초기화 (선택된 LLM, 입력된 채팅명 함께 저장)
  const handleNewConversation = () => {
    const title = newConvTitle.trim();
    createConversation(mainMode, selectedLLM, title);
    setNewConvTitle('');
    clearMessages();
  };

  // 대화 선택 시 해당 대화로 전환
  const handleSelectConversation = (id) => {
    setCurrentConversation(id);
  };

  const modeOptions = MODE_LIST.map(({ value, label }) => ({ value, label }));

  // LLM value → label 매핑 (대화 목록에서 모델명 표시용)
  const llmLabelMap = Object.fromEntries(LLM_OPTIONS.map(({ value, label }) => [value, label]));

  return (
    <aside
      className={`
        flex flex-col h-full border-r border-border-light
        bg-bg-primary transition-all duration-300 overflow-hidden
        ${collapsed ? 'w-[40px]' : 'w-[220px]'}
      `}
    >
      {/* Header: Logo + Collapse */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-3 py-4 border-b border-border-light`}>
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <BookOpen size={20} className="text-primary shrink-0" />
            <span className="text-sm font-bold text-text-primary whitespace-nowrap">
              DevLearn
            </span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-bg-secondary text-text-secondary shrink-0"
          aria-label={collapsed ? '사이드바 열기' : '사이드바 닫기'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
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

      {/* New Conversation — 대화명 입력 + 생성 버튼 */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-border-light flex flex-col gap-2">
          <input
            type="text"
            value={newConvTitle}
            onChange={(e) => setNewConvTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleNewConversation();
            }}
            placeholder="채팅명 입력 (선택)"
            className="w-full px-2.5 py-1.5 text-sm border border-border-light rounded-md
                       bg-bg-primary text-text-primary placeholder:text-text-tertiary
                       focus:outline-none focus:border-primary transition-colors"
          />
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={handleNewConversation}
          >
            <Plus size={16} />
            <span>새 채팅</span>
          </Button>
        </div>
      )}

      {/* Favorites */}
      {!collapsed && (
        <div className="px-1 py-2 border-b border-border-light">
          <div className="flex items-center gap-1 px-2 mb-2">
            <Star size={14} className="text-yellow-500" />
            <span className="text-xs font-medium text-text-secondary">즐겨찾기</span>
          </div>
          {favorites.length === 0 ? (
            <p className="text-xs text-text-tertiary text-center py-1">채팅 ··· 메뉴에서 추가</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {favorites.map((conv) => {
                const Icon = getModeConfig(conv.mode).icon;
                const isActive = conv.id === currentConversationId;
                return (
                  <li key={conv.id}>
                    <button
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1.5 rounded-md
                        text-sm text-left transition-colors
                        ${isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-text-primary hover:bg-bg-secondary'}
                      `}
                    >
                      <Icon size={16} className="shrink-0 mt-0.5" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="truncate">{conv.title}</span>
                        {conv.llm && (
                          <span className="text-[10px] text-text-tertiary leading-tight">
                            {llmLabelMap[conv.llm] ?? conv.llm}
                          </span>
                        )}
                      </div>
                      <Star
                        size={12}
                        className="shrink-0 text-yellow-500 fill-yellow-500 hover:opacity-60 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(conv.id); }}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Recent Conversations */}
      {!collapsed && <div className="flex-1 overflow-y-auto px-1 py-2">
        {/* 최근 대화 헤더 */}
        <div className="flex items-center justify-between px-2 mb-2">
            <div className="flex items-center gap-1">
              <MessageSquare size={14} className="text-text-secondary" />
              <span className="text-xs font-medium text-text-secondary">최근 채팅</span>
            </div>
            {conversations.length > 0 && (
              <button
                onClick={toggleDeleteMode}
                className="p-0.5 rounded hover:bg-bg-secondary text-text-tertiary hover:text-danger transition-colors"
                title={isDeleteMode ? '취소' : '채팅 정리'}
              >
                {isDeleteMode ? <X size={14} /> : <Trash2 size={14} />}
              </button>
            )}
          </div>
        {isDeleteMode && (
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
            const isEditing = editingId === conv.id;
            return (
              <li key={conv.id} className="group relative">
                {isEditing && !collapsed ? (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <Icon size={16} className="shrink-0 text-primary" />
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleConfirmRename();
                        if (e.key === 'Escape') { setEditingId(null); setEditValue(''); }
                      }}
                      onBlur={handleConfirmRename}
                      className="flex-1 min-w-0 px-1.5 py-0.5 text-sm border border-primary rounded
                                 bg-bg-primary text-text-primary focus:outline-none"
                    />
                  </div>
                ) : (
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
                    <Icon size={16} className="shrink-0 mt-0.5" />
                    {!collapsed && (
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="truncate">{conv.title}</span>
                        {conv.llm && (
                          <span className="text-[10px] text-text-tertiary leading-tight">
                            {llmLabelMap[conv.llm] ?? conv.llm}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                )}
                {/* ··· 더보기 메뉴 */}
                {!collapsed && !isDeleteMode && !isEditing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === conv.id ? null : conv.id); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded
                               text-text-tertiary hover:text-text-primary hover:bg-bg-secondary
                               opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                )}
                {menuOpenId === conv.id && (
                  <div ref={menuRef} className="absolute right-0 top-full z-50 bg-white border border-border-light rounded-lg shadow-lg py-1 min-w-[130px]">
                    <button
                      onClick={() => { toggleFavorite(conv.id); setMenuOpenId(null); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-secondary transition-colors"
                    >
                      <Star size={12} className={conv.isFavorite ? 'text-yellow-500 fill-yellow-500' : ''} />
                      {conv.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
                    </button>
                    <button
                      onClick={() => handleStartRename(conv)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-secondary transition-colors"
                    >
                      <Pencil size={12} /> 이름 변경
                    </button>
                    <button
                      onClick={(e) => handleDeleteSingle(conv.id, e)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 transition-colors"
                    >
                      <Trash2 size={12} /> 삭제
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>}

      {/* Suggestion & Settings */}
      {!collapsed && (
        <div className="border-t border-border-light px-3 py-2 flex flex-col gap-0.5">
          <button
            ref={pdfBtnRef}
            onClick={() => setShowPdfUpload(true)}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md
              text-sm text-text-secondary hover:bg-bg-secondary transition-colors"
          >
            <Paperclip size={18} />
            <span>PDF 업로드</span>
          </button>
          <button
            ref={suggestionBtnRef}
            onClick={() => setShowSuggestion(true)}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md
              text-sm text-text-secondary hover:bg-bg-secondary transition-colors"
          >
            <Lightbulb size={18} />
            <span>기능개선 제안</span>
          </button>
          {isLoggedIn ? (
            <div className="relative">
              <button
                ref={userBtnRef}
                onClick={() => setShowUserMenu((prev) => !prev)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md
                  text-sm text-text-secondary hover:bg-bg-secondary transition-colors"
              >
                <User size={18} />
                <span className="flex-1 text-left truncate">{authUser?.name ?? '사용자'}</span>
                <ChevronUp
                  size={14}
                  className={`shrink-0 transition-transform duration-200 ${showUserMenu ? '' : 'rotate-180'}`}
                />
              </button>
              {/* 설정 + 로그아웃 드롭다운 — 버튼 위에 fixed로 표시 */}
              {showUserMenu && userBtnRef.current && (() => {
                const rect = userBtnRef.current.getBoundingClientRect();
                return (
                  <div
                    ref={userMenuRef}
                    className="fixed z-[999]
                      bg-white border border-border-light rounded-lg shadow-lg py-1 min-w-[120px]
                      animate-popover-in"
                    style={{ bottom: window.innerHeight - rect.top, left: rect.left }}
                  >
                    <button
                      onClick={() => { navigate('/admin'); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm
                        text-text-primary hover:bg-bg-secondary transition-colors"
                    >
                      <Settings size={16} />
                      설정
                    </button>
                    <div className="border-t border-border-light my-1" />
                    <button
                      onClick={() => { logout(); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm
                        text-danger hover:bg-danger/10 transition-colors"
                    >
                      <LogOut size={16} />
                      로그아웃
                    </button>
                  </div>
                );
              })()}
            </div>
          ) : (
            <button
              ref={loginBtnRef}
              onClick={() => setShowLogin(true)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md
                text-sm text-text-secondary hover:bg-bg-secondary transition-colors"
            >
              <User size={18} />
              <span>로그인</span>
            </button>
          )}
        </div>
      )}

      <PdfUploadModal isOpen={showPdfUpload} onClose={() => setShowPdfUpload(false)} anchorRef={pdfBtnRef} />
      <SuggestionModal isOpen={showSuggestion} onClose={() => setShowSuggestion(false)} anchorRef={suggestionBtnRef} />
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} anchorRef={loginBtnRef} />

      {/* 삭제 확인 팝오버 — 삭제 버튼 바로 옆에 fixed로 표시 */}
      {deleteConfirm && (
        <div
          ref={deleteConfirmRef}
          className="fixed z-[999] bg-white border border-border-light rounded-lg shadow-lg p-3 min-w-[160px] animate-popover-in"
          style={{
            top: deleteConfirm.rect.top,
            left: deleteConfirm.rect.right + 6,
          }}
        >
          <p className="text-xs text-text-primary mb-2.5">
            {deleteConfirm.type === 'single'
              ? '이 채팅을 삭제할까요?'
              : `${selectedIds.size}개의 채팅을 삭제할까요?`}
          </p>
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="text-xs px-2.5 py-1 rounded text-text-secondary hover:bg-bg-secondary transition-colors"
            >
              취소
            </button>
            <button
              onClick={confirmDelete}
              className="text-xs px-2.5 py-1 rounded bg-danger text-white hover:bg-danger/90 transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
