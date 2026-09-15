// pages/UserManagement.jsx
import { useState, useEffect } from 'react';
import { useAuth, PAGE_CONFIG, ACCESS_LEVELS } from '../context/AuthContext';
import { syncAllFromSheets } from '../store/dataStore';
import {
  Users, UserPlus, Shield, Key, Edit2, Trash2, CheckCircle2,
  XCircle, Eye, ShieldCheck, Lock, Search, Filter, AlertTriangle, UserCheck,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';

const EMPTY_USER = {
  name: '',
  email: '',
  password: '',
  department: 'Operations',
  role: 'user', // 'admin' | 'user'
  permissions: PAGE_CONFIG.reduce((acc, p) => ({ ...acc, [p.key]: ACCESS_LEVELS.VIEW }), {}),
};

const DEPARTMENTS = [
  'Operations',
  'Management',
  'Finance',
  'HR',
  'Audit & Compliance',
  'Logistics',
  'Sales',
  'IT',
];

export default function UserManagement() {
  const { users, currentUser, addUser, updateUser, deleteUser, syncWithSheetNow } = useAuth();
  
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'add' | 'edit'
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_USER });
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [syncingSheet, setSyncingSheet] = useState(false);

  useEffect(() => {
    syncWithSheetNow().catch(() => {});
    syncAllFromSheets(true).catch(() => {});
  }, []);

  const handleSyncSheet = async () => {
    setSyncingSheet(true);
    try {
      const [res] = await Promise.all([
        syncWithSheetNow(),
        syncAllFromSheets(true)
      ]);
      if (res && res.length > 0) {
        toast.success(`Successfully synced ${res.length} user(s) from Google Sheet!`);
      } else {
        toast.error('Could not fetch from sheet or "Login Page" is empty.');
      }
    } catch (err) {
      toast.error('Sync failed: ' + err.message);
    } finally {
      setSyncingSheet(false);
    }
  };

  const openAddModal = () => {
    setSelectedUser(null);
    setForm({
      ...EMPTY_USER,
      permissions: PAGE_CONFIG.reduce((acc, p) => ({ ...acc, [p.key]: ACCESS_LEVELS.VIEW }), {}),
    });
    setModal('add');
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: user.password || '',
      department: user.department || 'Operations',
      role: user.role || 'user',
      permissions: user.permissions || PAGE_CONFIG.reduce((acc, p) => ({ ...acc, [p.key]: ACCESS_LEVELS.VIEW }), {}),
    });
    setModal('edit');
  };

  const handleSetPermission = (pageKey, level) => {
    setForm(f => ({
      ...f,
      permissions: {
        ...f.permissions,
        [pageKey]: level,
      },
    }));
  };

  const handleApplyPreset = (presetType) => {
    if (presetType === 'all_full') {
      const fullPerms = PAGE_CONFIG.reduce((acc, p) => ({ ...acc, [p.key]: ACCESS_LEVELS.FULL }), {});
      setForm(f => ({ ...f, permissions: fullPerms }));
      toast.success('Applied Full Access to all pages');
    } else if (presetType === 'all_view') {
      const viewPerms = PAGE_CONFIG.reduce((acc, p) => ({ ...acc, [p.key]: ACCESS_LEVELS.VIEW }), {});
      setForm(f => ({ ...f, permissions: viewPerms }));
      toast.success('Applied View Only access to all pages');
    } else if (presetType === 'all_none') {
      const nonePerms = PAGE_CONFIG.reduce((acc, p) => ({ ...acc, [p.key]: ACCESS_LEVELS.NONE }), {});
      setForm(f => ({ ...f, permissions: nonePerms }));
      toast.success('Cleared access for all pages');
    } else if (presetType === 'ops_manager') {
      setForm(f => ({
        ...f,
        permissions: {
          dashboard: ACCESS_LEVELS.FULL,
          purchase_car: ACCESS_LEVELS.VIEW,
          insurance: ACCESS_LEVELS.VIEW,
          car_repair: ACCESS_LEVELS.FULL,
          accident_claims: ACCESS_LEVELS.FULL,
          vendor_offers: ACCESS_LEVELS.FULL,
          approvals: ACCESS_LEVELS.NONE,
          delivery: ACCESS_LEVELS.FULL,
          payment: ACCESS_LEVELS.NONE,
        }
      }));
      toast.success('Applied Operations Manager template');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Please provide the full name.');
      return;
    }
    if (!form.email.trim()) {
      toast.error('Please enter an email address.');
      return;
    }
    if (!form.password.trim()) {
      toast.error('Please set a password.');
      return;
    }

    // Check email uniqueness
    const emailExists = users.some(u => 
      u.email.toLowerCase() === form.email.trim().toLowerCase() && 
      (!selectedUser || u.id !== selectedUser.id)
    );
    if (emailExists) {
      toast.error('A user with this email address already exists.');
      return;
    }

    try {
      if (modal === 'add') {
        addUser(form);
        toast.success(`User "${form.name}" created successfully!`);
      } else {
        updateUser(selectedUser.id, form);
        toast.success(`User "${form.name}" updated successfully!`);
      }
      setModal(null);
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleDeleteUser = () => {
    if (!deleteDialog) return;
    try {
      deleteUser(deleteDialog.id);
      toast.success(`User "${deleteDialog.name}" deleted.`);
      setDeleteDialog(null);
    } catch (err) {
      toast.error(err.message || 'Could not delete user.');
    }
  };

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q);
  });

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-outline"
            onClick={handleSyncSheet}
            disabled={syncingSheet}
            title="Refresh & sync with Google Sheet"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={15} className={syncingSheet ? 'animate-spin' : ''} />
            <span>{syncingSheet ? 'Syncing...' : 'Refresh / Sync'}</span>
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <UserPlus size={16} strokeWidth={2.5} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="data-table-container">
        {/* Search Bar */}
        <div className="filter-bar">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              placeholder="Search users by name, email, department..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
            Showing {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Users Table */}
        <div style={{ overflowX: 'auto' }}>
          {filteredUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users found"
              message="Create your first staff user or adjust your search term."
              action={
                <button className="btn btn-primary" onClick={openAddModal}>
                  <UserPlus size={14} /> Add New User
                </button>
              }
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>User & Email</th>
                  <th>Department</th>
                  <th>System Role</th>
                  <th>Page-Wise Access Summary</th>
                  <th>Password</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const isAdmin = user.role === 'admin';
                  let fullCount = 0;
                  let viewCount = 0;
                  let noneCount = 0;

                  if (isAdmin) {
                    fullCount = PAGE_CONFIG.length;
                  } else if (user.permissions) {
                    PAGE_CONFIG.forEach(p => {
                      const perm = user.permissions[p.key];
                      if (perm === ACCESS_LEVELS.FULL) fullCount++;
                      else if (perm === ACCESS_LEVELS.VIEW) viewCount++;
                      else noneCount++;
                    });
                  }

                  const isMe = currentUser?.id === user.id;

                  return (
                    <tr key={user.id}>
                      {/* Name & Avatar */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            background: isAdmin ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: 15,
                            flexShrink: 0,
                            boxShadow: '0 3px 8px rgba(0,0,0,0.1)',
                          }}>
                            {user.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{user.name}</span>
                              {isMe && (
                                <span style={{
                                  fontSize: 10,
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: 6,
                                }}>
                                  You
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>
                          {user.department || 'Operations'}
                        </span>
                      </td>

                      {/* System Role */}
                      <td>
                        {isAdmin ? (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            background: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            borderRadius: 20,
                            color: '#065f46',
                            fontSize: 12,
                            fontWeight: 800,
                          }}>
                            <ShieldCheck size={14} color="#059669" />
                            <span>Super Admin</span>
                          </div>
                        ) : (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: 20,
                            color: '#475569',
                            fontSize: 12,
                            fontWeight: 700,
                          }}>
                            <UserCheck size={14} color="#64748b" />
                            <span>Staff User</span>
                          </div>
                        )}
                      </td>

                      {/* Permissions Breakdown */}
                      <td>
                        {isAdmin ? (
                          <span style={{
                            fontSize: 12,
                            color: '#059669',
                            fontWeight: 700,
                            background: '#f0fdf4',
                            padding: '3px 8px',
                            borderRadius: 8,
                            border: '1px solid #bbf7d0',
                          }}>
                            Full Access to all 9 Modules
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {fullCount > 0 && (
                              <span style={{
                                fontSize: 11.5,
                                background: '#dcfce7',
                                color: '#166534',
                                padding: '2px 7px',
                                borderRadius: 6,
                                fontWeight: 700,
                              }}>
                                {fullCount} Full
                              </span>
                            )}
                            {viewCount > 0 && (
                              <span style={{
                                fontSize: 11.5,
                                background: '#fef3c7',
                                color: '#92400e',
                                padding: '2px 7px',
                                borderRadius: 6,
                                fontWeight: 700,
                              }}>
                                {viewCount} View
                              </span>
                            )}
                            {noneCount > 0 && (
                              <span style={{
                                fontSize: 11.5,
                                background: '#fee2e2',
                                color: '#991b1b',
                                padding: '2px 7px',
                                borderRadius: 6,
                                fontWeight: 700,
                              }}>
                                {noneCount} Hidden
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Password Preview */}
                      <td>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: 12.5,
                          background: '#f8fafc',
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: '1px solid #e2e8f0',
                          color: '#475569',
                          fontWeight: 600,
                        }}>
                          {user.password}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            className="btn btn-ghost btn-xs"
                            title="Edit User & Permissions"
                            onClick={() => openEditModal(user)}
                          >
                            <Edit2 size={15} />
                          </button>
                          
                          {/* Protect Super Admin & Current User from accidental delete */}
                          {user.email !== 'admin@passary.com' && !isMe && (
                            <button
                              className="btn btn-ghost btn-xs"
                              title="Delete User"
                              style={{ color: '#ef4444' }}
                              onClick={() => setDeleteDialog(user)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* User Add / Edit Modal */}
      {modal && (
        <Modal
          isOpen={true}
          onClose={() => setModal(null)}
          title={modal === 'add' ? 'Create New User & Set Permissions' : `Edit User: ${selectedUser?.name}`}
          size="lg"
        >
          <form onSubmit={handleSubmit}>
            {/* Account Details Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="form-group">
                <label className="form-label">Full Name <span className="required">*</span></label>
                <input
                  className="form-input"
                  placeholder="e.g. Ramesh Sharma"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address <span className="required">*</span></label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="ramesh@passary.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password <span className="required">*</span></label>
                <input
                  className="form-input"
                  placeholder="Enter secure password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                <select
                  className="form-select"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">System Role</label>
                <select
                  className="form-select"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="user">Staff User (Custom Page Permissions)</option>
                  <option value="admin">Super Admin (All Access + User Management)</option>
                </select>
              </div>
            </div>

            {/* Page-Wise Permissions Section */}
            {form.role === 'admin' ? (
              <div style={{
                background: '#ecfdf5',
                border: '1.5px solid #a7f3d0',
                borderRadius: 14,
                padding: '16px 20px',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <ShieldCheck size={28} color="#059669" />
                <div>
                  <div style={{ fontWeight: 800, color: '#065f46', fontSize: 14 }}>
                    Super Admin Role Selected
                  </div>
                  <div style={{ fontSize: 12.5, color: '#047857' }}>
                    Admins automatically have 100% full access to all pages (View, Add, Edit, Delete, Approvals) and User Management.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 10,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                      Page-Wise Access Matrix
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Choose granular access level for each module in the system.
                    </div>
                  </div>

                  {/* Preset quick buttons */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => handleApplyPreset('all_full')}
                      style={{ fontSize: 11, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}
                    >
                      All Full Access
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => handleApplyPreset('all_view')}
                      style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
                    >
                      All View Only
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => handleApplyPreset('all_none')}
                      style={{ fontSize: 11, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}
                    >
                      Hide All
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => handleApplyPreset('ops_manager')}
                      style={{ fontSize: 11, background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}
                    >
                      Operations Preset
                    </button>
                  </div>
                </div>

                {/* Permissions Table Grid */}
                <div style={{
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 14,
                  overflow: 'hidden',
                  background: '#ffffff',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 800, color: '#334155' }}>
                          Module / Page Name
                        </th>
                        <th style={{ padding: '10px 16px', textAlign: 'center', width: 340, fontWeight: 800, color: '#334155' }}>
                          Access Level
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {PAGE_CONFIG.map((page, idx) => {
                        const currentLevel = form.permissions?.[page.key] || ACCESS_LEVELS.NONE;

                        return (
                          <tr
                            key={page.key}
                            style={{
                              borderBottom: idx === PAGE_CONFIG.length - 1 ? 'none' : '1px solid #f1f5f9',
                              background: currentLevel === ACCESS_LEVELS.FULL ? '#fcfdfd' : '#ffffff',
                            }}
                          >
                            <td style={{ padding: '10px 16px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{page.label}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>Path: {page.path}</div>
                            </td>

                            <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                              <div style={{
                                display: 'inline-flex',
                                background: '#f1f5f9',
                                padding: 3,
                                borderRadius: 10,
                                border: '1px solid #e2e8f0',
                                gap: 2,
                              }}>
                                {/* None Option */}
                                <button
                                  type="button"
                                  onClick={() => handleSetPermission(page.key, ACCESS_LEVELS.NONE)}
                                  style={{
                                    padding: '5px 12px',
                                    borderRadius: 7,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    background: currentLevel === ACCESS_LEVELS.NONE ? '#ef4444' : 'transparent',
                                    color: currentLevel === ACCESS_LEVELS.NONE ? '#ffffff' : '#64748b',
                                    boxShadow: currentLevel === ACCESS_LEVELS.NONE ? '0 2px 6px rgba(239, 68, 68, 0.3)' : 'none',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <XCircle size={13} />
                                  <span>None</span>
                                </button>

                                {/* View Option */}
                                <button
                                  type="button"
                                  onClick={() => handleSetPermission(page.key, ACCESS_LEVELS.VIEW)}
                                  style={{
                                    padding: '5px 12px',
                                    borderRadius: 7,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    background: currentLevel === ACCESS_LEVELS.VIEW ? '#f59e0b' : 'transparent',
                                    color: currentLevel === ACCESS_LEVELS.VIEW ? '#ffffff' : '#64748b',
                                    boxShadow: currentLevel === ACCESS_LEVELS.VIEW ? '0 2px 6px rgba(245, 158, 11, 0.3)' : 'none',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <Eye size={13} />
                                  <span>View Only</span>
                                </button>

                                {/* Full Option */}
                                <button
                                  type="button"
                                  onClick={() => handleSetPermission(page.key, ACCESS_LEVELS.FULL)}
                                  style={{
                                    padding: '5px 12px',
                                    borderRadius: 7,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    background: currentLevel === ACCESS_LEVELS.FULL ? '#059669' : 'transparent',
                                    color: currentLevel === ACCESS_LEVELS.FULL ? '#ffffff' : '#64748b',
                                    boxShadow: currentLevel === ACCESS_LEVELS.FULL ? '0 2px 6px rgba(5, 150, 105, 0.3)' : 'none',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Full Access</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="modal-footer" style={{ padding: '16px 0 0' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {modal === 'add' ? 'Create Account' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete User Confirmation Dialog */}
      {deleteDialog && (
        <ConfirmDialog
          isOpen={true}
          title="Delete User Account"
          message={`Are you sure you want to delete "${deleteDialog.name}" (${deleteDialog.email})? This action cannot be undone.`}
          confirmLabel="Delete User"
          variant="danger"
          onConfirm={handleDeleteUser}
          onClose={() => setDeleteDialog(null)}
        />
      )}
    </div>
  );
}
