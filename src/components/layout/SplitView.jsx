/**
 * @fileoverview 좌우 분할 뷰 컴포넌트
 * 데스크톱: 우측 패널 표시 시 드래그 가능한 리사이저로 비율 조절 (20~80% 클램프, 비율은 persist).
 * 모바일(768px 미만): 마인드맵 ON 시 탭 전환으로 채팅/마인드맵 교차 표시.
 */
import { useEffect, useRef, useState } from 'react';
import useAppStore from '../../stores/useAppStore';

/**
 * 좌우 분할 레이아웃 (모바일에서는 탭 전환)
 * @param {ReactNode} leftContent - 좌측 패널 콘텐츠 (메인 모드)
 * @param {ReactNode} rightContent - 우측 패널 콘텐츠 (마인드맵 등)
 * @param {boolean} isRightVisible - 우측 패널 표시 여부
 */
export default function SplitView({ leftContent, rightContent, isRightVisible }) {
  const [mobileTab, setMobileTab] = useState('chat');
  const splitLeftPct = useAppStore((s) => s.splitLeftPct);
  const setSplitLeftPct = useAppStore((s) => s.setSplitLeftPct);

  // 리사이저 드래그는 데스크톱(md 이상)에서만 의미가 있으므로 브레이크포인트 추적
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);

  // 마인드맵 꺼진 상태 — 전체 너비로 좌측만 표시
  if (!isRightVisible) {
    return (
      <div className="h-full w-full">
        {leftContent}
      </div>
    );
  }

  // pointer capture로 포인터가 리사이저 밖으로 벗어나도 드래그 추적 유지
  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    // 드래그 중 텍스트 선택 방지 (pointerup에서 복원)
    document.body.style.userSelect = 'none';
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setSplitLeftPct(pct); // 스토어가 20~80으로 clamp
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.userSelect = '';
  };

  return (
    <div ref={containerRef} className="flex flex-col md:flex-row h-full">
      {/* 모바일 탭 바 */}
      <div className="flex border-b border-border-light md:hidden shrink-0">
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-2 text-sm font-medium transition-colors
            ${mobileTab === 'chat'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-secondary'}`}
        >
          채팅
        </button>
        <button
          onClick={() => setMobileTab('mindmap')}
          className={`flex-1 py-2 text-sm font-medium transition-colors
            ${mobileTab === 'mindmap'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-secondary'}`}
        >
          마인드맵
        </button>
      </div>

      {/* 좌측: 채팅 — 데스크톱에서는 splitLeftPct로 폭 고정, 모바일에서는 전체 폭
          자체 스크롤 관리하므로 overflow는 하위에 위임 */}
      <div
        className={`h-full w-full shrink-0 ${mobileTab !== 'chat' ? 'hidden md:block' : ''}`}
        style={isDesktop ? { width: `${splitLeftPct}%` } : undefined}
      >
        {leftContent}
      </div>

      {/* 리사이저 — 모바일에서는 숨김 */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="채팅과 마인드맵 크기 조절"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="hidden md:block shrink-0 w-1 bg-border-light hover:bg-border-medium active:bg-primary cursor-col-resize transition-colors"
      />

      {/* 우측: 마인드맵 — 남는 공간을 차지 */}
      <div
        className={`h-full overflow-y-auto w-full flex-1
          ${mobileTab !== 'mindmap' ? 'hidden md:block' : ''}`}
      >
        {rightContent}
      </div>
    </div>
  );
}
