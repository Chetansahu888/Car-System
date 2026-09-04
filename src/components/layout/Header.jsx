// components/layout/Header.jsx
import { Search, Bell, Menu, User, ChevronDown, LogOut, ShieldCheck, Users, Lock } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const Header = ({ onMenuToggle }) => {
  const [search, setSearch] = useState('');
  const [profileDropdown, setProfileDropdown] = useState(false);
  
  const dropdownRef = useRef(null);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = currentUser?.role === 'admin';

  // Click outside to close profile dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <header className="header">
        {/* Mobile menu toggle */}
        <button
          onClick={onMenuToggle}
          style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10,
            width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#334155', cursor: 'pointer', transition: 'all 0.15s'
          }}
          className="mobile-menu-btn"
          title="Toggle Menu"
        >
          <Menu size={19} />
        </button>

        {/* Header Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: '#ffffff', border: '1.5px solid #e2f0e7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(5, 150, 105, 0.12)',
            overflow: 'hidden', padding: 3
          }}>
            <img src="/passary-logo.png" alt="Passary Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: -0.2 }}>
            Passary <span style={{ color: '#059669' }}>Car System</span>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div className="search-wrapper" style={{ maxWidth: 360, width: '100%' }}>
          <Search size={15} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search fleet, claims, repairs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        {/* Notifications */}
        <button
          style={{
            position: 'relative', background: '#ffffff',
            border: '1px solid #e2e8f0', borderRadius: 12,
            width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#64748b', transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#059669'; e.currentTarget.style.borderColor = '#a7f3d0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
        >
          <Bell size={18} />
          <span style={{
            position: 'absolute', top: -3, right: -3, width: 18, height: 18,
            background: '#ef4444',
            borderRadius: '50%', fontSize: 10, fontWeight: 800, color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #ffffff'
          }}>3</span>
        </button>

        {/* User Profile Dropdown Container */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <div
            onClick={() => setProfileDropdown(!profileDropdown)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#ffffff', border: '1px solid #e2e8f0',
              borderRadius: 12, padding: '5px 12px 5px 6px', cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: profileDropdown ? '0 0 0 3px rgba(5, 150, 105, 0.12)' : 'none',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: isAdmin ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff', fontWeight: 800, fontSize: 13,
            }}>
              {currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                {currentUser?.name || 'Guest'}
              </span>
              <span style={{ fontSize: 11, color: isAdmin ? '#059669' : '#2563eb', fontWeight: 700 }}>
                {isAdmin ? 'Super Admin' : (currentUser?.department || 'Staff User')}
              </span>
            </div>
            <ChevronDown size={14} color="#94a3b8" />
          </div>

          {/* Profile Dropdown Menu */}
          {profileDropdown && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 260,
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0',
              padding: 8,
              zIndex: 100,
              animation: 'fadeIn 0.15s ease-out',
            }}>
              {/* Account summary banner */}
              <div style={{
                padding: '12px 14px',
                background: '#f8fafc',
                borderRadius: 12,
                marginBottom: 8,
                border: '1px solid #f1f5f9',
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{currentUser?.name}</div>
                <div style={{ fontSize: 11.5, color: '#64748b', wordBreak: 'break-all', marginTop: 1 }}>{currentUser?.email}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    background: isAdmin ? '#dcfce7' : '#dbeafe',
                    color: isAdmin ? '#15803d' : '#1e40af',
                    padding: '2px 7px',
                    borderRadius: 6,
                    textTransform: 'uppercase',
                  }}>
                    {isAdmin ? 'Full Administrator' : 'Staff RBAC'}
                  </span>
                </div>
              </div>

              {/* Navigation Links */}
              {isAdmin && (
                <Link
                  to="/users"
                  onClick={() => setProfileDropdown(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    color: '#334155',
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#059669'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#334155'; }}
                >
                  <Users size={16} color="#059669" />
                  <span>User & Role Management</span>
                </Link>
              )}

              {/* Logout button */}
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  marginTop: 4,
                  borderTop: '1px solid #f1f5f9',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <LogOut size={16} color="#ef4444" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>

        <style>{`
          @media (min-width: 769px) {
            .mobile-menu-btn { display: none !important; }
          }
        `}</style>
      </header>
  );
};

export default Header;
