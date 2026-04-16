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
