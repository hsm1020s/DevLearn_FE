# 설계: 2026-05-16-feynman-interview-progress

**생성:** 2026-05-16 15:45
**워크트리:** /Users/moon/DevLearn_FE_wt/2026-05-16-feynman-interview-progress
**브랜치:** task/2026-05-16-feynman-interview-progress

## 목표
파인만 채팅 진행 중 화면에 **"앞으로 면접질문이 몇 개 남았는지"** 를 한눈에 보여준다.
지금은 `MasteryProgressBar` 가 "M/N 노드 통과 · 현재: X · 퍼센트%" 만 노출해서 사용자가
직접 빼야 잔여 개수를 알 수 있다. 잔여 개수(=total − mastered) 를 헤더 진행 바에 명시한다.

## 변경 범위
- `src/components/feynman/MasteryProgressBar.jsx`
  - 진행 중 분기에 "남은 질문 N개" 텍스트 추가
  - 완료(complete=true) 분기는 변경 없음 (이미 트로피 카피로 충분)
  - `currentNodeLabel` 가 있으면 그 옆에, 없으면 단독으로 표시

영향 없음:
- 데이터 모델/진행도 페이로드 (BE 변경 없음 — 기존 `total`/`mastered` 만 사용)
- `useFeynmanProgress` 훅 (반환 shape 그대로)
- 폴백 챕터(total=0) 경로 (계속 비표시)

## 구현 계획
1. `MasteryProgressBar.jsx` 의 진행 중 분기 JSX 에 잔여 개수 span 추가
   - `const remaining = Math.max(0, total - mastered)`
   - "남은 질문 N개" — `text-text-tertiary` 톤, 현재 노드 라벨과 시각적으로 구분
2. 좁은 폭에서도 깨지지 않게 `whitespace-nowrap` / 라벨에만 `truncate` 유지
3. 이미 `mastered/total` 가 보이므로 중복을 피하되 "남은" 표현은 별도로 더 직관적이라 유지

## 단위 테스트 계획
- 진행 바 상태별 확인:
  - mastered=0, total=8 → "남은 질문 8개"
  - mastered=3, total=8 → "남은 질문 5개"
  - mastered=8, total=8 / complete=true → "🎉 챕터 마스터" 분기 유지 (잔여 표기 없음)
- 폴백 챕터 (progress=null) → 진행 바 자체 비표시 유지
- 좁은 패널 폭(분할 워크스페이스 우측)에서 라벨 잘림/줄바꿈 동작

## 회귀 테스트 계획
- 일반 채팅(왼쪽 split)이 파인만 헤더 변경에 영향 없는지
- 마인드맵 패널 / 문서 패널 정상
- 챕터 종료(✕) → 시작 전 화면으로 복귀 후 다시 시작 시 진행 바 재표시
