/**
 * @fileoverview 애플리케이션 진입점 — React DOM 루트 생성 및 StrictMode 렌더링.
 *
 * 부팅 가드: 비로그인 상태로 앱이 시작되면 persist된 사용자 데이터(대화/문서/
 * 마인드맵/학습/RAG)를 렌더 이전에 비운다. 로그아웃 처리 누락·수동 토큰 삭제
 * 등으로 남은 이전 세션 캐시가 익명/다음 사용자에게 노출되는 상황을 차단한다.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import useAuthStore from './stores/useAuthStore';
import { resetUserStores } from './utils/resetUserStores';
import './styles/globals.css';

// 부팅 가드: 비로그인이거나 토큰이 없으면 이전 사용자 캐시를 비운다.
// `isLoggedIn` 만 검사하면 토큰이 외부 요인(브라우저 탭 강제 종료, 수동 삭제,
// 일부 브라우저의 개별 키 cleanup)으로 사라졌을 때 isLoggedIn=true 인 비대칭
// 상태가 남아 이전 사용자의 대화/마인드맵 등이 다음 세션에 노출될 수 있다.
const { isLoggedIn } = useAuthStore.getState();
const hasAccessToken = !!localStorage.getItem('accessToken');
if (!isLoggedIn || !hasAccessToken) {
  // 토큰만 사라진 비정상 상태도 auth-storage persist 까지 비우도록 logout() 호출
  if (isLoggedIn && !hasAccessToken) {
    useAuthStore.getState().logout();
  }
  resetUserStores();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
