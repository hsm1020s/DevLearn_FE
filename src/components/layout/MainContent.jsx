import { lazy, Suspense } from 'react';
import useAppStore from '../../stores/useAppStore';
import ModeHeader from './ModeHeader';
import SplitView from './SplitView';
import Modal from '../common/Modal';

const ChatContainer = lazy(() => import('../chat/ChatContainer'));
const WorkStudyMode = lazy(() => import('../work/WorkStudyMode'));
const CertMode = lazy(() => import('../cert/CertMode'));
const MindmapPanel = lazy(() => import('../mindmap/MindmapPanel'));
const RagUploader = lazy(() => import('../work/RagUploader'));
const DocumentList = lazy(() => import('../work/DocumentList'));
const StudyStats = lazy(() => import('../cert/StudyStats'));

const MODAL_CONFIG = {
  ragUpload: { title: 'PDF 문서 업로드', Component: RagUploader },
  docManage: { title: '문서 관리', Component: DocumentList },
  studyStats: { title: '학습 현황', Component: StudyStats },
};

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ModeContent({ mode }) {
  switch (mode) {
    case 'general':
      return <ChatContainer />;
    case 'work':
      return <WorkStudyMode />;
    case 'cert':
      return <CertMode />;
    default:
      return null;
  }
}

export default function MainContent() {
  const mainMode = useAppStore((s) => s.mainMode);
  const isMindmapOn = useAppStore((s) => s.isMindmapOn);
  const activeModal = useAppStore((s) => s.activeModal);
  const closeModal = useAppStore((s) => s.closeModal);

  const modalCfg = MODAL_CONFIG[activeModal];

  return (
    <div className="flex flex-col h-full">
      <ModeHeader />
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<LoadingFallback />}>
          <SplitView
            leftContent={<ModeContent mode={mainMode} />}
            rightContent={<MindmapPanel />}
            isRightVisible={isMindmapOn}
          />
        </Suspense>
      </div>

      {modalCfg && (
        <Modal isOpen onClose={closeModal} title={modalCfg.title}>
          <Suspense fallback={<LoadingFallback />}>
            <modalCfg.Component onDone={closeModal} />
          </Suspense>
        </Modal>
      )}
    </div>
  );
}
