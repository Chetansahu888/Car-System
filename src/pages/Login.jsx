// pages/Login.jsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Eye, EyeOff, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address.');
      return;
    }
    if (!password) {
      toast.error('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Login failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top left, #ecfdf5 0%, #f0fdf4 40%, #f8fafc 100%)',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle background ambient circles */}
      <div style={{
        position: 'absolute',
        top: -120,
        right: -120,
        width: 420,
        height: 420,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(5, 150, 105, 0.12) 0%, rgba(5, 150, 105, 0) 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -100,
        left: -100,
        width: 380,
        height: 380,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0) 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        maxWidth: 420,
        width: '100%',
        background: '#ffffff',
        borderRadius: 20,
        boxShadow: '0 20px 50px -12px rgba(5, 150, 105, 0.15), 0 0 1px 1px rgba(0, 0, 0, 0.04)',
        border: '1px solid #e2f0e7',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Top Accent Gradient Line */}
        <div style={{
          height: 5,
          background: 'linear-gradient(90deg, #059669, #10b981, #34d399)',
        }} />

        <div style={{ padding: '36px 30px' }}>
          {/* Logo & Branding */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28, textAlign: 'center' }}>
            <div style={{
              width: 58,
              height: 58,
              borderRadius: 16,
              background: '#ffffff',
              border: '2px solid #e2f0e7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(5, 150, 105, 0.14)',
              overflow: 'hidden',
              padding: 6,
              marginBottom: 16,
            }}>
              <img
                src="/passary-logo.png"
                alt="Passary Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            
            <h1 style={{
              fontSize: 24,
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: -0.5,
              margin: 0,
            }}>
              Passary <span style={{ color: '#059669' }}>Car System</span>
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#334155',
                marginBottom: 6,
              }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@passary.com"
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '11px 14px 11px 40px',
                    borderRadius: 10,
                    border: '1.5px solid #e2e8f0',
                    fontSize: 14,
                    color: '#0f172a',
                    background: '#f8fafc',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                    fontWeight: 500,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#059669';
                    e.target.style.background = '#ffffff';
                    e.target.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.background = '#f8fafc';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#334155',
                marginBottom: 6,
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 40px',
                    borderRadius: 10,
                    border: '1.5px solid #e2e8f0',
                    fontSize: 14,
                    color: '#0f172a',
                    background: '#f8fafc',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                    fontWeight: 500,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#059669';
                    e.target.style.background = '#ffffff';
                    e.target.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.background = '#f8fafc';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: '#ffffff',
                border: 'none',
                fontSize: 14.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 8px 18px rgba(5, 150, 105, 0.25)',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
            >
              {submitting ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
