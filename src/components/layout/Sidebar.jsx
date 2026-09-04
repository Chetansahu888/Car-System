// components/layout/Sidebar.jsx
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Car, Shield, Wrench, AlertTriangle,
  Store, CheckCircle, Truck, CreditCard,
  ChevronLeft, ChevronRight, X, Users, Lock, Eye
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { getRepairs, getVendorOffers, getClaims, getDeliveries, getPayments } from '../../store/dataStore';
import { useAuth, PAGE_KEYS, ACCESS_LEVELS } from '../../context/AuthContext';

const NAV_GROUPS = [
  {
    section: null,
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, pageKey: PAGE_KEYS.DASHBOARD },
    ],
  },
  {
    section: 'Vehicles',
    items: [
      { to: '/purchase-car', label: 'Purchase Car', icon: Car, pageKey: PAGE_KEYS.PURCHASE_CAR },
    ],
  },
  {
    section: 'Insurance',
    items: [
      { to: '/insurance', label: 'Insurance', icon: Shield, pageKey: PAGE_KEYS.INSURANCE },
    ],
  },
  {
    section: 'Repair Management',
    items: [
      { to: '/car-repair', label: 'Car Repair', icon: Wrench, badgeKey: 'repairs', pageKey: PAGE_KEYS.CAR_REPAIR },
      { to: '/accident-claims', label: 'Accident / Claims', icon: AlertTriangle, badgeKey: 'claims', pageKey: PAGE_KEYS.ACCIDENT_CLAIMS },
      { to: '/vendor-offers', label: 'Vendor Offers', icon: Store, badgeKey: 'offers', pageKey: PAGE_KEYS.VENDOR_OFFERS },
    ],
  },
  {
    section: 'Approval',
    items: [
      { to: '/approvals', label: 'Approvals', icon: CheckCircle, badgeKey: 'approvals', pageKey: PAGE_KEYS.APPROVALS },
    ],
  },
  {
    section: 'Delivery',
    items: [
      { to: '/delivery', label: 'Delivery Of Car', icon: Truck, badgeKey: 'deliveries', pageKey: PAGE_KEYS.DELIVERY },
    ],
  },
  {
    section: 'Finance',
    items: [
      { to: '/payment', label: 'Payment', icon: CreditCard, badgeKey: 'payments', pageKey: PAGE_KEYS.PAYMENT },
    ],
  },
];

const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) => {
  const location = useLocation();
  const { currentUser, hasPageAccess, getPageAccessLevel } = useAuth();
  const [counts, setCounts] = useState({});

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [repairs, offers, claims, deliveries, payments] = await Promise.all([
          getRepairs(), getVendorOffers(), getClaims(), getDeliveries(), getPayments()
        ]);
        setCounts({
          repairs: repairs.filter(r => r.repairStatus !== 'Payment Completed').length,
          offers: offers.filter(o => o.approvalStatus === 'Pending').length,
          claims: claims.filter(c => !['Settled', 'Rejected'].includes(c.claimStatus)).length,
          approvals: offers.filter(o => o.approvalStatus === 'Pending').length,
          deliveries: deliveries.filter(d => d.deliveryStatus === 'Delivery Pending').length,
          payments: payments.filter(p => p.paymentStatus === 'Payment Pending').length,
        });
      } catch {
        // silent fallback
      }
    };
    fetchCounts();
  }, [location.pathname]);

  // Filter navigation items by user permissions
  const visibleGroups = NAV_GROUPS.map(group => {
    const accessibleItems = group.items.filter(item => hasPageAccess(item.pageKey));
    return { ...group, items: accessibleItems };
  }).filter(group => group.items.length > 0);

  const isAdmin = currentUser?.role === 'admin';

  return (
    <>
      {/* Mobile overlay */}
      <div className={`sidebar-overlay ${mobileOpen ? 'visible' : ''}`} onClick={() => setMobileOpen(false)} />

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: '#ffffff', border: '1.5px solid #e2f0e7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 3px 8px rgba(5, 150, 105, 0.12)',
            overflow: 'hidden', padding: 4
          }}>
            <img src="/passary-logo.png" alt="Passary Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.2, letterSpacing: -0.2 }}>
                Passary <span style={{ color: '#059669' }}>Car System</span>
              </div>
            </div>
          )}

          <button
            onClick={() => { setCollapsed(!collapsed); setMobileOpen(false); }}
            style={{
              marginLeft: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#64748b', flexShrink: 0, transition: 'all 0.15s'
            }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          
          {mobileOpen && (
            <button onClick={() => setMobileOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginLeft: 4 }}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {visibleGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 6 }}>
              {group.section && !collapsed && (
                <div className="nav-section-label">{group.section}</div>
              )}
              {group.items.map(({ to, label, icon: Icon, badgeKey, pageKey }) => {
                const isActive = to === '/'
                  ? location.pathname === '/'
                  : location.pathname === to || location.pathname.startsWith(`${to}/`);
                const count = counts[badgeKey];
                const accessLevel = getPageAccessLevel(pageKey);
                const isViewOnly = accessLevel === ACCESS_LEVELS.VIEW && !isAdmin;

                return (
                  <div key={to} className="tooltip-wrap">
                    <NavLink
                      to={to}
                      end
                      className={({ isActive: routerActive }) => `nav-item ${isActive || routerActive ? 'active' : ''}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      <div className="nav-item-content">
                        <Icon size={18} className="icon" strokeWidth={isActive ? 2.3 : 1.8} />
                        {!collapsed && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{label}</span>
                            {isViewOnly && (
                              <span style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#d97706',
                                background: '#fef3c7',
                                padding: '1px 5px',
                                borderRadius: 4,
                              }}>
                                View
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {!collapsed && count !== undefined && count > 0 && (
                        <span className="nav-badge-pill">{count}</span>
                      )}
                    </NavLink>
                    {collapsed && <div className="tooltip">{label} {isViewOnly ? '(View Only)' : ''}</div>}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Admin Exclusive User Management Menu */}
          {isAdmin && (
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
              {!collapsed && (
                <div className="nav-section-label" style={{ color: '#059669' }}>
                  Administration
                </div>
              )}
              <div className="tooltip-wrap">
                <NavLink
                  to="/users"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <div className="nav-item-content">
                    <Users size={18} className="icon" color="#059669" />
                    {!collapsed && <span>User & Roles</span>}
                  </div>
                </NavLink>
                {collapsed && <div className="tooltip">User Management</div>}
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', marginTop: 'auto', background: '#fafcfb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isAdmin ? '#059669' : '#3b82f6',
              }} />
              <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
                {isAdmin ? 'Super Admin Mode' : `${currentUser?.name || 'Staff User'}`}
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
