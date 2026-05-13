/**
 * @fileoverview 설정 페이지 — 회원정보 수정 섹션.
 *
 * 이름 변경과 비밀번호 변경 두 폼을 카드 형태로 제공한다.
 * - 이름 변경: dirty 상태에서만 저장 버튼 활성화, 성공 시 useAuthStore 의 user.name 갱신.
 * - 비밀번호 변경: 클라이언트 정책(영문+숫자 8자 이상)으로 한 번 거른 뒤 서버 호출.
 *   현재 비밀번호 불일치는 서버가 401 로 응답하며, 메시지는 Toast 로 노출.
 */
import { useState, useCallback } from 'react';
import { Save, KeyRound } from 'lucide-react';
import Button from '../common/Button';
import { useToastStore } from '../common/Toast';
import { updateProfile, changePassword } from '../../services/userApi';
import useAuthStore from '../../stores/useAuthStore';

/**
 * 클라이언트 비밀번호 정책 — useAuthStore 의 validatePasswordPolicy 와 동일 규칙을 적용한다.
 * 정책 통과 시 null, 실패 시 메시지를 반환.
 * @param {string} pw
 * @returns {string|null}
 */
function validatePasswordPolicy(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return '비밀번호는 영문과 숫자를 모두 포함해야 합니다.';
  return null;
}

/**
 * 회원정보 수정 섹션
 * @param {object} props
 * @param {{ id: string, email: string, name: string, role: string }} props.profile - 서버에서 받은 초기 프로필
 */
export default function ProfileSection({ profile }) {
  const addToast = useToastStore((s) => s.addToast);
  const updateProfileLocal = useAuthStore((s) => s.updateProfileLocal);

  // 이름 폼
  const [name, setName] = useState(profile.name);
  const [savingName, setSavingName] = useState(false);
  const nameDirty = name.trim() !== profile.name && name.trim().length > 0;

  // 비밀번호 폼
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveName = useCallback(async (e) => {
    e.preventDefault();
    if (!nameDirty || savingName) return;
    setSavingName(true);
    try {
      const next = await updateProfile({ name: name.trim() });
      updateProfileLocal({ name: next.name });
      addToast('이름이 변경되었습니다.', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || '이름 변경에 실패했습니다.';
      addToast(msg, 'error');
    } finally {
      setSavingName(false);
    }
  }, [name, nameDirty, savingName, addToast, updateProfileLocal]);

  const handleSavePassword = useCallback(async (e) => {
    e.preventDefault();
    if (savingPassword) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast('모든 항목을 입력해주세요.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('새 비밀번호가 일치하지 않습니다.', 'error');
      return;
    }
    const pwError = validatePasswordPolicy(newPassword);
    if (pwError) {
      addToast(pwError, 'error');
      return;
    }
    if (newPassword === currentPassword) {
      addToast('새 비밀번호는 현재 비밀번호와 달라야 합니다.', 'error');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      addToast('비밀번호가 변경되었습니다.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err?.response?.data?.message || '비밀번호 변경에 실패했습니다.';
      addToast(msg, 'error');
    } finally {
      setSavingPassword(false);
    }
  }, [currentPassword, newPassword, confirmPassword, savingPassword, addToast]);

  return (
    <div className="flex flex-col gap-6">
      {/* 이메일(읽기 전용) */}
      <section className="bg-bg-primary border border-border-light rounded-xl p-5">
        <h2 className="text-base font-semibold text-text-primary mb-3">계정</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2 text-sm">
          <div className="text-text-secondary">이메일</div>
          <div className="text-text-primary">{profile.email}</div>
          <div className="text-text-secondary">역할</div>
          <div className="text-text-primary">{profile.role === 'ADMIN' ? '관리자' : '일반 사용자'}</div>
        </div>
      </section>

      {/* 이름 변경 */}
      <section className="bg-bg-primary border border-border-light rounded-xl p-5">
        <h2 className="text-base font-semibold text-text-primary mb-3">이름 변경</h2>
        <form onSubmit={handleSaveName} className="flex flex-col gap-3 max-w-md">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="w-full px-3 py-2 text-sm border border-border-light rounded-lg
                         bg-bg-primary text-text-primary placeholder:text-text-tertiary
                         focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={!nameDirty || savingName}>
              <Save size={14} />
              {savingName ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      </section>

      {/* 비밀번호 변경 */}
      <section className="bg-bg-primary border border-border-light rounded-xl p-5">
        <h2 className="text-base font-semibold text-text-primary mb-3">비밀번호 변경</h2>
        <form onSubmit={handleSavePassword} className="flex flex-col gap-3 max-w-md">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">현재 비밀번호</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3 py-2 text-sm border border-border-light rounded-lg
                         bg-bg-primary text-text-primary placeholder:text-text-tertiary
                         focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">새 비밀번호</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="영문+숫자 포함 8자 이상"
              className="w-full px-3 py-2 text-sm border border-border-light rounded-lg
                         bg-bg-primary text-text-primary placeholder:text-text-tertiary
                         focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">새 비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2 text-sm border border-border-light rounded-lg
                         bg-bg-primary text-text-primary placeholder:text-text-tertiary
                         focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingPassword}>
              <KeyRound size={14} />
              {savingPassword ? '변경 중...' : '비밀번호 변경'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
