/**
 * @fileoverview 공통 모달 다이얼로그 컴포넌트
 * 오버레이 배경 클릭 또는 닫기 버튼으로 닫을 수 있다.
 * anchorRef를 전달하면 해당 요소 근처에 팝오버 형태로 표시된다.
 */
import { useState, useLayoutEffect, useCallback } from 'react';
import { X } from 'lucide-react';

/**
 * 앵커 요소의 위치를 기반으로 모달 표시 좌표를 계산한다.
 * 버튼 오른쪽에 배치하되, 화면 밖으로 넘치면 위쪽으로 올린다.
 * @param {HTMLElement} anchorEl - 기준이 되는 DOM 요소
 * @param {number} [offsetVh=0] - 계산된 top을 뷰포트 높이의 비율만큼 추가로 위로 당긴다 (예: 0.15 → 15%)
 * @returns {{ top: number, left: number }}
 */
function calcPosition(anchorEl, offsetVh = 0) {
  const rect = anchorEl.getBoundingClientRect();
  const GAP = 8; // 앵커와 모달 사이 간격(px)
  const MODAL_MAX_W = 420; // 모달 최대 너비 추정값(px)
  const MODAL_MAX_H = 480; // 모달 최대 높이 추정값(px)

  // 기본: 앵커 오른쪽, 수직 중앙 정렬
  let left = rect.right + GAP;
  let top = rect.top;

  // 오른쪽 공간 부족 시 앵커 위에 표시
  if (left + MODAL_MAX_W > window.innerWidth) {
    left = rect.left;
    top = rect.top - MODAL_MAX_H - GAP;
  }

  // 아래로 넘치면 먼저 위로 스냅 (그대로 두면 모달이 뷰포트 바닥을 벗어남)
  if (top + MODAL_MAX_H > window.innerHeight - 8) {
    top = window.innerHeight - MODAL_MAX_H - 8;
  }

  // 클램프 이후에 offsetVh 를 적용해야 "실제로 더 위로" 이동한다.
  // (offsetVh 를 먼저 적용하면 위 overflow 보정에서 다시 스냅되어 효과가 사라짐)
  top -= window.innerHeight * offsetVh;

  // 최종적으로 상단 경계만 보호
  if (top < 8) top = 8;

  return { top, left };
}

/**
 * 모달 다이얼로그
 * @param {boolean} isOpen - 모달 표시 여부
 * @param {Function} onClose - 모달 닫기 콜백
 * @param {string} title - 모달 헤더 제목
 * @param {ReactNode} children - 모달 본문 콘텐츠
 * @param {React.RefObject} [anchorRef] - 팝오버 기준 요소 ref (없으면 화면 중앙)
 * @param {number} [offsetVh=0] - 앵커 모드에서 뷰포트 높이의 offsetVh 비율만큼 위로 당김 (0.15 = 15%)
 */
export default function Modal({ isOpen, onClose, title, children, className = '', anchorRef, offsetVh = 0 }) {
  const [pos, setPos] = useState(null);

  // 앵커가 있으면 위치 계산, 리사이즈 시 재계산
  useLayoutEffect(() => {
    if (!isOpen || !anchorRef?.current) {
      setPos(null);
      return;
    }
    const update = () => setPos(calcPosition(anchorRef.current, offsetVh));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isOpen, anchorRef, offsetVh]);

  if (!isOpen) return null;

  // 앵커 기반 팝오버 모드
  const isAnchored = anchorRef?.current && pos;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 배경 */}
      <div
        className={`absolute inset-0 ${isAnchored ? 'bg-black/20' : 'bg-black/40'}`}
        onClick={onClose}
        aria-label="모달 닫기"
      />
      {/* 모달 본체 */}
      <div
        className={`
          ${isAnchored ? 'fixed' : 'relative'}
          bg-bg-primary rounded-lg border border-border-light
          ${isAnchored ? 'w-[380px]' : 'w-full max-w-lg mx-4'}
          max-h-[80vh] flex flex-col shadow-xl
          ${isAnchored ? 'animate-popover-in' : ''}
          ${className}
        `}
        style={isAnchored ? { top: pos.top, left: pos.left } : undefined}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-secondary text-text-secondary"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
