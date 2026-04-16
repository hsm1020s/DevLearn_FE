import { lazy, Suspense, useMemo } from 'react';
import useAppStore from '../../stores/useAppStore';
import { getModeConfig } from '../../registry/modes';
import ModeHeader from './ModeHeader';
import SplitView from './SplitView';
import Modal from '../common/Modal';

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

export default function MainContent() {
  const mainMode = useAppStore((s) => s.mainMode);
  const isMindmapOn = useAppStore((s) => s.isMindmapOn);
  const activeModal = useAppStore((s) => s.activeModal);
  const closeModal = useAppStore((s) => s.closeModal);

  const ModeComponent = useMemo(
    () => lazy(getModeConfig(mainMode).component),
    [mainMode],
  );

  const modalCfg = MODAL_CONFIG[activeModal];

  return (
    <div className="flex flex-col h-full">
      <ModeHeader />
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<LoadingFallback />}>
          <SplitView
            leftContent={<ModeComponent />}
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
