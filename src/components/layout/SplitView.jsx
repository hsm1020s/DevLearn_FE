/**
 * @fileoverview 좌우 분할 뷰 컴포넌트
 * 우측 패널 표시 여부에 따라 1:1 분할 또는 전체 너비로 전환한다.
 */

/**
 * 좌우 분할 레이아웃
 * @param {ReactNode} leftContent - 좌측 패널 콘텐츠 (메인 모드)
 * @param {ReactNode} rightContent - 우측 패널 콘텐츠 (마인드맵 등)
 * @param {boolean} isRightVisible - 우측 패널 표시 여부
 */
export default function SplitView({ leftContent, rightContent, isRightVisible }) {
  return (
    <div className="flex h-full">
      <div
        className={`overflow-y-auto ${
          isRightVisible ? 'w-1/2 border-r border-border-light' : 'w-full'
        }`}
      >
        {leftContent}
      </div>

      {isRightVisible && (
        <div className="w-1/2 overflow-y-auto">
          {rightContent}
        </div>
      )}
    </div>
  );
}
