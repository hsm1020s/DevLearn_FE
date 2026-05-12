/**
 * @fileoverview 회원가입 모달 — 이메일/비밀번호/이름 입력 후 회원가입 API 호출.
 * 가입 성공 시 자동 로그인 후 모달을 닫는다.
 */
import { useState, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
import useAuthStore from '../../stores/useAuthStore';
import { useToastStore } from './Toast';

/**
 * 회원가입 모달 컴포넌트
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {Function} onClose - 모달 닫기 핸들러
 * @param {Function} onSwitchToLogin - 로그인 모달로 전환 핸들러
 * @param {React.RefObject} [anchorRef] - 팝오버 앵커 위치 참조
 */
export default function RegisterModal({ isOpen, onClose, onSwitchToLogin, anchorRef }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const login = useAuthStore((s) => s.login);
  const addToast = useToastStore((s) => s.addToast);

  const resetForm = useCallback(() => {
    setEmail('');
    setPassword('');
    setPasswordConfirm('');
    setName('');
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!email.trim() || !password || !name.trim()) {
        addToast('모든 항목을 입력해주세요.', 'error');
        return;
      }
      if (password !== passwordConfirm) {
        addToast('비밀번호가 일치하지 않습니다.', 'error');
        return;
      }

      setLoading(true);
      const result = await register(email.trim(), password, name.trim());
      if (result.success) {
        // 가입 성공 → 자동 로그인
        const loginResult = await login(email.trim(), password);
        if (loginResult.success) {
          addToast('회원가입 및 로그인이 완료되었습니다.', 'success');
          resetForm();
          onClose();
        } else {
          addToast('회원가입 완료! 로그인해주세요.', 'success');
          resetForm();
          onClose();
          onSwitchToLogin?.();
        }
      } else {
        addToast(result.message, 'error');
      }
      setLoading(false);
    },
    [email, password, passwordConfirm, name, register, login, addToast, onClose, onSwitchToLogin, resetForm],
  );

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="회원가입" anchorRef={anchorRef}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일을 입력하세요"
            className="w-full px-3 py-2 text-sm border border-border-light rounded-lg
                       bg-bg-primary text-text-primary placeholder:text-text-tertiary
                       focus:outline-none focus:border-primary transition-colors"
            autoFocus
            autoComplete="email"
            spellCheck={false}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            className="w-full px-3 py-2 text-sm border border-border-light rounded-lg
                       bg-bg-primary text-text-primary placeholder:text-text-tertiary
                       focus:outline-none focus:border-primary transition-colors"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="영문+숫자 포함 8자 이상"
            className="w-full px-3 py-2 text-sm border border-border-light rounded-lg
                       bg-bg-primary text-text-primary placeholder:text-text-tertiary
                       focus:outline-none focus:border-primary transition-colors"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">비밀번호 확인</label>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="비밀번호를 다시 입력하세요"
            className="w-full px-3 py-2 text-sm border border-border-light rounded-lg
                       bg-bg-primary text-text-primary placeholder:text-text-tertiary
                       focus:outline-none focus:border-primary transition-colors"
            autoComplete="new-password"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => { handleClose(); onSwitchToLogin?.(); }}
            className="text-xs text-primary hover:underline"
          >
            이미 계정이 있으신가요?
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={handleClose}>
              취소
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={loading}>
              {loading ? '처리 중...' : '회원가입'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
