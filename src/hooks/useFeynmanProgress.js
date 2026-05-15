/**
 * @fileoverview 파인만 채팅 메시지 배열에서 가장 최근 assistant 응답의
 * 챕터 마스터리 진행도(meta.progress) 를 뽑아내는 헬퍼.
 *
 * BE 가 SSE done 페이로드에 progressJson 을 동봉하기 시작한 2단계 이후,
 * FE 는 useStreamingChat 의 onDone 콜백에서 이를 메시지 meta 에 보관한다.
 * 3단계 UI 는 이 헬퍼로 최근 진행도를 읽어 헤더 진행 바·완료 카드를 그린다.
 */

/**
 * messages 배열에서 마지막 assistant 메시지의 meta.progress 를 반환.
 *
 * - 진행도가 없거나 폴백 챕터(total=0) 이면 null 을 반환해 호출처가 UI 를 숨길 수 있게 한다.
 *   (마인드맵 없는 챕터는 마스터리 게이트 미적용 → 진행 바 표시 자체가 의미 없음)
 *
 * @param {Array<{role:string, meta?:{progress?:object}}>} messages
 * @returns {{total:number, mastered:number, complete:boolean, currentNodeId:?string, currentNodeLabel:?string} | null}
 */
export default function useFeynmanProgress(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role !== 'assistant') continue;
    const p = m?.meta?.progress;
    if (!p) return null;
    if (!p.total || p.total <= 0) return null; // 폴백 챕터 — 진행 바 표시 안 함
    return {
      total: p.total,
      mastered: p.mastered ?? 0,
      complete: !!p.complete,
      currentNodeId: p.currentNodeId ?? null,
      currentNodeLabel: p.currentNodeLabel ?? null,
    };
  }
  return null;
}
