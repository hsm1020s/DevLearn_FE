/**
 * @fileoverview 설정 페이지 — 회원 탈퇴 섹션.
 *
 * "회원 탈퇴" 버튼 → 인라인 확인 팝오버에서 비밀번호를 재입력 → 확정 시 서버 호출.
 * 성공하면 useAuthStore.logout() 으로 로컬 상태/토큰을 비우고 메인으로 이동한다.
 * 브라우저 내장 confirm 은 사용하지 않는다(프로젝트 규칙).
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, AlertTriangle } from 'lucide-react';
import Button from '../common/Button';
import { useToastStore } from '../common/Toast';
import { withdraw } from '../../services/userApi';
import useAuthStore from '../../stores/useAuthStore';

/**
 * 회원 탈퇴 섹션
 */
export default function WithdrawSection() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const logout = useAuthStore((s) => s.logout);

  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const popoverRef = useRef(null);

  // 팝오버 바깥 클릭 시 닫기
  useEffect(() => {
    if (!confirming) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setConfirming(false);
        setPassword('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [confirming]);

  const handleWithdraw = useCallback(async (e) => {
    e.preventDefault();
    if (!password) {
      addToast('비밀번호를 입력해주세요.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await withdraw({ password });
      addToast('회원 탈퇴가 완료되었습니다.', 'success');
      // 로컬 상태/토큰 정리 후 메인으로
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.message || '회원 탈퇴에 실패했습니다.';
      addToast(msg, 'error');
      setSubmitting(false);
    }
  }, [password, addToast, logout, navigate]);

  return (
    <section className="bg-bg-primary border border-border-light rounded-xl p-5">
      <h2 className="text-base font-semibold text-text-primary mb-1 flex items-center gap-2">
        <AlertTriangle size={16} className="text-danger" />
        회원 탈퇴
      </h2>
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        탈퇴 후에는 같은 이메일로 다시 로그인할 수 없습니다.
        대화/문서/마인드맵 등 본인 데이터는 즉시 접근 불가가 되며 복구되지 않습니다.
      </p>

      <div className="relative inline-block">
        <Button
          variant="danger"
          onClick={() => setConfirming((v) => !v)}
          disabled={submitting}
        >
          <Trash2 size={14} />
          회원 탈퇴
        </Button>

        {/* 확인 팝오버 — 버튼 아래에 absolute 로 표시 */}
        {confirming && (
          <div
            ref={popoverRef}
            className="absolute z-50 left-0 top-full mt-2 w-80
                       bg-bg-primary border border-border-light rounded-lg shadow-lg p-4
                       animate-popover-in"
          >
            <p className="text-sm text-text-primary mb-3 font-medium">
              정말 탈퇴하시겠습니까?
            </p>
            <p className="text-xs text-text-secondary mb-3">
              본인 확인을 위해 비밀번호를 입력해주세요.
            </p>
            <form onSubmit={handleWithdraw} className="flex flex-col gap-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                placeholder="현재 비밀번호"
                className="w-full px-3 py-2 text-sm border border-border-light rounded-lg
                           bg-bg-primary text-text-primary placeholder:text-text-tertiary
                           focus:outline-none focus:ring-2 focus:ring-danger/30"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setConfirming(false); setPassword(''); }}
                  disabled={submitting}
                >
                  취소
                </Button>
                <Button type="submit" variant="danger" size="sm" disabled={submitting}>
                  {submitting ? '처리 중...' : '탈퇴 확정'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
