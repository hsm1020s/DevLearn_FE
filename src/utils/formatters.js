/**
 * @fileoverview 날짜, 파일 크기, 텍스트 등의 표시 형식을 변환하는 포맷터 함수 모음
 */

/** 날짜를 상대 시간(예: '3분 전') 또는 한국어 날짜 문자열로 변환한다. */
export function formatDate(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** 바이트 수를 사람이 읽기 쉬운 단위(B, KB, MB)로 변환한다. */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** 텍스트가 최대 길이를 초과하면 말줄임표(...)로 잘라낸다. */
export function truncateText(text, maxLength = 30) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
