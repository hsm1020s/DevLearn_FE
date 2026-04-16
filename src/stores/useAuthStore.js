/** @fileoverview 인증 상태 관리 스토어 (로그인/로그아웃, 사용자 정보 유지) */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 테스트 계정 — 개발 환경에서만 사용. 프로덕션 배포 시 빈 배열. */
const HARDCODED_USERS = import.meta.env.DEV
  ? [{ email: 'test', password: '1234', name: '문희석' }]
  : [];

const useAuthStore = create(
  persist(
    (set) => ({
      /** 현재 로그인한 사용자 정보 (null이면 비로그인) */
      user: null,
      /** 로그인 상태 여부 */
      isLoggedIn: false,

      /**
       * 이메일/비밀번호로 로그인 시도
       * @returns {{ success: boolean, message?: string }}
       */
      login: (email, password) => {
        const found = HARDCODED_USERS.find(
          (u) => u.email === email && u.password === password,
        );
        if (found) {
          set({ user: { email: found.email, name: found.name }, isLoggedIn: true });
          return { success: true };
        }
        return { success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' };
      },

      /** 로그아웃 */
      logout: () => set({ user: null, isLoggedIn: false }),
    }),
    {
      name: 'auth-storage',
      // 로그인 상태만 저장, 민감 정보(email 등) 제외
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        user: state.user ? { name: state.user.name } : null,
      }),
    },
  ),
);

export default useAuthStore;
