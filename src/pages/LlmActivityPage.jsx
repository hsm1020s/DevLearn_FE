/**
 * @fileoverview /llm-activity — LlmActivityPanel 의 단독 페이지 래퍼.
 *
 * 페이지로 들어왔을 때는 헤더만 얹고 같은 패널을 보여준다. 평소엔 우하단 FAB 드로어로 열고,
 * 별도 모니터 모니터(?) 가 필요하거나 새 탭에 띄우고 싶을 때 이 라우트를 쓴다.
 */
import LlmActivityPanel from '../components/monitor/LlmActivityPanel';

export default function LlmActivityPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <header className="px-6 py-4 border-b border-border-light bg-bg-secondary/60">
        <h1 className="text-lg font-semibold">로컬 LLM 활동 모니터</h1>
        <p className="text-xs text-text-secondary mt-1">
          백엔드의 모든 로컬 LLM 호출(채팅·검증·임베딩·마인드맵 합성·파이프라인)을 실시간으로 표시합니다.
        </p>
      </header>
      <main className="px-6 py-5">
        <LlmActivityPanel />
      </main>
    </div>
  );
}
