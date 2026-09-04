// components/auth/ProtectedRoute.jsx
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft, Home, Lock } from 'lucide-react';

const AccessDenied = ({ pageKey }) => {
  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 20,
        border: '1px solid #fee2e2',
        boxShadow: '0 20px 40px rgba(239, 68, 68, 0.08)',
        maxWidth: 520,
        width: '100%',
        padding: '36px 32px',
        textAlign: 'center',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: '#fef2f2',
          border: '1.5px solid #fecaca',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: '#ef4444',
        }}>
          <ShieldAlert size={32} />
        </div>

        <span style={{
          display: 'inline-block',
          background: '#fee2e2',
          color: '#b91c1c',
          fontSize: 12,
          fontWeight: 800,
          padding: '4px 12px',
          borderRadius: 20,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 12,
        }}>
          403 Access Restricted
        </span>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
          Module Access Denied
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
          You do not have permission to view or manage this module.
          Please contact your System Administrator to request access privileges.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 12,
              background: '#059669',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)',
            }}
          >
            <Home size={16} /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default function ProtectedRoute({ children, pageKey, adminOnly = false }) {
  const { currentUser, hasPageAccess } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && currentUser.role !== 'admin') {
    return <AccessDenied pageKey={pageKey} />;
  }

  if (pageKey && !hasPageAccess(pageKey)) {
    return <AccessDenied pageKey={pageKey} />;
  }

  return children;
}
