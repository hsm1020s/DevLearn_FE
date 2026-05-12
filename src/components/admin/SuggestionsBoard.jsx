/**
 * @fileoverview 관리자 화면용 기능개선 제안 게시판.
 *
 * 카드 리스트 형태로 제안 목록을 노출한다. 한 카드는 카테고리 칩 / 제목 / 작성자 /
 * 상대 시각 / 본문 미리보기 또는 펼침을 표시한다. 본문은 길 수 있어 기본 3줄 미리보기 + 펼치기 토글.
 */
import { useState, useMemo } from 'react';
import { Lightbulb, Calendar, User, ChevronDown, ChevronUp } from 'lucide-react';

/** 카테고리 value → 한글 라벨 */
const CATEGORY_LABELS = {
  ui: 'UI/UX',
  feature: '새 기능',
  bug: '버그 리포트',
  performance: '성능 개선',
  etc: '기타',
};

/** 카테고리 value → Tailwind 색상 클래스 (라이트 톤 칩) */
const CATEGORY_COLORS = {
  ui: 'bg-blue-100 text-blue-700',
  feature: 'bg-emerald-100 text-emerald-700',
  bug: 'bg-rose-100 text-rose-700',
  performance: 'bg-amber-100 text-amber-700',
  etc: 'bg-slate-100 text-slate-700',
};

/** ISO/Date → "yyyy-MM-dd HH:mm" */
function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 단일 제안 카드.
 * @param {object} props
 * @param {object} props.suggestion - { id, userName, userEmail, title, content, categories, createdAt }
 */
function SuggestionCard({ suggestion }) {
  const [expanded, setExpanded] = useState(false);
  const author = suggestion.userName
    ? `${suggestion.userName}${suggestion.userEmail ? ` <${suggestion.userEmail}>` : ''}`
    : '(삭제된 사용자)';

  return (
    <article className="rounded-xl border border-border-light bg-bg-primary p-4 hover:bg-bg-secondary/40 transition-colors">
      {/* 헤더: 카테고리 칩 */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {(suggestion.categories || []).map((c) => (
          <span
            key={c}
            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[c] || CATEGORY_COLORS.etc}`}
          >
            {CATEGORY_LABELS[c] || c}
          </span>
        ))}
      </div>

      {/* 제목 */}
      <h3 className="text-sm font-semibold text-text-primary mb-1.5 break-words">
        {suggestion.title}
      </h3>

      {/* 메타: 작성자, 시각 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-tertiary mb-2">
        <span className="flex items-center gap-1">
          <User size={12} />
          {author}
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {formatDate(suggestion.createdAt)}
        </span>
      </div>

      {/* 본문 — 기본 3줄 미리보기, 펼치면 전체 */}
      <p
        className={`text-xs text-text-secondary whitespace-pre-wrap break-words ${
          expanded ? '' : 'line-clamp-3'
        }`}
      >
        {suggestion.content}
      </p>

      {/* 펼치기/접기 — 본문 길이로 노출 여부 결정 (대략 120자 이상이면 노출) */}
      {suggestion.content && suggestion.content.length > 120 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? '접기' : '전체 보기'}
        </button>
      )}
    </article>
  );
}

/**
 * 제안 게시판 — 카드 리스트 + 비어있을 때 안내.
 * @param {object} props
 * @param {Array} props.suggestions
 * @param {boolean} [props.loading]
 * @param {string} [props.error]
 */
export default function SuggestionsBoard({ suggestions, loading, error }) {
  const sorted = useMemo(() => suggestions || [], [suggestions]);

  if (loading) {
    return (
      <div className="text-xs text-text-tertiary text-center py-6">제안 목록을 불러오는 중…</div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-danger text-center py-6">
        제안 목록을 불러오지 못했습니다: {error}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-text-tertiary">
        <Lightbulb size={28} className="opacity-40" />
        <p className="text-xs">아직 등록된 제안이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {sorted.map((s) => (
        <SuggestionCard key={s.id} suggestion={s} />
      ))}
    </div>
  );
}
