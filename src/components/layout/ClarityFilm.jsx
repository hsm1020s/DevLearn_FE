/**
 * @fileoverview 화면 선명도 필름 — 사생활 보호필름 효과를 내는 전역 오버레이.
 * uiClarity 가 1.0 일 때는 완전히 투명, 낮아질수록 backdrop blur + 크림톤 알파가 강해져 화면이 점점 안 보이게 된다.
 * pointer-events: none 으로 클릭은 통과시키고, 슬라이더(z-index 더 높음)는 이 필름 위에 그려져 항상 또렷하게 조작 가능.
 */
import useAppStore from '../../stores/useAppStore';

export default function ClarityFilm() {
  const uiClarity = useAppStore((s) => s.uiClarity);

  // clarity = 1.0 → 효과 없음, 0.4 → 최대 흐림 + 페이드.
  // t 는 효과 강도(0 ~ 0.6).
  const t = Math.max(0, 1 - uiClarity);
  const blurPx = (t * 20).toFixed(1); // 최대 12px (clarity 0.4 일 때)
  const alpha = (t * 0.85).toFixed(2); // 최대 0.51 (clarity 0.4 일 때)

  // 완전 투명일 때는 DOM 만 남기고 stacking 영향 없도록 visibility 처리하지 않고,
  // backdrop-filter 비용 자체를 피하려고 t === 0 일 때 렌더 생략한다.
  if (t === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100]"
      style={{
        backgroundColor: `rgba(250, 249, 245, ${alpha})`,
        backdropFilter: `blur(${blurPx}px)`,
        WebkitBackdropFilter: `blur(${blurPx}px)`,
      }}
    />
  );
}
