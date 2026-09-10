// pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car, Shield, AlertTriangle, Wrench, Store, CheckCircle,
  Truck, Package, CreditCard, TrendingUp, Clock, XCircle,
  AlertCircle, Activity, ChevronRight, RefreshCw, Calendar,
  Bell, ArrowRight, Sparkles
} from 'lucide-react';
import {
  getCars, getInsurance, getRepairs, getClaims,
  getVendorOffers, getDeliveries, getPayments, syncAllFromSheets, onStoreUpdate
} from '../store/dataStore';
import { daysUntil, formatDate } from '../utils/dateUtils';
import Badge from '../components/ui/Badge';
import SpeedingCarLoader from '../components/ui/SpeedingCarLoader';

const StatCard = ({ icon: Icon, label, value, sub, color, bgColor, onClick, alert }) => (
  <div className="stat-card" onClick={onClick} style={{ cursor: 'pointer' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
      <div className="icon-wrap" style={{ background: bgColor, color }}>
        <Icon size={22} strokeWidth={2.2} />
      </div>
      {alert && (
        <span style={{
          fontSize: 10, fontWeight: 800, color: '#dc2626',
          background: '#fee2e2', padding: '3px 8px', borderRadius: 20,
          border: '1px solid #fecaca'
        }}>
          ALERT
        </span>
      )}
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, fontWeight: 600 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color, marginTop: 6, fontWeight: 700 }}>{sub}</div>}
  </div>
);

const AlertBanner = ({ icon: Icon, children, type = 'warning' }) => (
  <div className={`alert-banner ${type}`} style={{ marginBottom: 12 }}>
    <Icon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
    <span style={{ lineHeight: 1.5 }}>{children}</span>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({
    cars: [], insurance: [], repairs: [], claims: [],
    vendorOffers: [], deliveries: [], payments: []
  });
  const [loading, setLoading] = useState(true);

  const load = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    const [cars, insurance, repairs, claims, vendorOffers, deliveries, payments] = await Promise.all([
      getCars(), getInsurance(), getRepairs(), getClaims(),
      getVendorOffers(), getDeliveries(), getPayments()
    ]);
    setData({ cars, insurance, repairs, claims, vendorOffers, deliveries, payments });
    if (isInitial) setLoading(false);
    syncAllFromSheets(true);
  };

  useEffect(() => {
    load(true);
    const unsub = onStoreUpdate(() => {
      load(false);
    });
    return unsub;
  }, []);

  const { cars, insurance, repairs, claims, vendorOffers, deliveries, payments } = data;

  // ─── 1. Expected Delivery Date 2-Day Reminder Logic ─────────────────────────
  const deliveredRepairNos = new Set(
    deliveries.filter(d => d.deliveryStatus === 'Delivery Submitted' || d.deliveredAt || d.actualDate3).map(d => d.repairNo)
  );

  const deliveryDueAlerts = repairs.filter(r => {
    const isDelivered = !!(r.actualDate3 || deliveredRepairNos.has(r.repairNo) || r.repairStatus === 'Delivered' || r.repairStatus === 'Delivery Submitted' || r.repairStatus === 'Payment Completed');
    if (isDelivered) return false;

    const offer = vendorOffers.find(v => v.repairNo === r.repairNo);
    const expDate = r.expectedCompletionDate || offer?.expectedCompletionDate;
    if (!expDate) return false;

    const days = daysUntil(expDate);
    // Alert if 2 days or less remaining (today, tomorrow, in 2 days, or overdue)
    return days !== null && days <= 2;
  }).map(r => {
    const offer = vendorOffers.find(v => v.repairNo === r.repairNo);
    const expDate = r.expectedCompletionDate || offer?.expectedCompletionDate;
    const days = daysUntil(expDate);
    return {
      ...r,
      expectedCompletionDate: expDate,
      daysRemaining: days,
      garageName: r.garageName || offer?.garageName || r.garage || '—',
    };
  });

  // ─── 2. Insurance & Other Metrics ───────────────────────────────────────────
  const insuredVehicleIds = new Set(insurance.map(i => i.vehicleId));
  const totalInsuranceActive = insurance.filter(i => {
    const d = daysUntil(i.renewalDate || i.validityDate);
    return d !== null && d > 7;
  }).length;
  
  const renewalDue7Days = insurance.filter(i => {
    const d = daysUntil(i.renewalDate || i.validityDate);
    return d !== null && d >= 0 && d <= 7;
  }).length;

  const insuranceExpired = insurance.filter(i => {
    const d = daysUntil(i.renewalDate || i.validityDate);
    return d !== null && d < 0;
  }).length;

  const insuranceNotAvailable = cars.filter(c => !insuredVehicleIds.has(c.vehicleId)).length;
  const activeRepairs = repairs.filter(r => !['Delivery Submitted', 'Payment Completed', 'Delivered'].includes(r.repairStatus)).length;
  const claimsPending = claims.filter(c => !['Settled', 'Rejected'].includes(c.claimStatus)).length;
  const vendorPending = vendorOffers.filter(v => v.approvalStatus === 'Pending').length;
  const approvalPending = vendorOffers.filter(v => v.approvalStatus === 'Pending').length;
  const deliveryPending = repairs.filter(r => {
    const offer = vendorOffers.find(v => v.repairNo === r.repairNo);
    const isApproved = r.repairStatus === 'Approved' || offer?.approvalStatus === 'Approved' || r.actualDate2 || offer?.actualDate2;
    return isApproved && !deliveredRepairNos.has(r.repairNo);
  }).length;

  const paymentPending = payments.filter(p => p.paymentStatus === 'Payment Pending').length;
  const paymentCompleted = payments.filter(p => p.paymentStatus === 'Payment Completed').length;

  const cards = [
    { icon: Car, label: 'Total Vehicles', value: cars.length, color: '#059669', bgColor: '#ecfdf5', path: '/purchase-car' },
    { icon: Bell, label: 'Delivery Due (≤ 2 Days)', value: deliveryDueAlerts.length, color: '#7c3aed', bgColor: '#f5f3ff', path: '/delivery', alert: deliveryDueAlerts.length > 0, sub: deliveryDueAlerts.length > 0 ? `${deliveryDueAlerts.length} Due Soon` : 'On Schedule' },
    { icon: Shield, label: 'Insurance Active', value: totalInsuranceActive, color: '#16a34a', bgColor: '#dcfce7', path: '/insurance' },
    { icon: Clock, label: '7-Day Renewal Due', value: renewalDue7Days, color: '#d97706', bgColor: '#fef3c7', path: '/insurance', alert: renewalDue7Days > 0 },
    { icon: XCircle, label: 'Insurance Not Available', value: insuranceNotAvailable, color: '#dc2626', bgColor: '#fee2e2', path: '/insurance', alert: insuranceNotAvailable > 0 },
    { icon: Wrench, label: 'Active Repairs', value: activeRepairs, color: '#0284c7', bgColor: '#e0f2fe', path: '/car-repair' },
    { icon: AlertTriangle, label: 'Accident Claims', value: claims.length, color: '#ea580c', bgColor: '#ffedd5', path: '/accident-claims' },
    { icon: Store, label: 'Vendor Offers Pending', value: vendorPending, color: '#0891b2', bgColor: '#cffafe', path: '/vendor-offers' },
    { icon: CheckCircle, label: 'Approval Pending', value: approvalPending, color: '#dc2626', bgColor: '#fee2e2', path: '/approvals', alert: approvalPending > 0 },
    { icon: Truck, label: 'Pending Delivery', value: deliveryPending, color: '#059669', bgColor: '#ecfdf5', path: '/delivery' },
    { icon: CreditCard, label: 'Payment Pending', value: paymentPending, color: '#d97706', bgColor: '#fef3c7', path: '/payment', alert: paymentPending > 0 },
    { icon: TrendingUp, label: 'Payment Completed', value: paymentCompleted, color: '#059669', bgColor: '#dcfce7', path: '/payment' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <SpeedingCarLoader size="medium" />
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #059669, #047857)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
          }}>
            <Activity size={24} color="white" />
          </div>
          <div>
            <h1 className="page-title">Car Dashboard</h1>
            <p className="page-subtitle">Real-time enterprise overview of company vehicles, delivery reminders & workflows</p>
          </div>
        </div>
      </div>

      {/* ─── 2-DAY DELIVERY REMINDER BANNER ─── */}
      {deliveryDueAlerts.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
          border: '1.5px solid #c4b5fd', borderRadius: 16,
          padding: '16px 20px', marginBottom: 24,
          boxShadow: '0 4px 16px rgba(124, 58, 237, 0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, background: '#7c3aed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
            }}>
              <Bell size={22} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#4c1d95', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Delivery Reminder: {deliveryDueAlerts.length} Vehicle(s) Due Within 2 Days</span>
                <span style={{ fontSize: 11, background: '#7c3aed', color: 'white', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                  URGENT
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: '#5b21b6', marginTop: 2 }}>
                {deliveryDueAlerts.map(d => `${d.repairNo} (${d.carName} — ${d.daysRemaining === 0 ? 'Today' : d.daysRemaining === 1 ? 'Tomorrow' : d.daysRemaining < 0 ? 'Overdue' : 'in 2 days'})`).join(' • ')}
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/delivery')}
            className="btn btn-primary"
            style={{
              background: '#7c3aed', borderColor: '#6d28d9',
              display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700
            }}
          >
            <Truck size={15} /> Open Delivery Page <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Action Required Alerts */}
      {(insuranceNotAvailable > 0 || renewalDue7Days > 0 || insuranceExpired > 0 || approvalPending > 0 || paymentPending > 0) && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            ⚡ Action Required
          </div>
          {renewalDue7Days > 0 && (
            <AlertBanner icon={Clock} type="warning">
              <strong>{renewalDue7Days} vehicle(s)</strong> are within the <strong>7-Day Renewal Window</strong> — <button onClick={() => navigate('/insurance')} style={{ background: 'none', border: 'none', color: '#92400e', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}>Update Renewal Now</button>
            </AlertBanner>
          )}
          {insuranceExpired > 0 && (
            <AlertBanner icon={XCircle} type="danger">
              <strong>{insuranceExpired} vehicle(s)</strong> have expired insurance policies — <button onClick={() => navigate('/insurance')} style={{ background: 'none', border: 'none', color: '#b91c1c', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}>Renew Immediately</button>
            </AlertBanner>
          )}
          {insuranceNotAvailable > 0 && (
            <AlertBanner icon={XCircle} type="danger">
              {insuranceNotAvailable} vehicle{insuranceNotAvailable > 1 ? 's have' : ' has'} no insurance — <button onClick={() => navigate('/insurance')} style={{ background: 'none', border: 'none', color: '#b91c1c', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}>Add Policy</button>
            </AlertBanner>
          )}
          {approvalPending > 0 && (
            <AlertBanner icon={AlertCircle} type="warning">
              {approvalPending} vendor offer{approvalPending > 1 ? 's' : ''} awaiting approval — <button onClick={() => navigate('/approvals')} style={{ background: 'none', border: 'none', color: '#92400e', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}>Review Now</button>
            </AlertBanner>
          )}
          {paymentPending > 0 && (
            <AlertBanner icon={CreditCard} type="info">
              {paymentPending} payment{paymentPending > 1 ? 's' : ''} pending — <button onClick={() => navigate('/payment')} style={{ background: 'none', border: 'none', color: '#065f46', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}>Process Payments</button>
            </AlertBanner>
          )}
        </div>
      )}

      {/* Stat Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16, marginBottom: 32 }}>
        {cards.map((card) => (
          <StatCard key={card.label} {...card} onClick={() => navigate(card.path)} />
        ))}
      </div>

      {/* ─── DELIVERY DUE REMINDERS SECTION & RECENT STATUS ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 24 }}>
        
        {/* Delivery Reminders Card */}
        <div className="section-card" style={{ border: deliveryDueAlerts.length > 0 ? '1.5px solid #ddd6fe' : '1px solid #e2f0e7' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Bell size={18} color="#7c3aed" /> Expected Delivery Reminders
            </span>
            <button className="btn btn-outline btn-xs" onClick={() => navigate('/delivery')}>
              View Deliveries <ChevronRight size={12} />
            </button>
          </div>

          {deliveryDueAlerts.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '32px 0' }}>
              ✓ No vehicles due for delivery in the next 2 days. All on track!
            </div>
          ) : (
            deliveryDueAlerts.map(item => {
              const days = item.daysRemaining;
              const badgeVariant = days < 0 ? 'danger' : (days === 0 ? 'danger' : (days === 1 ? 'warning' : 'info'));
              const badgeText = days < 0 ? `Overdue by ${Math.abs(days)}d` : (days === 0 ? 'Due Today!' : (days === 1 ? 'Due Tomorrow' : 'Due in 2 days'));

              return (
                <div key={item.repairNo} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 0', borderBottom: '1px solid #f1f5f9'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669', fontSize: 13 }}>{item.repairNo}</span>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>{item.carName}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Garage: <strong>{item.garageName}</strong> | Exp Date: <strong>{item.expectedCompletionDate}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge label={badgeText} variant={badgeVariant} />
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() => navigate('/delivery')}
                      style={{ padding: '4px 8px', fontSize: 11.5, fontWeight: 700 }}
                    >
                      Deliver
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Insurance Quick Status */}
        <div className="section-card">
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Insurance Quick Status</span>
            <button className="btn btn-outline btn-xs" onClick={() => navigate('/insurance')}>
              View All <ChevronRight size={12} />
            </button>
          </div>
          {cars.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '32px 0' }}>No vehicles in fleet</div>
          ) : (
            cars.slice(0, 5).map(car => {
              const ins = insurance.find(i => i.vehicleId === car.vehicleId || i.carName === car.carName);
              const hasIns = !!ins;
              const days = hasIns ? daysUntil(ins.renewalDate || ins.validityDate || ins.date) : null;
              const isWeek = days !== null && days <= 7 && days >= 0;
              const expired = days !== null && days < 0;
              return (
                <div key={car.vehicleId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{car.carName}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{car.vehicleId} · {car.registrationNo}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!hasIns ? <Badge label="Not Available" variant="danger" /> :
                     expired ? <Badge label="Expired" variant="danger" /> :
                     isWeek ? <Badge label={`Due in ${days}d`} variant="warning" /> :
                     days <= 30 ? <Badge label={`${days}d left`} variant="warning" /> :
                     <Badge label="Active" variant="success" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
