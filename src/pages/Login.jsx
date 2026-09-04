// pages/Login.jsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, UserCheck, ShieldAlert, Sparkles, Key } from 'lucide-react';
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

  const setDemoAccount = async (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setSubmitting(true);
    try {
      const user = await login(demoEmail, demoPass);
      toast.success(`Logged in as ${user.name} (${user.role === 'admin' ? 'Full Admin Access' : 'Custom Page Permissions'})`);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Login failed.');
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
        maxWidth: 480,
        width: '100%',
        background: '#ffffff',
        borderRadius: 24,
        boxShadow: '0 25px 60px -15px rgba(5, 150, 105, 0.12), 0 0 1px 1px rgba(0, 0, 0, 0.04)',
        border: '1px solid #e2f0e7',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Header Ribbon */}
        <div style={{
          height: 6,
          background: 'linear-gradient(90deg, #059669, #10b981, #34d399)',
        }} />

        <div style={{ padding: '36px 32px' }}>
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
              boxShadow: '0 8px 20px rgba(5, 150, 105, 0.16)',
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
              margin: '0 0 6px',
            }}>
              Passary <span style={{ color: '#059669' }}>Car System</span>
            </h1>
            <p style={{
              fontSize: 13.5,
              color: '#64748b',
              margin: 0,
              fontWeight: 500,
            }}>
              Fleet ERP Enterprise Access & Management
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 700,
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
                    borderRadius: 12,
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
                    e.target.style.boxShadow = '0 0 0 4px rgba(5, 150, 105, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.background = '#f8fafc';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#334155',
                }}>
                  Password
                </label>
                <span style={{ fontSize: 12, color: '#059669', fontWeight: 600, cursor: 'default' }}>
                  Secure RBAC Login
                </span>
              </div>
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
                    borderRadius: 12,
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
                    e.target.style.boxShadow = '0 0 0 4px rgba(5, 150, 105, 0.12)';
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
                borderRadius: 12,
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
                boxShadow: '0 8px 20px rgba(5, 150, 105, 0.28)',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
            >
              {submitting ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins Section */}
          <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid #f1f5f9' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 12,
              fontSize: 12,
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}>
              <Sparkles size={13} color="#059669" />
              <span>1-Click Test Accounts</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Admin Button */}
              <button
                type="button"
                onClick={() => setDemoAccount('admin@passary.com', 'admin123')}
                disabled={submitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1.5px solid #d1fae5',
                  background: '#ecfdf5',
                  color: '#065f46',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#d1fae5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#ecfdf5'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={16} color="#059669" />
                  <div>
                    <div style={{ fontWeight: 800 }}>Super Admin</div>
                    <div style={{ fontSize: 11, color: '#047857', fontWeight: 500 }}>All 9 Pages Full Access + User Management</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: 6 }}>
                  Try
                </span>
              </button>

              {/* Manager Button */}
              <button
                type="button"
                onClick={() => setDemoAccount('manager@passary.com', 'manager123')}
                disabled={submitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1.5px solid #dbeafe',
                  background: '#eff6ff',
                  color: '#1e40af',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserCheck size={16} color="#2563eb" />
                  <div>
                    <div style={{ fontWeight: 800 }}>Operations Manager</div>
                    <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 500 }}>Repairs/Claims (Full) • Purchase (View) • Finance (None)</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, background: '#2563eb', color: '#fff', padding: '2px 8px', borderRadius: 6 }}>
                  Try
                </span>
              </button>

              {/* Viewer Button */}
              <button
                type="button"
                onClick={() => setDemoAccount('viewer@passary.com', 'viewer123')}
                disabled={submitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1.5px solid #fef3c7',
                  background: '#fffbeb',
                  color: '#92400e',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fef3c7'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fffbeb'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Eye size={16} color="#d97706" />
                  <div>
                    <div style={{ fontWeight: 800 }}>Audit & Staff Viewer</div>
                    <div style={{ fontSize: 11, color: '#b45309', fontWeight: 500 }}>Read-Only View on all modules (No Edit/Delete)</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, background: '#d97706', color: '#fff', padding: '2px 8px', borderRadius: 6 }}>
                  Try
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div style={{
          background: '#f8fafc',
          padding: '12px 24px',
          borderTop: '1px solid #f1f5f9',
          textAlign: 'center',
          fontSize: 12,
          color: '#94a3b8',
          fontWeight: 600,
        }}>
          Passary Minerals Pvt. Ltd. • Secure Fleet Enterprise Access
        </div>
      </div>
    </div>
  );
}
