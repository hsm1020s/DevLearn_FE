/**
 * @fileoverview 앱 루트 컴포넌트 — React Router 설정, ErrorBoundary, 전역 Toast 컨테이너 마운트.
 * AdminPage는 lazy 로딩으로 초기 번들 크기를 최소화한다.
 * 존재하지 않는 경로 접근 시 404 에러 페이지를 표시한다.
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import MainPage from './pages/MainPage';
import ErrorPage from './pages/ErrorPage';
import ErrorBoundary from './components/common/ErrorBoundary';
import ToastContainer from './components/common/Toast';

/** 관리자 페이지 지연 로드 */
const AdminPage = lazy(() => import('./pages/AdminPage'));

/** URL 파라미터에서 에러 코드를 추출하여 ErrorPage에 전달 */
function ErrorRoute() {
  const { code } = useParams();
  return <ErrorPage code={Number(code) || 500} />;
}

/** 앱 루트 컴포넌트 */
export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                <AdminPage />
              </Suspense>
            }
          />
          <Route path="/error/:code" element={<ErrorRoute />} />
          <Route path="*" element={<ErrorPage code={404} />} />
        </Routes>
        <ToastContainer />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
