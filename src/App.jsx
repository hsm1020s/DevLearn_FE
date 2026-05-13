/**
 * @fileoverview 앱 루트 컴포넌트 — React Router 설정, ErrorBoundary, 전역 Toast 컨테이너 마운트.
 * AdminPage는 lazy 로딩으로 초기 번들 크기를 최소화한다.
 * 존재하지 않는 경로 접근 시 404 에러 페이지를 표시한다.
 */
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import MainPage from './pages/MainPage';
import ErrorPage from './pages/ErrorPage';
import ErrorBoundary from './components/common/ErrorBoundary';
import ToastContainer from './components/common/Toast';
import ClarityFilm from './components/layout/ClarityFilm';
import LlmActivityFab from './components/monitor/LlmActivityFab';
import useAppStore from './stores/useAppStore';
import { hitVisit, getVisitCount } from './services/visitorApi';

const VISIT_SESSION_KEY = 'dl_visited';

/**
 * 사이트 누적 방문자수 초기 페치.
 * - sessionStorage 가드: 같은 브라우저 세션에서는 한 번만 hit, 이후는 count 조회만.
 * - 서버측에서 IP 24h 가드 + 봇 필터로 한 번 더 방어.
 * - 실패해도 앱은 정상 동작(visitorCount = null 이면 사이드바에서 숨김).
 */
function useVisitorCount() {
  const setVisitorCount = useAppStore((s) => s.setVisitorCount);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const visited = sessionStorage.getItem(VISIT_SESSION_KEY) === '1';
        const { totalCount } = visited ? await getVisitCount() : await hitVisit();
        if (!visited) sessionStorage.setItem(VISIT_SESSION_KEY, '1');
        if (!cancelled) setVisitorCount(totalCount);
      } catch (err) {
        // 사이드바 카운트는 보조 정보이므로 조용히 무시. 콘솔에만 남김.
        console.warn('[visitor] count fetch failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [setVisitorCount]);
}

/** 관리자 페이지 지연 로드 */
const AdminPage = lazy(() => import('./pages/AdminPage'));
/** 로컬 LLM 활동 모니터 페이지 — 인증 필수, 페이지 진입 시에만 로드 */
const LlmActivityPage = lazy(() => import('./pages/LlmActivityPage'));
/** 일반 사용자 설정 페이지 — 진입 시에만 번들 로드 */
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

/** URL 파라미터에서 에러 코드를 추출하여 ErrorPage에 전달 */
function ErrorRoute() {
  const { code } = useParams();
  return <ErrorPage code={Number(code) || 500} />;
}

/** 앱 루트 컴포넌트 */
export default function App() {
  useVisitorCount();
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route
            path="/llm-activity"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                <LlmActivityPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                <AdminPage />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route path="/error/:code" element={<ErrorRoute />} />
          <Route path="/*" element={<MainPage />} />
          <Route path="*" element={<ErrorPage code={404} />} />
        </Routes>
        <ToastContainer />
        <ClarityFilm />
        <LlmActivityFab />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
