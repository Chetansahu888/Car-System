// components/ui/LoadingOverlay.jsx
import SpeedingCarLoader from './SpeedingCarLoader';

export default function LoadingOverlay({ isVisible }) {
  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      overflow: 'hidden',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      {/* Supercar Speeding Animation - Pure, Floating, No White Box Background! */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <SpeedingCarLoader size="large" />
      </div>
    </div>
  );
}
