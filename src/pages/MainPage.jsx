/**
 * @fileoverview 메인 페이지 — 사이드바와 메인 콘텐츠 영역으로 구성된 기본 레이아웃.
 * 모바일(768px 미만)에서는 사이드바가 오버레이 드로어로 전환된다.
 */
import Sidebar from '../components/layout/Sidebar';
import MainContent from '../components/layout/MainContent';

/** 메인 페이지 레이아웃 (사이드바 + 콘텐츠) */
export default function MainPage() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-hidden w-full">
        <MainContent />
      </main>
    </div>
  );
}
