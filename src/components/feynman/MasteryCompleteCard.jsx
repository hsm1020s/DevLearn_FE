/**
 * @fileoverview 파인만 챕터 마스터 완료 시 채팅 영역 위에 떠오르는 축하 카드.
 *
 * BE 가 progress.complete=true 를 보내면 활성화. 사용자는 두 버튼 중 하나를 고른다:
 *  - "다른 챕터 선택" → 챕터 picker 화면으로 전환 (FeynmanChatPane 의 setFeynmanSession reset)
 *  - "이 챕터 계속" → 카드만 닫고 같은 챕터에서 자유 채팅 (진행 바는 그대로 100%)
 */

import { Trophy, X } from 'lucide-react';

/**
 * @param {object} props
 * @param {{total:number}} props.progress
 * @param {() => void} props.onReset    "다른 챕터 선택" 버튼 클릭
 * @param {() => void} props.onDismiss  "이 챕터 계속" 또는 닫기 X 클릭
 */
export default function MasteryCompleteCard({ progress, onReset, onDismiss }) {
  if (!progress?.complete) return null;
  const { total } = progress;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center px-4 pointer-events-none">
      {/* 반투명 배경 — 클릭은 닫기로 흡수 */}
      <div
        className="absolute inset-0 bg-bg-primary/70 backdrop-blur-sm pointer-events-auto"
        onClick={onDismiss}
        aria-hidden
      />
      {/* 카드 */}
      <div
        className="relative pointer-events-auto max-w-sm w-full
          bg-bg-primary border border-border-light rounded-xl shadow-lg
          px-6 py-6 flex flex-col items-center gap-3 text-center"
      >
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 rounded-md hover:bg-bg-secondary text-text-tertiary"
          aria-label="닫기"
        >
          <X size={14} />
        </button>
        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
          <Trophy size={22} className="text-success" />
        </div>
        <h3 className="text-base font-semibold text-text-primary">
          🎉 챕터 마스터 완료!
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          {total}개 핵심 개념(노드) 을 모두 통과했어요.<br />
          다음 챕터로 이동하거나 같은 챕터에서 계속 대화할 수 있어요.
        </p>
        <div className="flex gap-2 w-full mt-2">
          <button
            onClick={onDismiss}
            className="flex-1 px-3 py-2 rounded-md text-xs
              border border-border-light text-text-secondary
              hover:bg-bg-secondary transition-colors"
          >
            이 챕터 계속
          </button>
          <button
            onClick={onReset}
            className="flex-1 px-3 py-2 rounded-md text-xs font-medium
              bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            다른 챕터 선택
          </button>
        </div>
      </div>
    </div>
  );
}
