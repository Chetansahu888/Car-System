// pages/Payment.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, Search, Eye, X, ExternalLink, CheckCircle,
  Clock, FileText, ArrowUpRight, Copy, Check, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getDeliveries, getRepairs, getPayments,
  updatePaymentStatus, syncAllFromSheets, onStoreUpdate
} from '../store/dataStore';
import { formatDate } from '../utils/dateUtils';
import { ITEMS_PER_PAGE } from '../constants';
import { useAuth, PAGE_KEYS } from '../context/AuthContext';
import ReadOnlyNotice from '../components/shared/ReadOnlyNotice';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import SpeedingCarLoader from '../components/ui/SpeedingCarLoader';

const GOOGLE_PAYMENT_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScn8tHEUldlOM_8DKpHUfHHiRImDVjkpkhhfduaZUIxpxlJrA/viewform';

// Exact Google Form field entry mappings:
// entry.1200639812: Unique no (Repair No)
// entry.1091308719: Garage Name
// entry.1486176123: Bill Amount
const buildGoogleFormUrl = (item) => {
  try {
    const url = new URL(GOOGLE_PAYMENT_FORM_URL);
    url.searchParams.set('usp', 'pp_url');
    if (item?.repairNo) {
      url.searchParams.set('entry.1200639812', item.repairNo);
    }
    if (item?.garageName && item.garageName !== '—') {
      url.searchParams.set('entry.1091308719', item.garageName);
    }
    if (item?.billAmount) {
      url.searchParams.set('entry.1486176123', item.billAmount);
    }
    return url.toString();
  } catch {
    return GOOGLE_PAYMENT_FORM_URL;
  }
};

const Payment = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [deliveries, setDeliveries] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewModalDelivery, setViewModalDelivery] = useState(null);

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setInitialLoading(true);
    const [d, r, p] = await Promise.all([
      getDeliveries(),
      getRepairs(),
      getPayments()
    ]);
    setDeliveries(d);
    setRepairs(r);
    setPayments(p);
    if (isInitial) setInitialLoading(false);
    syncAllFromSheets(true);
  }, []);

  useEffect(() => {
    load(true);
    const unsub = onStoreUpdate(() => {
      load(false);
    });
    return unsub;
  }, [load]);

  // Merge completed deliveries from Delivery of Car
  // All delivered repairs appear in Payment workflow
  const deliveredItems = deliveries.filter(d => d.deliveryStatus === 'Delivery Submitted' || d.deliveredAt || d.actualDate3);

  // Completed payment repair numbers
  const completedPaymentRepairNos = new Set(
    payments.filter(p => p.paymentStatus === 'Payment Completed' || p.paidAt).map(p => p.repairNo)
  );

  // Pending payments: Delivered but payment not completed
  const pendingPayments = deliveredItems.filter(d => !completedPaymentRepairNos.has(d.repairNo)).map(d => {
    const rep = repairs.find(r => r.repairNo === d.repairNo);
    return {
      ...d,
      vehicleName: d.vehicleName || rep?.carName || 'Vehicle',
      garageName: d.garageName || rep?.garageName || rep?.garage || '—',
      dateVehicleReceived: d.dateVehicleReceived || rep?.dateVehicleReceived || '',
      kmAtTimeOfRepair: d.kmAtTimeOfRepair || rep?.kmAtTimeOfRepair || '',
      serviceAmount: d.serviceAmount || rep?.serviceAmount || '',
      billAmount: d.billAmount || rep?.billAmount || '',
      billImage: d.billImage || rep?.billImage || '',
    };
  });

  // History payments
  const historyPayments = payments.filter(p => p.paymentStatus === 'Payment Completed' || completedPaymentRepairNos.has(p.repairNo));

  // Search filter
  const currentList = activeTab === 'pending'
    ? pendingPayments.filter(p => {
        const q = search.toLowerCase();
        return !q || p.repairNo?.toLowerCase().includes(q) || p.vehicleName?.toLowerCase().includes(q) || p.garageName?.toLowerCase().includes(q);
      })
    : historyPayments.filter(p => {
        const q = search.toLowerCase();
        return !q || p.repairNo?.toLowerCase().includes(q) || p.vehicleName?.toLowerCase().includes(q) || p.garageName?.toLowerCase().includes(q);
      });

  const totalPages = Math.ceil(currentList.length / ITEMS_PER_PAGE) || 1;
  const pagedList = currentList.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handlePaymentClick = (item) => {
    const formUrl = buildGoogleFormUrl(item);

    // Copy Repair No to clipboard for convenience
    if (navigator.clipboard && item.repairNo) {
      navigator.clipboard.writeText(item.repairNo).catch(() => {});
    }

    toast.success(
      <span>
        Opening Google Payment Form...<br />
        Unique No: <strong>{item.repairNo}</strong> | Garage: <strong>{item.garageName || '—'}</strong> | Bill: <strong>₹{item.billAmount || '0'}</strong>
      </span>,
      { duration: 4500 }
    );

    // Open Google Form in new tab
    window.open(formUrl, '_blank');
  };

  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.PAYMENT);

  return (
    <div>
      {!canEdit && <ReadOnlyNotice moduleName="Payment Processing" />}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Payment</h1>
          <p className="page-subtitle">Disburse payments for delivered vehicles via Google Payment Form</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setActiveTab('pending'); setPage(1); }}
          style={{
            fontWeight: 700, padding: '10px 20px', borderRadius: 10,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: activeTab === 'pending' ? '0 4px 12px rgba(5,150,105,0.25)' : 'none'
          }}
        >
          <Clock size={17} />
          Pending Payment
          <span style={{
            background: activeTab === 'pending' ? '#ffffff' : '#ecfdf5',
            color: '#059669', padding: '2px 8px', borderRadius: 20,
            fontSize: 12, fontWeight: 800
          }}>
            {pendingPayments.length}
          </span>
        </button>

        <button
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setActiveTab('history'); setPage(1); }}
          style={{
            fontWeight: 700, padding: '10px 20px', borderRadius: 10,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: activeTab === 'history' ? '0 4px 12px rgba(5,150,105,0.25)' : 'none'
          }}
        >
          <CheckCircle size={17} />
          Payment History
          <span style={{
            background: activeTab === 'history' ? '#ffffff' : '#f1f5f9',
            color: activeTab === 'history' ? '#059669' : '#64748b',
            padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 800
          }}>
            {historyPayments.length}
          </span>
        </button>
      </div>

      {/* Table Container */}
      <div className="data-table-container">
        <div className="filter-bar">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              placeholder={activeTab === 'pending' ? 'Search pending payments...' : 'Search payment history...'}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          {search && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>
              <X size={14} /> Clear
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          {initialLoading && currentList.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <SpeedingCarLoader size="medium" />
            </div>
          ) : pagedList.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title={activeTab === 'pending' ? 'No pending payments' : 'No payment history found'}
              message={activeTab === 'pending' ? 'All delivered vehicles have their payments settled!' : 'No payment records match your search.'}
            />
          ) : activeTab === 'pending' ? (
            /* ─── TAB 1: PENDING PAYMENTS TABLE (Exact User Columns) ─── */
            <table className="data-table" style={{ minWidth: 1200 }}>
              <thead>
                <tr>
                  <th>Repair No</th>
                  <th>Garage Name</th>
                  <th>Vehicle Name</th>
                  <th>Date Of Vehicle Received Back</th>
                  <th>K.M at The Time Of Repair</th>
                  <th>Service Amount</th>
                  <th>Bill Amount</th>
                  <th>Bill Image</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedList.map(item => {
                  const billUrl = typeof item.billImage === 'object' ? item.billImage?.url : item.billImage;
                  return (
                    <tr key={item.id || item.repairNo}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669', fontSize: 13 }}>
                          {item.repairNo}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: '#475569', fontWeight: 600, fontSize: 12.5 }}>
                          {item.garageName || '—'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.vehicleName || '—'}</div>
                        {item.vehicleId && <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{item.vehicleId}</div>}
                      </td>
                      <td>
                        {item.dateVehicleReceived ? (
                          <span style={{ fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '4px 8px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>
                            📅 {formatDate(item.dateVehicleReceived)}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        {item.kmAtTimeOfRepair ? (
                          <span style={{ fontWeight: 600, color: '#334155', fontSize: 12.5 }}>
                            {Number(item.kmAtTimeOfRepair).toLocaleString('en-IN')} km
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: '#334155' }}>
                        {item.serviceAmount ? `₹${Number(item.serviceAmount).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                        {item.billAmount ? `₹${Number(item.billAmount).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td>
                        {billUrl ? (
                          <a
                            href={billUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-xs"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                          >
                            <Eye size={13} /> View Bill
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>No bill</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => handlePaymentClick(item)}
                            className="btn btn-primary btn-sm"
                            style={{
                              fontWeight: 800,
                              padding: '7px 16px',
                              borderRadius: 8,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              boxShadow: '0 3px 10px rgba(5,150,105,0.3)'
                            }}
                          >
                            <CreditCard size={15} /> Payment <ArrowUpRight size={14} />
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Payment Restricted</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* ─── TAB 2: PAYMENT HISTORY TABLE ─── */
            <table className="data-table" style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th>Repair No</th>
                  <th>Garage Name</th>
                  <th>Vehicle Name</th>
                  <th>Date Received Back</th>
                  <th>Bill Amount</th>
                  <th>Payment Status</th>
                  <th>Paid At</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedList.map(item => (
                  <tr key={item.id || item.repairNo}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{item.repairNo}</span></td>
                    <td><span style={{ color: '#475569', fontWeight: 600, fontSize: 12.5 }}>{item.garageName || '—'}</span></td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{item.vehicleName || '—'}</td>
                    <td><span style={{ fontSize: 12.5, color: '#64748b' }}>{formatDate(item.dateVehicleReceived)}</span></td>
                    <td style={{ fontWeight: 800, color: '#0f172a' }}>{item.billAmount ? `₹${Number(item.billAmount).toLocaleString('en-IN')}` : '—'}</td>
                    <td><Badge label={item.paymentStatus} variant="success" /></td>
                    <td style={{ fontSize: 12.5, color: '#64748b' }}>{formatDate(item.paidAt || item.timestamp)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => setViewModalDelivery(item)}
                        style={{ color: '#059669', background: '#ecfdf5', padding: '5px 10px', borderRadius: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Eye size={15} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={currentList.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>

      {/* View Details Modal */}
      <Modal
        isOpen={!!viewModalDelivery}
        onClose={() => setViewModalDelivery(null)}
        title={`Payment Details — ${viewModalDelivery?.repairNo}`}
        icon={CreditCard}
        size="md"
      >
        {viewModalDelivery && (
          <div>
            <div style={{
              padding: '14px 18px', background: '#ecfdf5', borderRadius: 14,
              border: '1.5px solid #a7f3d0', marginBottom: 18, display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                  Payment Record
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  <span style={{ color: '#059669', fontFamily: 'monospace' }}>{viewModalDelivery.repairNo}</span> — {viewModalDelivery.vehicleName}
                </div>
              </div>
              <Badge label="Payment Done" variant="success" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
                <span style={{ fontSize: 11.5, color: '#64748b' }}>Garage Name:</span>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{viewModalDelivery.garageName || '—'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
                <span style={{ fontSize: 11.5, color: '#64748b' }}>Date Received:</span>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{formatDate(viewModalDelivery.dateVehicleReceived)}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
                <span style={{ fontSize: 11.5, color: '#64748b' }}>Total Bill:</span>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>
                  {viewModalDelivery.billAmount ? `₹${Number(viewModalDelivery.billAmount).toLocaleString('en-IN')}` : '—'}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
                <span style={{ fontSize: 11.5, color: '#64748b' }}>KM Reading:</span>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                  {viewModalDelivery.kmAtTimeOfRepair ? `${Number(viewModalDelivery.kmAtTimeOfRepair).toLocaleString('en-IN')} km` : '—'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
              <button className="btn btn-outline" onClick={() => setViewModalDelivery(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Payment;
