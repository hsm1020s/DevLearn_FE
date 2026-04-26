/**
 * @fileoverview 선명도 잠금 해제용 비밀번호 팝업.
 * 사이드바의 선명도 슬라이더 우측에 떠서, 임시 비밀번호 입력 + 사용 안내를 한 번에 보여준다.
 * 사이드바 컨테이너에 overflow-hidden 이 걸려 있어 absolute 자식은 잘리므로,
 * react-dom createPortal 로 body 직속에 렌더하고 위치는 anchor 의 getBoundingClientRect 로 계산.
 * 한국어 IME 안전: Enter 처리 시 e.nativeEvent.isComposing 체크.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useAppStore from '../../stores/useAppStore';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   anchorRef: React.RefObject<HTMLElement>,
 * }} props
 */
export default function ClarityPasswordPopover({ open, onClose, anchorRef }) {
  const unlock = useAppStore((s) => s.unlockClarityWithPassword);
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const inputRef = useRef(null);
  const rootRef = useRef(null);

  // 열릴 때 입력값/에러 초기화 + 포커스
  useEffect(() => {
    if (open) {
      setPw('');
      setError('');
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  // 위치 계산 — anchor 의 우측 + 8px, top 정렬. 스크롤/리사이즈 시 따라가도록 layoutEffect + 이벤트 갱신.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const a = anchorRef?.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      setPos({ left: Math.round(r.right + 8), top: Math.round(r.top) });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  // 외부 클릭 닫기 (anchor 클릭은 외부로 간주하지 않음 — 사이드바의 자물쇠 버튼이 다시 열기를 시도해도 자연스럽게)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const root = rootRef.current;
      const anchor = anchorRef?.current;
      if (root && !root.contains(e.target) && anchor && !anchor.contains(e.target)) {
        onClose();
      }
    };
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const submit = () => {
    const ok = unlock(pw);
    if (ok) {
      onClose();
    } else {
      setError('비밀번호가 일치하지 않습니다');
      setPw('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-label="선명도 잠금 해제"
      style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 9999 }}
      className="w-72 rounded-md border border-border-light bg-bg-primary shadow-lg p-3
        flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-primary">선명도 잠금</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="text-text-tertiary hover:text-text-primary"
        >
          <X size={14} />
        </button>
      </div>
      {/* TODO: prod 전환 시 안내 텍스트 + 하드코딩 비번 제거 (테스트 단계 한정) */}
      <p className="text-[11px] text-text-secondary leading-snug">
        화면 선명도가 최저로 내려갔습니다.<br />
        다시 선명하게 보려면 임시 비밀번호 <strong className="text-text-primary">12345</strong>를 입력하세요. (테스트용)
      </p>
      <input
        ref={inputRef}
        type="password"
        value={pw}
        onChange={(e) => {
          setPw(e.target.value);
          if (error) setError('');
        }}
        onKeyDown={handleKeyDown}
        placeholder="임시 비밀번호"
        className="w-full px-2 py-1.5 text-sm rounded border border-border-light
          bg-bg-secondary focus:outline-none focus:border-primary"
      />
      {error && <p className="text-[11px] text-danger leading-tight">{error}</p>}
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary rounded"
        >
          취소
        </button>
        <button
          type="button"
          onClick={submit}
          className="px-2 py-1 text-xs bg-primary text-white rounded hover:opacity-90"
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  );
}
