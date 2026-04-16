import Sidebar from '../components/layout/Sidebar';
import MainContent from '../components/layout/MainContent';

export default function MainPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <MainContent />
      </main>
    </div>
  );
}
