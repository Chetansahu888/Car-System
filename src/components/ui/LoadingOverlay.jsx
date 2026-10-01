// components/ui/LoadingOverlay.jsx
import CircleLoader from './CircleLoader';

export default function LoadingOverlay({ isVisible, message = 'Please Wait' }) {
  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(5px)',
      WebkitBackdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      overflow: 'hidden',
      animation: 'fadeIn 0.18s ease-out'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 36px',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e2e8f0',
        minWidth: 180,
        maxWidth: 320,
        textAlign: 'center',
        gap: '14px',
        animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <CircleLoader size={46} color="#059669" />
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', letterSpacing: 0.3 }}>
          Please Wait
        </div>
      </div>
    </div>
  );
}
