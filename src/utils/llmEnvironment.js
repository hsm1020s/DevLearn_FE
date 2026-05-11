/**
 * @fileoverview 클라우드 배포 환경에서 로컬 LLM(Ollama 기반) 비활성화를 판정하는 헬퍼.
 * `VITE_DISABLE_LOCAL_LLM=true` 가 설정되면 로컬 모델 선택을 막고 클라우드 모델로 폴백한다.
 */

import { LLM_OPTIONS } from './constants';

export const LOCAL_LLM_DISABLED_MESSAGE = '클라우드 환경에서는 로컬 LLM을 지원하지 않습니다.';

/** 현재 빌드/런타임이 로컬 LLM 비활성 모드인지 판정 */
export const isLocalLlmDisabled = () =>
  import.meta.env.VITE_DISABLE_LOCAL_LLM === 'true';

/** 주어진 LLM value가 로컬 모델인지 판정 (LLM_OPTIONS 메타데이터 기준) */
export const isLocalLlmValue = (value) =>
  LLM_OPTIONS.find((o) => o.value === value)?.local === true;

/**
 * 폴백 대상 — 클라우드 모델 중 첫 번째.
 * LLM_OPTIONS는 클라우드 모델이 앞쪽에 정렬되어 있다고 가정한다.
 */
export const firstCloudLlmValue = () =>
  LLM_OPTIONS.find((o) => !o.local)?.value ?? 'gpt-5.4-mini';
