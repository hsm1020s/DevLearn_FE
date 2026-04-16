/**
 * @fileoverview 애플리케이션 진입점 — React DOM 루트 생성 및 StrictMode 렌더링.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
