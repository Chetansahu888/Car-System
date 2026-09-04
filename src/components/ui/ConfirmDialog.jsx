// components/ui/ConfirmDialog.jsx
import { AlertTriangle, CheckCircle } from 'lucide-react';
import Modal from './Modal';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', confirmClass = 'btn btn-danger', loading = false, variant = 'danger' }) => {
  const Icon = variant === 'success' ? CheckCircle : AlertTriangle;
  const iconColor = variant === 'success' ? '#4ade80' : '#f87171';
  const iconBg = variant === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button className={confirmClass} onClick={onConfirm} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, flexShrink: 0 }}>
          <Icon size={22} />
        </div>
        <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: 0, paddingTop: 8 }}>{message}</p>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
