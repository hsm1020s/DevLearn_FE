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

if (!useAuthStore.getState().isLoggedIn) {
  resetUserStores();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
