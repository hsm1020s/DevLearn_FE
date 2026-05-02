/**
 * @fileoverview 강의 대본(Phase 1) API 서비스.
 * 백엔드 /api/lectures 엔드포인트와 통신한다.
 */
import api, { refreshAccessToken } from './api';

/**
 * 챕터 타이틀을 디스크 안전 이름으로 변환한다 (BE의 safeChapter 와 같은 규칙).
 * 일괄 생성 시 status 응답의 폴더명과 비교용.
 */
export function safeChapterName(chapter) {
  if (!chapter) return 'chapter';
  const safe = chapter.replace(/[^\p{L}\p{N} _-]/gu, '').trim();
  return safe || 'chapter';
}

/**
 * 문서 단위 강의 대본 생성 현황 조회 — 이미 생성된 챕터의 safe-name 폴더 목록.
 * @param {string} docId
 * @returns {Promise<Set<string>>} safe-name Set
 */
export async function fetchLectureStatus(docId) {
  const { data } = await api.get(`/lectures/${encodeURIComponent(docId)}/status`);
  const generated = data?.data?.generated || [];
  return new Set(generated);
}

/**
 * 저장된 강의 대본 markdown 을 조회한다. 없으면 null.
 * @param {string} docId 문서 UUID
 * @param {string} chapter 챕터명
 * @returns {Promise<string|null>}
 */
export async function fetchLectureScript(docId, chapter) {
  try {
    const { data } = await api.get(
      `/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/script`,
      { responseType: 'text', transformResponse: (v) => v },
    );
    return data || '';
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

// ──────────────────────────────────────────────
// Phase 2 — 강의 오디오(TTS)
// ──────────────────────────────────────────────

/** 문서별 오디오 생성 현황 — safe-name Set. */
export async function fetchLectureAudioStatus(docId) {
  const { data } = await api.get(`/lectures/${encodeURIComponent(docId)}/audio/status`);
  const generated = data?.data?.generated || [];
  return new Set(generated);
}

/**
 * 챕터 mp3 의 직접 재생 가능 URL — `<audio src=...>` 에 바로 꽂아 쓸 수 있다.
 * 미디어 태그는 커스텀 Authorization 헤더를 보낼 수 없으므로 ?access_token=... 쿼리 파라미터로 인증.
 * BE JwtAuthFilter 가 헤더 → 쿼리 순으로 토큰을 추출한다.
 *
 * 토큰이 만료되면 401 응답 → onError 로 표시. UX 상 드물게 발생하면 페이지 새로고침으로 해결.
 * (refresh token 자동 재시도까지는 v1 스코프 외)
 */
export function lectureAudioUrl(docId, chapter) {
  const token = localStorage.getItem('accessToken') || '';
  return `${api.defaults.baseURL}/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/audio`
    + `?access_token=${encodeURIComponent(token)}`;
}

/**
 * 오디오 파일 존재 여부만 확인. Spring MVC 가 HEAD 를 항상 자동 라우팅하지는 않으므로
 * GET + Range: bytes=0-0 으로 1바이트만 받아 200/206 이면 true.
 */
export async function lectureAudioExists(docId, chapter) {
  try {
    const res = await fetch(lectureAudioUrl(docId, chapter), {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
    });
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

/** 오디오 일괄 배치 시작 (kind=audio). */
export async function startLectureAudioBatch(docId, scope, parent, targetCount) {
  const { data } = await api.post(`/lectures/${encodeURIComponent(docId)}/audio/batches`,
    { scope, parent, targetCount });
  return data?.data?.batchId;
}

/** 오디오 일괄 배치 종료. */
export async function finishLectureAudioBatch(batchId, payload) {
  const { data } = await api.post(`/lectures/audio/batches/${encodeURIComponent(batchId)}/finish`,
    payload);
  return data?.data;
}

/**
 * 챕터 오디오를 SSE 로 생성한다.
 * @param {Object} params { docId, chapter, voice?, batchId?, onDone({audioUrl, durationSec, costUsd}), signal? }
 */
export async function streamLectureAudio(params) {
  const { docId, chapter, voice, batchId, onDone, signal } = params;
  const url = `${api.defaults.baseURL}/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/audio/stream`;
  const body = JSON.stringify({ voice, batchId });

  const doFetch = (token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { method: 'POST', headers, body, signal });
  };

  let accessToken = localStorage.getItem('accessToken');
  let response = await doFetch(accessToken);
  if (response.status === 401) {
    try {
      accessToken = await refreshAccessToken();
    } catch {
      const err = new Error('로그인이 필요합니다');
      err.userMessage = '로그인이 필요합니다';
      err.status = 401;
      throw err;
    }
    response = await doFetch(accessToken);
  }
  if (!response.ok) {
    let msg = `요청 실패 (${response.status})`;
    try { const b = await response.json(); if (b?.message) msg = b.message; } catch { /* ignore */ }
    const err = new Error(msg);
    err.userMessage = msg;
    err.status = response.status;
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop();
      for (const line of parts) {
        if (!line.startsWith('data:')) continue;
        try {
          const parsed = JSON.parse(line.slice(5));
          if (parsed.type === 'done') {
            // BE 가 content 에 JSON 문자열을 담아 보냄: {audioUrl, durationSec, costUsd}
            let payload = {};
            try { payload = JSON.parse(parsed.content || '{}'); } catch { /* ignore */ }
            onDone?.(payload);
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ──────────────────────────────────────────────
// Phase 3 — 강의 슬라이드 (PNG 시퀀스 + 자동 sync)
// ──────────────────────────────────────────────

/** 챕터의 slides.json 조회. 없으면 null. */
export async function fetchLectureSlides(docId, chapter) {
  try {
    const { data } = await api.get(
      `/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/slides`,
    );
    return data;
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

/** slide_timings.json 조회. 없으면 null. */
export async function fetchLectureSlideTimings(docId, chapter) {
  try {
    const { data } = await api.get(
      `/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/slide-timings`,
    );
    return data;
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

/** N번째 슬라이드 PNG 의 직접 URL — <img src=...> 에 바로 사용. ?access_token= 쿼리로 인증. */
export function lectureSlideImageUrl(docId, chapter, index) {
  const token = localStorage.getItem('accessToken') || '';
  return `${api.defaults.baseURL}/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/slides/${index}.png`
    + `?access_token=${encodeURIComponent(token)}`;
}

/** 문서별 슬라이드 생성 챕터 safe-name Set. */
export async function fetchLectureSlidesStatus(docId) {
  const { data } = await api.get(`/lectures/${encodeURIComponent(docId)}/slides/status`);
  return new Set(data?.data?.generated || []);
}

/** 슬라이드 일괄 배치 시작 (kind=slides). */
export async function startLectureSlidesBatch(docId, scope, parent, targetCount) {
  const { data } = await api.post(`/lectures/${encodeURIComponent(docId)}/slides/batches`,
    { scope, parent, targetCount });
  return data?.data?.batchId;
}

/** 슬라이드 일괄 배치 종료. */
export async function finishLectureSlidesBatch(batchId, payload) {
  const { data } = await api.post(`/lectures/slides/batches/${encodeURIComponent(batchId)}/finish`,
    payload);
  return data?.data;
}

/**
 * 슬라이드 SSE 생성. done payload: {slideCount, costUsd, synthMs, captureMs}
 */
export async function streamLectureSlides(params) {
  const { docId, chapter, batchId, onDone, signal } = params;
  const url = `${api.defaults.baseURL}/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/slides/stream`;
  const body = JSON.stringify({ batchId });

  const doFetch = (token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { method: 'POST', headers, body, signal });
  };

  let accessToken = localStorage.getItem('accessToken');
  let response = await doFetch(accessToken);
  if (response.status === 401) {
    try { accessToken = await refreshAccessToken(); }
    catch { const err = new Error('로그인이 필요합니다'); err.userMessage = '로그인이 필요합니다'; err.status = 401; throw err; }
    response = await doFetch(accessToken);
  }
  if (!response.ok) {
    let msg = `요청 실패 (${response.status})`;
    try { const b = await response.json(); if (b?.message) msg = b.message; } catch { /* ignore */ }
    const err = new Error(msg); err.userMessage = msg; err.status = response.status; throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop();
      for (const line of parts) {
        if (!line.startsWith('data:')) continue;
        try {
          const parsed = JSON.parse(line.slice(5));
          if (parsed.type === 'done') {
            let payload = {};
            try { payload = JSON.parse(parsed.content || '{}'); } catch { /* ignore */ }
            onDone?.(payload);
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ──────────────────────────────────────────────
// Phase 4 — 강의 영상 (mp4 + WebVTT 자막/챕터)
// ──────────────────────────────────────────────

/** 영상 메타 조회 — `{exists, fileSizeBytes?, videoUrl?}`. */
export async function fetchLectureVideoMeta(docId, chapter) {
  const { data } = await api.get(
    `/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/video/meta`,
  );
  return data?.data;
}

/** 문서별 영상 생성 챕터 safe-name Set. */
export async function fetchLectureVideoStatus(docId) {
  const { data } = await api.get(`/lectures/${encodeURIComponent(docId)}/video/status`);
  return new Set(data?.data?.generated || []);
}

/** mp4 의 직접 URL — <video src=...>. ?access_token= 쿼리로 인증. */
export function lectureVideoUrl(docId, chapter) {
  const token = localStorage.getItem('accessToken') || '';
  return `${api.defaults.baseURL}/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/video`
    + `?access_token=${encodeURIComponent(token)}`;
}

/** captions.vtt 직접 URL — <track src=...>. */
export function lectureVideoCaptionsUrl(docId, chapter) {
  const token = localStorage.getItem('accessToken') || '';
  return `${api.defaults.baseURL}/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/video/captions.vtt`
    + `?access_token=${encodeURIComponent(token)}`;
}

/** chapters.vtt 직접 URL. (텍스트 fetch 또는 <track kind=chapters>) */
export function lectureVideoChaptersUrl(docId, chapter) {
  const token = localStorage.getItem('accessToken') || '';
  return `${api.defaults.baseURL}/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/video/chapters.vtt`
    + `?access_token=${encodeURIComponent(token)}`;
}

/** chapters.vtt 텍스트를 fetch — UI 챕터 점프 메뉴용. */
export async function fetchLectureVideoChapters(docId, chapter) {
  try {
    const res = await fetch(lectureVideoChaptersUrl(docId, chapter));
    if (!res.ok) return [];
    const text = await res.text();
    return parseVttCues(text);
  } catch { return []; }
}

/** 매우 단순한 WebVTT 파서 — `[{startSec, endSec, text}]`. */
function parseVttCues(vtt) {
  const lines = vtt.split('\n');
  const cues = [];
  let i = 0;
  while (i < lines.length) {
    const m = /^(\d{2}):(\d{2}):(\d{2}\.\d+)\s+-->\s+(\d{2}):(\d{2}):(\d{2}\.\d+)/.exec(lines[i]);
    if (m) {
      const startSec = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
      const endSec   = (+m[4]) * 3600 + (+m[5]) * 60 + parseFloat(m[6]);
      let text = '';
      i++;
      while (i < lines.length && lines[i].trim() !== '') {
        text += (text ? ' ' : '') + lines[i].trim();
        i++;
      }
      cues.push({ startSec, endSec, text });
    }
    i++;
  }
  return cues;
}

/** 영상 일괄 배치 시작 (kind=video). */
export async function startLectureVideoBatch(docId, scope, parent, targetCount) {
  const { data } = await api.post(`/lectures/${encodeURIComponent(docId)}/video/batches`,
    { scope, parent, targetCount });
  return data?.data?.batchId;
}

/** 영상 일괄 배치 종료. */
export async function finishLectureVideoBatch(batchId, payload) {
  const { data } = await api.post(`/lectures/video/batches/${encodeURIComponent(batchId)}/finish`,
    payload);
  return data?.data;
}

/** 영상 SSE 생성. done payload: {videoDurSec, fileSizeBytes, audioDurSec, slideCount, costUsd} */
export async function streamLectureVideo(params) {
  const { docId, chapter, batchId, onDone, signal } = params;
  const url = `${api.defaults.baseURL}/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/video/stream`;
  const body = JSON.stringify({ batchId });

  const doFetch = (token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { method: 'POST', headers, body, signal });
  };

  let accessToken = localStorage.getItem('accessToken');
  let response = await doFetch(accessToken);
  if (response.status === 401) {
    try { accessToken = await refreshAccessToken(); }
    catch { const err = new Error('로그인이 필요합니다'); err.userMessage = '로그인이 필요합니다'; err.status = 401; throw err; }
    response = await doFetch(accessToken);
  }
  if (!response.ok) {
    let msg = `요청 실패 (${response.status})`;
    try { const b = await response.json(); if (b?.message) msg = b.message; } catch { /* ignore */ }
    const err = new Error(msg); err.userMessage = msg; err.status = response.status; throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop();
      for (const line of parts) {
        if (!line.startsWith('data:')) continue;
        try {
          const parsed = JSON.parse(line.slice(5));
          if (parsed.type === 'done') {
            let payload = {};
            try { payload = JSON.parse(parsed.content || '{}'); } catch { /* ignore */ }
            onDone?.(payload);
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ──────────────────────────────────────────────
// Phase 1 — 강의 대본 (스크립트)
// ──────────────────────────────────────────────

/**
 * 일괄 배치 시작 — 서버에 batch 행을 INSERT(running) 하고 batchId 반환.
 * 이후 streamLectureScript 호출에 batchId 를 함께 넘기면 각 run 이 batch 와 묶임.
 */
export async function startLectureBatch(docId, scope, parent, targetCount) {
  const { data } = await api.post(`/lectures/${encodeURIComponent(docId)}/batches`,
    { scope, parent, targetCount });
  return data?.data?.batchId;
}

/** 일괄 배치 종료 — 카운터 + status(completed|aborted) 갱신. */
export async function finishLectureBatch(batchId, payload) {
  const { data } = await api.post(`/lectures/batches/${encodeURIComponent(batchId)}/finish`,
    payload);
  return data?.data;
}

/**
 * 강의 대본을 SSE 로 스트림 생성한다. 종료 시 서버가 디스크에 저장한다.
 *
 * @param {Object} params
 * @param {string} params.docId
 * @param {string} params.chapter
 * @param {string} [params.llm]
 * @param {string} [params.batchId] — 있으면 lecture_script_runs.batch_id 로 묶임
 * @param {Function} params.onToken (accumulated)
 * @param {Function} params.onDone ({content})
 * @param {AbortSignal} [params.signal]
 */
export async function streamLectureScript(params) {
  const { docId, chapter, llm, batchId, onToken, onDone, signal } = params;
  const url = `${api.defaults.baseURL}/lectures/${encodeURIComponent(docId)}/${encodeURIComponent(chapter)}/script/stream`;
  const body = JSON.stringify({ llm, batchId });

  const doFetch = (token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { method: 'POST', headers, body, signal });
  };

  let accessToken = localStorage.getItem('accessToken');
  let response = await doFetch(accessToken);

  if (response.status === 401) {
    try {
      accessToken = await refreshAccessToken();
    } catch {
      const err = new Error('로그인이 필요합니다');
      err.userMessage = '로그인이 필요합니다';
      err.status = 401;
      throw err;
    }
    response = await doFetch(accessToken);
  }

  if (!response.ok) {
    let msg = `요청 실패 (${response.status})`;
    try {
      const b = await response.json();
      if (b?.message) msg = b.message;
    } catch { /* ignore */ }
    const err = new Error(msg);
    err.userMessage = msg;
    err.status = response.status;
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop();
      for (const line of parts) {
        if (!line.startsWith('data:')) continue;
        try {
          const parsed = JSON.parse(line.slice(5));
          if (parsed.type === 'token') {
            accumulated = parsed.content;
            onToken?.(accumulated);
          } else if (parsed.type === 'done') {
            onDone?.({ content: parsed.content || accumulated });
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
