/**
 * @fileoverview 인증 상태 관리 스토어 (로그인/로그아웃, 회원가입, 사용자 정보 유지)
 * Real API 사용 시 JWT 토큰은 localStorage에서 직접 관리하며, Zustand persist에는 포함하지 않는다.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const useAuthStore = create(
  persist(
    (set) => ({
      /** 현재 로그인한 사용자 정보 (null이면 비로그인) */
      user: null,
      /** 로그인 상태 여부 */
      isLoggedIn: false,

      /**
       * 이메일/비밀번호로 로그인 시도 (실제 API 호출)
       * @param {string} email - 사용자 이메일
       * @param {string} password - 비밀번호
       * @returns {Promise<{ success: boolean, message?: string }>}
       */
      login: async (email, password) => {
        try {
          const { data } = await api.post('/auth/login', { email, password });
          // 백엔드 ApiResponse 래핑: data.data에 실제 데이터
          const { accessToken, refreshToken, user } = data.data;

          // JWT 토큰은 localStorage에 직접 저장 (persist 대상 아님)
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);

          set({ user: { email: user.email, name: user.name }, isLoggedIn: true });
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.message || '로그인에 실패했습니다';
          return { success: false, message };
        }
      },

      /**
       * 로그아웃 — 토큰 제거 및 상태 초기화
       */
      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, isLoggedIn: false });
      },

      /**
       * 회원가입 (실제 API 호출)
       * @param {string} email - 사용자 이메일
       * @param {string} password - 비밀번호
       * @param {string} name - 사용자 이름
       * @returns {Promise<{ success: boolean, message?: string }>}
       */
      register: async (email, password, name) => {
        try {
          await api.post('/auth/register', { email, password, name });
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.message || '회원가입에 실패했습니다';
          return { success: false, message };
        }
      },
    }),
    {
      name: 'auth-storage',
      // 로그인 상태와 사용자 이름만 persist (토큰은 localStorage에서 직접 관리)
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        user: state.user ? { name: state.user.name } : null,
      }),
    },
  ),
);

export default useAuthStore;
