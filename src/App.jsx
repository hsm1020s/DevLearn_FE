/**
 * @fileoverview 앱 루트 컴포넌트 — React Router 설정 및 전역 Toast 컨테이너 마운트.
 * AdminPage는 lazy 로딩으로 초기 번들 크기를 최소화한다.
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage';
import ToastContainer from './components/common/Toast';

/** 관리자 페이지 지연 로드 */
const AdminPage = lazy(() => import('./pages/AdminPage'));

/** 앱 루트 컴포넌트 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<MainPage />} />
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
              <AdminPage />
            </Suspense>
          }
        />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}
