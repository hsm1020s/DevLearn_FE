import useAppStore from '../../stores/useAppStore';
import useCertStore from '../../stores/useCertStore';
import { getModeConfig } from '../../registry/modes';
import Button from '../common/Button';

export default function ModeHeader() {
  const mainMode = useAppStore((s) => s.mainMode);
  const setActiveModal = useAppStore((s) => s.setActiveModal);
  const setCertStep = useCertStore((s) => s.setCertStep);

  const modeConfig = getModeConfig(mainMode);
  const IconComponent = modeConfig.icon;
  const actions = modeConfig.actions;

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
        <span className="font-medium text-text-primary">{modeConfig.label}</span>
        <span className="text-text-secondary">—</span>
        <span className="text-sm text-text-secondary">{modeConfig.description}</span>
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
