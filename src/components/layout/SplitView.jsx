/**
 * @fileoverview 좌우 분할 뷰 컴포넌트
 * 데스크톱: 우측 패널 표시 여부에 따라 1:1 분할 또는 전체 너비로 전환.
 * 모바일(768px 미만): 마인드맵 ON 시 탭 전환으로 채팅/마인드맵 교차 표시.
 */
import { useState } from 'react';

/**
 * 좌우 분할 레이아웃 (모바일에서는 탭 전환)
 * @param {ReactNode} leftContent - 좌측 패널 콘텐츠 (메인 모드)
 * @param {ReactNode} rightContent - 우측 패널 콘텐츠 (마인드맵 등)
 * @param {boolean} isRightVisible - 우측 패널 표시 여부
 */
export default function SplitView({ leftContent, rightContent, isRightVisible }) {
  const [mobileTab, setMobileTab] = useState('chat');

  // 마인드맵 꺼진 상태 — 전체 너비로 좌측만 표시
  if (!isRightVisible) {
    return (
      <div className="flex h-full">
        <div className="h-full w-full overflow-y-auto">
          {leftContent}
        </div>
      </div>
    );
  }

  // 마인드맵 켜진 상태
  return (
    <div className="flex flex-col md:flex-row h-full">
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

      {/* 좌측: 채팅 */}
      <div className={`h-full overflow-y-auto w-full md:w-1/2 md:border-r md:border-border-light
        ${mobileTab !== 'chat' ? 'hidden md:block' : ''}`}
      >
        {leftContent}
      </div>

      {/* 우측: 마인드맵 */}
      <div className={`h-full overflow-y-auto w-full md:w-1/2
        ${mobileTab !== 'mindmap' ? 'hidden md:block' : ''}`}
      >
        {rightContent}
      </div>
    </div>
  );
}
