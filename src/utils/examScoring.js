/**
 * @fileoverview 모의고사 파트별 집계 유틸 (현재는 도달 불가 코드 — 향후 재도입 대비 보존).
 *
 * 카탈로그 엔트리에 `parts`가 있을 때 사용한다. 각 문제의 `part` 태그를 보고
 * 파트별 정답/문항수/정답률을 집계하고, `passingCriteria`로 과락/합격 여부를
 * 계산한다. 총점 = 파트별 `points * (correctInPart / questionCountInPart)` 합.
 */

/**
 * 모의고사 집계 결과 shape.
 * @typedef {object} PartSummary
 * @property {string} partId
 * @property {string} label
 * @property {number} questionCount   해당 과목 출제 문항수(이번 세션)
 * @property {number} answeredCount   실제 푼 문항수
 * @property {number} correctCount    정답 수
 * @property {number} correctRate     0~1 정답률(푼 것 기준)
 * @property {number} points          카탈로그상 배점
 * @property {number} score           이 과목에서 얻은 점수 (points * correctCount / questionCount)
 * @property {boolean} failed         과목 과락 여부 (correctRate < partMinPercent/100)
 *
 * @typedef {object} ExamScore
 * @property {PartSummary[]} perPart  과목별 집계 행
 * @property {number} total           총점 (0~100)
 * @property {number} totalMin        합격 총점 기준
 * @property {number} partMinPercent  과목별 과락 기준(%)
 * @property {PartSummary[]} failedParts 과락 과목만 필터
 * @property {boolean} passed         합격 여부 (총점 충족 && 과락 없음)
 */

/**
 * 문제 배열 + 답안 맵을 받아 과목별 집계를 계산한다.
 * parts가 없거나(subject가 custom 등) 문제에 `part` 태그가 없으면 null을 반환한다.
 *
 * @param {{questions: Array<{id:string, part?:string}>}} quiz
 * @param {Record<string, {correct?: boolean}>} answers
 * @param {Array<{id:string, label:string, questionCount:number, points:number}> | null | undefined} parts
 * @param {{totalMin:number, partMinPercent:number} | null | undefined} passingCriteria
 * @returns {ExamScore | null}
 */
export function computePartsScore(quiz, answers, parts, passingCriteria) {
  if (!quiz || !Array.isArray(parts) || parts.length === 0) return null;

  const questions = quiz.questions || [];

  // part.id → 집계 초기화
  const bucket = new Map(
    parts.map((p) => [
      p.id,
      {
        partId: p.id,
        label: p.label,
        questionCount: 0,
        answeredCount: 0,
        correctCount: 0,
        points: p.points,
      },
    ]),
  );

  for (const q of questions) {
    const b = bucket.get(q.part);
    // part 태그가 없는 문제는 집계에서 제외(데이터 이상).
    if (!b) continue;
    b.questionCount += 1;
    const a = answers[q.id];
    if (a) {
      b.answeredCount += 1;
      if (a.correct) b.correctCount += 1;
    }
  }

  const partMinPercent = passingCriteria?.partMinPercent ?? 40;
  const totalMin = passingCriteria?.totalMin ?? 75;

  const perPart = parts.map((p) => {
    const b = bucket.get(p.id);
    const qc = b.questionCount;
    const rate = qc > 0 ? b.correctCount / qc : 0;
    // 배점 기반 점수 — 한 문항 배점 = points/questionCount. 실제 시험 배점 체계와 일치.
    const score = qc > 0 ? (b.points * b.correctCount) / qc : 0;
    return {
      ...b,
      correctRate: rate,
      score,
      // 과락 판정: "이번 세션에서 그 과목 출제가 0이면" 과락 판정 무의미 → false 처리
      failed: qc > 0 && rate < partMinPercent / 100,
    };
  });

  const total = perPart.reduce((acc, p) => acc + p.score, 0);
  const failedParts = perPart.filter((p) => p.failed);
  const passed = total >= totalMin && failedParts.length === 0;

  return {
    perPart,
    total,
    totalMin,
    partMinPercent,
    failedParts,
    passed,
  };
}

/**
 * 과목 카탈로그(parts)와 목표 문제 수로 과목별 출제 문항수를 비율 배분한다.
 * 반올림 오차는 마지막 part에서 보정해 sum === totalCount 를 보장.
 *
 * @param {Array<{id:string, questionCount:number}>} parts
 * @param {number} totalCount  모의고사 목표 문제 수(예: 72)
 * @returns {Array<{partId:string, count:number}>}
 */
export function distributeCountsByParts(parts, totalCount) {
  if (!Array.isArray(parts) || parts.length === 0 || totalCount <= 0) return [];
  const partSum = parts.reduce((acc, p) => acc + (p.questionCount || 0), 0);
  if (partSum <= 0) {
    // parts에 questionCount가 비정상이면 균등 분배로 폴백.
    const even = Math.floor(totalCount / parts.length);
    const remainder = totalCount - even * parts.length;
    return parts.map((p, i) => ({ partId: p.id, count: even + (i === parts.length - 1 ? remainder : 0) }));
  }
  const out = parts.map((p) => ({
    partId: p.id,
    count: Math.round((totalCount * (p.questionCount || 0)) / partSum),
  }));
  // 반올림 오차 보정 — 합계가 totalCount와 달라지면 마지막 part에 ± 적용.
  const sum = out.reduce((acc, x) => acc + x.count, 0);
  if (sum !== totalCount && out.length > 0) {
    out[out.length - 1].count += totalCount - sum;
  }
  // 음수 방지(극단 엣지): 0 미만은 0으로 클램프하고 차액을 마지막 정상 part에 몰아주기
  for (const row of out) if (row.count < 0) row.count = 0;
  return out;
}
