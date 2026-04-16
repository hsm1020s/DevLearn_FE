/**
 * @fileoverview 로그인 모달 — 이메일/비밀번호 입력 후 하드코딩 계정으로 인증한다.
 * 추후 백엔드 연동 시 useAuthStore.login()을 실제 API 호출로 교체할 예정.
 */
import { useState, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
import useAuthStore from '../../stores/useAuthStore';
import { useToastStore } from './Toast';

/**
 * 로그인 모달 컴포넌트
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {Function} onClose - 모달 닫기 핸들러
 * @param {React.RefObject} [anchorRef] - 팝오버 앵커 위치 참조
 */
export default function LoginModal({ isOpen, onClose, anchorRef }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore((s) => s.login);
  const addToast = useToastStore((s) => s.addToast);

  // 폼 제출 — 빈 입력 검증 후 스토어 login 호출, 성공 시 모달 닫기
  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (!email.trim() || !password) {
        addToast('아이디와 비밀번호를 입력해주세요.', 'error');
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

  // 모달 닫기 — 입력 필드 초기화 후 닫기
  const handleClose = useCallback(() => {
    setEmail('');
    setPassword('');
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="로그인" anchorRef={anchorRef}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">아이디</label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="아이디를 입력하세요"
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
