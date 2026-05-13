/**
 * @fileoverview 일반 사용자 설정 페이지 — 회원정보 수정 + 회원 탈퇴.
 *
 * 진입 가드: 미로그인 시 메인으로 리다이렉트.
 * 진입 시 1회 `/api/users/me` 를 호출해 폼 초기값을 채우고, 응답 실패 시 에러 화면을 보여준다.
 * 사이드바는 메인과 동일하게 마운트되지 않는다(설정은 본 화면 단독). 좌상단에 메인으로 돌아가는 링크를 둔다.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import useAuthStore from '../stores/useAuthStore';
import { getMe } from '../services/userApi';
import ProfileSection from '../components/settings/ProfileSection';
import WithdrawSection from '../components/settings/WithdrawSection';
import ErrorPage from './ErrorPage';

export default function SettingsPage() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState(null);

  // 미로그인 가드
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/', { replace: true });
    }
  }, [isLoggedIn, navigate]);

  // 프로필 1회 로드
  const loadProfile = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    try {
      const me = await getMe();
      setProfile(me);
    } catch (err) {
      // 401 은 토큰 만료 등 — 가드가 처리하므로 여기서는 500 처리
      setErrorCode(err?.response?.status === 401 ? 401 : 500);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) loadProfile();
  }, [isLoggedIn, loadProfile]);

  if (!isLoggedIn) return null;
  if (errorCode) return <ErrorPage code={errorCode} />;

  return (
    <div className="min-h-screen bg-bg-secondary">
      {/* 상단 헤더 */}
      <header className="bg-bg-primary border-b border-border-light">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            aria-label="메인으로 돌아가기"
            className="p-1.5 rounded-md text-text-secondary hover:bg-bg-secondary transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold text-text-primary">설정</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6">
        {loading || !profile ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <ProfileSection profile={profile} />
            <WithdrawSection />
          </div>
        )}
      </main>
    </div>
  );
}
