import { Search, FileText, Briefcase, Upload, BarChart3, BookOpen } from 'lucide-react';
import useAppStore from '../../stores/useAppStore';
import useCertStore from '../../stores/useCertStore';
import { MAIN_MODES } from '../../utils/constants';
import Button from '../common/Button';

const ICON_MAP = {
  Search,
  FileText,
  Briefcase,
};

const MODE_ACTIONS = {
  general: [],
  cert: [
    { label: 'PDF 업로드', icon: Upload, action: 'certUpload' },
    { label: '학습현황', icon: BarChart3, action: 'studyStats' },
  ],
  work: [
    { label: 'PDF 업로드', icon: Upload, action: 'ragUpload' },
    { label: '문서관리', icon: BookOpen, action: 'docManage' },
  ],
};

export default function ModeHeader() {
  const mainMode = useAppStore((s) => s.mainMode);
  const setActiveModal = useAppStore((s) => s.setActiveModal);
  const setCertStep = useCertStore((s) => s.setCertStep);

  const currentMode = MAIN_MODES.find((m) => m.value === mainMode);
  if (!currentMode) return null;

  const IconComponent = ICON_MAP[currentMode.icon];
  const actions = MODE_ACTIONS[mainMode] || [];

  const handleAction = (action) => {
    if (action === 'certUpload') {
      setCertStep('upload');
      return;
    }
    setActiveModal(action);
  };

  return (
    <header className="flex items-center justify-between border-b border-border-light px-4 py-3">
      <div className="flex items-center gap-2">
        {IconComponent && <IconComponent className="h-5 w-5 text-text-secondary" />}
        <span className="font-medium text-text-primary">{currentMode.label}</span>
        <span className="text-text-secondary">—</span>
        <span className="text-sm text-text-secondary">{currentMode.description}</span>
      </div>

      {actions.length > 0 && (
        <div className="flex items-center gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="secondary"
              size="sm"
              onClick={() => handleAction(action.action)}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </header>
  );
}
