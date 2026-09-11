// context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';

const AUTH_STORAGE_KEY = 'cms_current_user';
const USERS_STORAGE_KEY = 'cms_users';

export const PAGE_KEYS = {
  DASHBOARD: 'dashboard',
  PURCHASE_CAR: 'purchase_car',
  CHALLANS: 'challans',
  FASTAG: 'fastag',
  INSURANCE: 'insurance',
  CAR_REPAIR: 'car_repair',
  ACCIDENT_CLAIMS: 'accident_claims',
  VENDOR_OFFERS: 'vendor_offers',
  APPROVALS: 'approvals',
  DELIVERY: 'delivery',
  PAYMENT: 'payment',
};

export const PAGE_CONFIG = [
  { key: PAGE_KEYS.DASHBOARD, label: 'Dashboard', path: '/', defaultLevel: 'full' },
  { key: PAGE_KEYS.PURCHASE_CAR, label: 'Purchase Car', path: '/purchase-car', defaultLevel: 'full' },
  { key: PAGE_KEYS.CHALLANS, label: 'Challan', path: '/challans', defaultLevel: 'full' },
  { key: PAGE_KEYS.FASTAG, label: 'Fastag', path: '/fastags', defaultLevel: 'full' },
  { key: PAGE_KEYS.INSURANCE, label: 'Insurance', path: '/insurance', defaultLevel: 'full' },
  { key: PAGE_KEYS.CAR_REPAIR, label: 'Car Repair', path: '/car-repair', defaultLevel: 'full' },
  { key: PAGE_KEYS.ACCIDENT_CLAIMS, label: 'Accident / Claims', path: '/accident-claims', defaultLevel: 'full' },
  { key: PAGE_KEYS.VENDOR_OFFERS, label: 'Vendor Offers', path: '/vendor-offers', defaultLevel: 'full' },
  { key: PAGE_KEYS.APPROVALS, label: 'Approvals', path: '/approvals', defaultLevel: 'full' },
  { key: PAGE_KEYS.DELIVERY, label: 'Delivery Of Car', path: '/delivery', defaultLevel: 'full' },
  { key: PAGE_KEYS.PAYMENT, label: 'Payment', path: '/payment', defaultLevel: 'full' },
];

export const ACCESS_LEVELS = {
  NONE: 'none',
  VIEW: 'view',
  FULL: 'full',
};

const DEFAULT_USERS = [
  {
    id: 'user_admin',
    name: 'Super Admin',
    email: 'admin@passary.com',
    password: 'admin123',
    role: 'admin',
    department: 'Management',
    avatarColor: '#059669',
    permissions: PAGE_CONFIG.reduce((acc, p) => ({ ...acc, [p.key]: ACCESS_LEVELS.FULL }), {}),
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'user_manager',
    name: 'Operations Manager',
    email: 'manager@passary.com',
    password: 'manager123',
    role: 'user',
    department: 'Operations',
    avatarColor: '#2563eb',
    permissions: {
      [PAGE_KEYS.DASHBOARD]: ACCESS_LEVELS.FULL,
      [PAGE_KEYS.PURCHASE_CAR]: ACCESS_LEVELS.VIEW,
      [PAGE_KEYS.CHALLANS]: ACCESS_LEVELS.FULL,
      [PAGE_KEYS.FASTAG]: ACCESS_LEVELS.FULL,
      [PAGE_KEYS.INSURANCE]: ACCESS_LEVELS.VIEW,
      [PAGE_KEYS.CAR_REPAIR]: ACCESS_LEVELS.FULL,
      [PAGE_KEYS.ACCIDENT_CLAIMS]: ACCESS_LEVELS.FULL,
      [PAGE_KEYS.VENDOR_OFFERS]: ACCESS_LEVELS.FULL,
      [PAGE_KEYS.APPROVALS]: ACCESS_LEVELS.NONE,
      [PAGE_KEYS.DELIVERY]: ACCESS_LEVELS.FULL,
      [PAGE_KEYS.PAYMENT]: ACCESS_LEVELS.NONE,
    },
    createdAt: '2025-01-02T00:00:00.000Z',
  },
  {
    id: 'user_viewer',
    name: 'Audit / Staff Viewer',
    email: 'viewer@passary.com',
    password: 'viewer123',
    role: 'user',
    department: 'Audit & Compliance',
    avatarColor: '#d97706',
    permissions: PAGE_CONFIG.reduce((acc, p) => ({ ...acc, [p.key]: ACCESS_LEVELS.VIEW }), {}),
    createdAt: '2025-01-03T00:00:00.000Z',
  },
];

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [users, setUsers] = useState(() => {
    try {
      const stored = localStorage.getItem(USERS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email) return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [loading, setLoading] = useState(false);

  // Sync users to local storage
  const saveUsers = (updatedUsers) => {
    setUsers(updatedUsers);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
    
    // Update currentUser if modified
    if (currentUser) {
      const active = updatedUsers.find(u => u.id === currentUser.id);
      if (active) {
        setCurrentUser(active);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(active));
      }
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    // simulate slight async feel for smoothness
    await new Promise(r => setTimeout(r, 200));

    const cleanEmail = (email || '').trim().toLowerCase();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      setLoading(false);
      throw new Error('User not found with this email address.');
    }

    if (user.password !== password) {
      setLoading(false);
      throw new Error('Incorrect password. Please try again.');
    }

    setCurrentUser(user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    setLoading(false);
    return user;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  /**
   * Check if the current user has view or full access to a specific page.
   * Admin always has access.
   */
  const hasPageAccess = (pageKey) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    const perm = currentUser.permissions?.[pageKey];
    if (perm === undefined) return true;
    return perm === ACCESS_LEVELS.VIEW || perm === ACCESS_LEVELS.FULL;
  };

  /**
   * Check if current user has full write/edit access (Add, Edit, Delete, Approve) to a specific page.
   * Admin always has write access.
   */
  const canEditPage = (pageKey) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    const perm = currentUser.permissions?.[pageKey];
    if (perm === undefined) return true;
    return perm === ACCESS_LEVELS.FULL;
  };

  /**
   * Get exact permission level: 'none' | 'view' | 'full'
   */
  const getPageAccessLevel = (pageKey) => {
    if (!currentUser) return ACCESS_LEVELS.NONE;
    if (currentUser.role === 'admin') return ACCESS_LEVELS.FULL;
    return currentUser.permissions?.[pageKey] || ACCESS_LEVELS.FULL;
  };

  // User Management functions (Admin only)
  const addUser = (userData) => {
    const newUser = {
      ...userData,
      id: `user_${Date.now()}`,
      createdAt: new Date().toISOString(),
      permissions: userData.permissions || PAGE_CONFIG.reduce((acc, p) => ({ ...acc, [p.key]: ACCESS_LEVELS.VIEW }), {}),
    };
    const updated = [...users, newUser];
    saveUsers(updated);
    return newUser;
  };

  const updateUser = (userId, updatedData) => {
    const updated = users.map(u => u.id === userId ? { ...u, ...updatedData, updatedAt: new Date().toISOString() } : u);
    saveUsers(updated);
  };

  const deleteUser = (userId) => {
    if (userId === currentUser?.id) {
      throw new Error('You cannot delete your own logged-in account.');
    }
    const target = users.find(u => u.id === userId);
    if (target?.email === 'admin@passary.com') {
      throw new Error('Super Admin account cannot be deleted.');
    }
    const updated = users.filter(u => u.id !== userId);
    saveUsers(updated);
  };

  const resetToDefaultUsers = () => {
    saveUsers(DEFAULT_USERS);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        loading,
        login,
        logout,
        hasPageAccess,
        canEditPage,
        getPageAccessLevel,
        addUser,
        updateUser,
        deleteUser,
        resetToDefaultUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
