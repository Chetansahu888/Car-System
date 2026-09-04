// components/shared/ReadOnlyNotice.jsx
import { Eye, Shield } from 'lucide-react';

export default function ReadOnlyNotice({ moduleName = 'this module' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'linear-gradient(90deg, #eff6ff, #f8fafc)',
      border: '1.5px solid #bfdbfe',
      borderRadius: 14,
      padding: '10px 16px',
      marginBottom: 20,
      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.05)',
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: '#dbeafe',
        color: '#2563eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Eye size={17} strokeWidth={2.3} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Read-Only Mode Active</span>
          <span style={{
            fontSize: 10.5,
            fontWeight: 800,
            background: '#2563eb',
            color: '#ffffff',
            padding: '2px 8px',
            borderRadius: 12,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            View Access
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
          You have view-only access to {moduleName}. Adding new records, modifying details, approvals, and deletions are restricted.
        </div>
      </div>
    </div>
  );
}
