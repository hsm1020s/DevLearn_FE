/**
 * @fileoverview 학습 모드 활성 과목 상태 접근 헬퍼.
 *
 * 컴포넌트가 `useStudyStore((s) => s.subjects[s.activeSubject].wrongAnswers)`
 * 같은 이중 참조를 반복하지 않도록, 활성 과목 상태에서 필드를 꺼내는 훅을 제공한다.
 *
 * 성능: 각 훅은 Zustand 셀렉터 1회 구독으로 동작. 필요한 필드만 구독해 리렌더
 * 범위를 최소화한다.
 */
import useStudyStore, {
  selectActiveSubjectState,
  selectActiveSubjectMeta,
} from '../stores/useStudyStore';

/** 현재 활성 과목 id (예: 'sqlp'). */
export function useActiveSubjectId() {
  return useStudyStore((s) => s.activeSubject);
}

/** 활성 과목의 버킷 상태(studyDocs, currentQuiz, wrongAnswers, …)를 통째로 반환. */
export function useActiveSubjectState() {
  return useStudyStore(selectActiveSubjectState);
}

/**
 * 활성 과목 버킷에서 특정 필드만 구독한다. 리렌더 범위 최소화에 적합.
 * (예: `useActiveSubjectField((b) => b.currentQuiz)`)
 * @param {(bucket: object) => any} pick - 버킷에서 값을 꺼내는 함수
 * @returns {any} pick 함수의 반환값. Zustand의 참조 동등성 규칙을 그대로 따른다.
 */
export function useActiveSubjectField(pick) {
  return useStudyStore((s) => pick(s.subjects[s.activeSubject]));
}

/** 현재 활성 과목의 카탈로그 메타(label, examPreset, examples 등)를 반환. */
export function useActiveSubjectMeta() {
  return useStudyStore(selectActiveSubjectMeta);
}
