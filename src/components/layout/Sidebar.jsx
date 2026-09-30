// components/layout/Sidebar.jsx
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Car, Shield, Wrench, AlertTriangle,
  Store, CheckCircle, Truck, CreditCard, FileWarning,
  ChevronLeft, ChevronRight, X, Users, Lock, Eye, Clock,
  ChevronDown
} from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  getRepairs, getVendorOffers, getClaims, getDeliveries,
  getPayments, getCars, getChallans, getFastags, onStoreUpdate, checkHasEmi
} from '../../store/dataStore';
import { isStage1Completed, isStage2Completed, isStage3Completed } from '../../utils/claimWorkflow';
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
      { to: '/vehicle-emi', label: 'Vehicle on EMI', icon: Clock, badgeKey: 'activeEmis', pageKey: PAGE_KEYS.VEHICLE_EMI },
      { to: '/challans', label: 'Challan', icon: AlertTriangle, badgeKey: 'challans', pageKey: PAGE_KEYS.CHALLANS },
      { to: '/fastags', label: 'Fastag', icon: CreditCard, badgeKey: 'fastag', pageKey: PAGE_KEYS.FASTAG },
    ],
  },
  {
    section: 'Insurance',
    items: [
      { to: '/insurance', label: 'Insurance', icon: Shield, pageKey: PAGE_KEYS.INSURANCE },
      {
        to: '/accident-claims',
        label: 'Accident / Insurance Claims',
        icon: AlertTriangle,
        badgeKey: 'claims',
        pageKey: PAGE_KEYS.ACCIDENT_CLAIMS,
        children: [
          { to: '/accident-claims/claim-of-accident', label: 'Claim of accident', stage: 'incident', badgeKey: 'claimsIncident' },
          { to: '/accident-claims/process-of-claim', label: 'Process of claim', stage: 'process', badgeKey: 'claimsProcess' },
          { to: '/accident-claims/claim-settlement', label: 'Claim settlement', stage: 'settlement', badgeKey: 'claimsSettled' },
        ]
      },
    ],
  },
  {
    section: 'Repair Management',
    items: [
      { to: '/car-repair', label: 'Car Repair', icon: Wrench, badgeKey: 'repairs', pageKey: PAGE_KEYS.CAR_REPAIR },
      { to: '/vendor-offers', label: 'Vendor Offers', icon: Store, badgeKey: 'offers', pageKey: PAGE_KEYS.VENDOR_OFFERS },
      { to: '/approvals', label: 'Approvals', icon: CheckCircle, badgeKey: 'approvals', pageKey: PAGE_KEYS.APPROVALS },
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
  const [openBranches, setOpenBranches] = useState(() => ({
    '/accident-claims': true
  }));

  const toggleBranch = (path, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOpenBranches(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const handleParentClick = (item, e) => {
    if (item.children && item.children.length > 0) {
      if (location.pathname.startsWith(item.to) && openBranches[item.to]) {
        e.preventDefault();
        setOpenBranches(prev => ({ ...prev, [item.to]: false }));
        return;
      }
      setOpenBranches(prev => ({ ...prev, [item.to]: true }));
    }
    setMobileOpen(false);
  };

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [repairs, offers, claims, deliveries, payments, cars, challans, fastags] = await Promise.all([
          getRepairs(), getVendorOffers(), getClaims(), getDeliveries(), getPayments(),
          getCars(), getChallans(), getFastags()
        ]);
        const missingFastagCount = cars.filter(c => {
          const hasFt = fastags.some(f => f.vehicleId === c.vehicleId || (c.registrationNo && f.registrationNo === c.registrationNo));
          return !hasFt;
        }).length;

        const activeEmiCount = cars.filter(c => checkHasEmi(c)).length;

        // Categorize claims by stage using 3-stage workflow
        const incidentPending = claims.filter(c => !isStage1Completed(c)).length;
        const processPending = claims.filter(c => isStage1Completed(c) && !isStage2Completed(c)).length;
        const settlementPending = claims.filter(c => isStage2Completed(c) && !isStage3Completed(c)).length;
        const totalPendingClaims = incidentPending + processPending + settlementPending;

        setCounts({
          repairs: repairs.filter(r => r.repairStatus !== 'Payment Completed').length,
          offers: offers.filter(o => o.approvalStatus === 'Pending').length,
          claims: totalPendingClaims > 0 ? totalPendingClaims : undefined,
          claimsIncident: incidentPending > 0 ? incidentPending : undefined,
          claimsProcess: processPending > 0 ? processPending : undefined,
          claimsSettled: settlementPending > 0 ? settlementPending : undefined,
          approvals: offers.filter(o => o.approvalStatus === 'Pending').length,
          deliveries: deliveries.filter(d => d.deliveryStatus === 'Delivery Pending').length,
          payments: payments.filter(p => p.paymentStatus === 'Payment Pending').length,
          challans: challans.filter(c => c.paymentStatus === 'Pending').length,
          fastag: missingFastagCount > 0 ? missingFastagCount : undefined,
          activeEmis: activeEmiCount > 0 ? activeEmiCount : undefined,
        });
      } catch {
        // silent fallback
      }
    };
    fetchCounts();
    const unsub = onStoreUpdate(fetchCounts);
    return () => unsub();
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
        {/* Logo & Header */}
        <div
          className="sidebar-logo"
          style={{
            cursor: collapsed ? 'pointer' : 'default',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '12px 10px 8px' : '14px 14px',
            flexDirection: 'column',
            gap: 8
          }}
          onClick={collapsed ? () => setCollapsed(false) : undefined}
          title={collapsed ? "Click to expand sidebar" : undefined}
        >
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: '#ffffff', border: '1.5px solid #e2f0e7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: '0 3px 8px rgba(5, 150, 105, 0.12)',
              overflow: 'hidden', padding: 3
            }}>
              <img src="/passary-logo.png" alt="Passary Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>

            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a', lineHeight: 1.2, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>
                  Passary <span style={{ color: '#059669' }}>Car System</span>
                </div>
              </div>
            )}

            {!collapsed && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCollapsed(true); setMobileOpen(false); }}
                style={{
                  marginLeft: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: 8, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#64748b', flexShrink: 0, transition: 'all 0.15s'
                }}
                title="Collapse sidebar"
              >
                <ChevronLeft size={14} />
              </button>
            )}

            {mobileOpen && (
              <button onClick={() => setMobileOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginLeft: 4 }}>
                <X size={18} />
              </button>
            )}
          </div>

          {/* Prominent Expand Button when sidebar is collapsed */}
          {collapsed && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCollapsed(false); }}
              style={{
                background: '#ecfdf5',
                border: '1.5px solid #a7f3d0',
                borderRadius: 8,
                width: 36,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#059669',
                transition: 'all 0.2s',
                boxShadow: '0 2px 5px rgba(5, 150, 105, 0.15)'
              }}
              title="Expand Sidebar"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
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
              {group.items.map((item) => {
                const { to, label, icon: Icon, badgeKey, pageKey, children } = item;
                const isActive = to === '/'
                  ? location.pathname === '/'
                  : location.pathname === to || location.pathname.startsWith(`${to}/`);
                const count = counts[badgeKey];
                const accessLevel = getPageAccessLevel(pageKey);
                const isViewOnly = accessLevel === ACCESS_LEVELS.VIEW && !isAdmin;
                const hasChildren = Boolean(children && children.length > 0);
                const isBranchOpen = Boolean(openBranches[to]);

                return (
                  <div key={to} className="tooltip-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
                    <NavLink
                      to={to}
                      end={!hasChildren}
                      className={({ isActive: routerActive }) => `nav-item ${isActive || routerActive ? 'active' : ''}`}
                      onClick={(e) => handleParentClick(item, e)}
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
                      {!collapsed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {count !== undefined && count > 0 && (
                            <span className="nav-badge-pill">{count}</span>
                          )}
                          {hasChildren && (
                            <button
                              type="button"
                              onClick={(e) => toggleBranch(to, e)}
                              className="nav-chevron-btn"
                              title={isBranchOpen ? "Hide branch" : "Show branch"}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 2,
                                cursor: 'pointer',
                                color: 'inherit',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <ChevronDown
                                size={14}
                                className="nav-chevron-icon"
                                style={{
                                  transform: isBranchOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                                }}
                              />
                            </button>
                          )}
                        </div>
                      )}
                    </NavLink>
                    {collapsed && <div className="tooltip">{label} {isViewOnly ? '(View Only)' : ''}</div>}

                    {/* Collapsible Branches */}
                    {!collapsed && hasChildren && isBranchOpen && (
                      <div className="nav-branch-list">
                        {children.map(subItem => {
                          const isSubActive = location.pathname === subItem.to;
                          const subCount = counts[subItem.badgeKey];
                          return (
                            <NavLink
                              key={subItem.to}
                              to={subItem.to}
                              className={({ isActive: rActive }) => `nav-sub-item ${rActive || isSubActive ? 'active' : ''}`}
                              onClick={() => setMobileOpen(false)}
                            >
                              <div className="nav-sub-item-content">
                                <span className="nav-sub-bullet" />
                                <span>{subItem.label}</span>
                              </div>
                              {subCount !== undefined && subCount > 0 && (
                                <span className="nav-sub-badge">{subCount}</span>
                              )}
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
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
          <div className="sidebar-footer">
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
