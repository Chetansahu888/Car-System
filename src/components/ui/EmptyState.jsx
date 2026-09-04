// components/ui/EmptyState.jsx
import { Inbox } from 'lucide-react';

const EmptyState = ({ icon: Icon = Inbox, title = 'No records found', message, action }) => (
  <div className="empty-state">
    <div className="icon-wrap">
      <Icon size={28} />
    </div>
    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>{title}</h3>
    {message && <p style={{ fontSize: 14, color: '#64748b', maxWidth: 360, lineHeight: 1.6, marginBottom: 16 }}>{message}</p>}
    {action}
  </div>
);

export default EmptyState;
