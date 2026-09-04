// components/ui/LoadingOverlay.jsx
import { Loader2, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

export default function LoadingOverlay({ isVisible, message = 'Saving & Syncing to Google Sheets...' }) {
  if (!isVisible) return null;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(255, 255, 255, 0.88)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      borderRadius: 'inherit',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: '#ffffff',
        padding: '24px 32px',
        borderRadius: 18,
        boxShadow: '0 12px 36px rgba(5, 150, 105, 0.18)',
        border: '1.5px solid #a7f3d0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        textAlign: 'center',
        maxWidth: 320
      }}>
        {/* Animated Double Circle Spinner */}
        <div style={{ position: 'relative', width: 56, height: 56 }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '4px solid #ecfdf5',
            borderTopColor: '#059669',
            animation: 'spin 0.85s cubic-bezier(0.65, 0, 0.35, 1) infinite'
          }} />
          <div style={{
            position: 'absolute',
            inset: 6,
            borderRadius: '50%',
            border: '3px solid #d1fae5',
            borderBottomColor: '#10b981',
            animation: 'spin 1.2s linear infinite reverse'
          }} />
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#059669'
          }}>
            <Sparkles size={18} />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a', letterSpacing: -0.2 }}>
            {message}
          </div>
          <div style={{ fontSize: 12, color: '#059669', marginTop: 4, fontWeight: 600 }}>
            Live Google Sheets & Drive Sync
          </div>
        </div>
      </div>
    </div>
  );
}
