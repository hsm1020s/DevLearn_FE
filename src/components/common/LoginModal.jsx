/** @fileoverview 로그인 모달 — 이메일/비밀번호 입력 후 하드코딩 계정으로 인증한다. */
import { useState, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
import useAuthStore from '../../stores/useAuthStore';
import { useToastStore } from './Toast';

export default function LoginModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore((s) => s.login);
  const addToast = useToastStore((s) => s.addToast);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (!email.trim() || !password) {
        addToast('이메일과 비밀번호를 입력해주세요.', 'error');
        return;
      }
      const result = login(email.trim(), password);
      if (result.success) {
        addToast('로그인되었습니다.', 'success');
        setEmail('');
        setPassword('');
        onClose();
      } else {
        addToast(result.message, 'error');
      }
    },
    [email, password, login, addToast, onClose],
  );

  const handleClose = useCallback(() => {
    setEmail('');
    setPassword('');
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="로그인">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            className="w-full px-3 py-2 text-sm border border-border-light rounded-lg
                       bg-bg-primary text-text-primary placeholder:text-text-tertiary
                       focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" type="button" onClick={handleClose}>
            취소
          </Button>
          <Button variant="primary" size="sm" type="submit">
            로그인
          </Button>
        </div>
      </form>
    </Modal>
  );
}
