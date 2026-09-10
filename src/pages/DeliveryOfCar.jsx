// pages/DeliveryOfCar.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  Truck, Search, Eye, CheckCircle, X, ShieldCheck,
  Calendar, Wrench, FileText, AlertCircle, Plus, UploadCloud, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getRepairs, getVendorOffers, getDeliveries,
  submitDelivery, syncAllFromSheets, onStoreUpdate
} from '../store/dataStore';
import { formatDate, today } from '../utils/dateUtils';
import { ITEMS_PER_PAGE } from '../constants';
import { useAuth, PAGE_KEYS } from '../context/AuthContext';
import ReadOnlyNotice from '../components/shared/ReadOnlyNotice';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import FileUpload from '../components/ui/FileUpload';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import SpeedingCarLoader from '../components/ui/SpeedingCarLoader';
import { uploadFileToDrive } from '../api/googleSheetsClient';

// ─── Record Delivery Modal ───────────────────────────────────────────────────
const RecordDeliveryModal = ({ repair, onClose, onSaved }) => {
  const [form, setForm] = useState({
    garageName: repair.garageName || repair.garage || '',
    vehicleName: repair.carName || '',
    dateVehicleReceived: today(),
    kmAtTimeOfRepair: '',
    repairWorkDone: Array.isArray(repair.typesOfRepair) ? repair.typesOfRepair.join(', ') : '',
    partsAmount: '',
    serviceAmount: '',
    insuranceClaimed: repair.insurance === 'Yes' || repair.insuranceToBeClaimed === 'Yes' ? 'Yes' : 'No',
    insuranceAmount: '',
    billAmount: '',
    billImage: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.dateVehicleReceived) {
      toast.error('Please enter the date vehicle was received');
      return;
    }

    setSubmitting(true);
    try {
      let billDocUrl = form.billImage;
      if (billDocUrl?.url && billDocUrl.url.startsWith('data:')) {
        const driveUrl = await uploadFileToDrive(billDocUrl.url, `${repair.repairNo}_DeliveryBill`, billDocUrl.type);
        if (driveUrl) billDocUrl = driveUrl;
      } else if (typeof billDocUrl === 'object' && billDocUrl?.url) {
        billDocUrl = billDocUrl.url;
      }

      await submitDelivery({
        repairNo: repair.repairNo,
        vehicleId: repair.vehicleId,
        ...form,
        billImage: billDocUrl,
      });

      toast.success(`Delivery for ${repair.repairNo} recorded successfully!`);
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to submit delivery');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <LoadingOverlay isVisible={submitting} message="Submitting Delivery to Google Sheets..." />

      {/* Reference Card */}
      <div style={{
        padding: '14px 18px', background: '#ecfdf5', borderRadius: 14,
        border: '1.5px solid #a7f3d0', marginBottom: 20, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Approved Repair Reference
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
            <span style={{ color: '#059669', fontFamily: 'monospace' }}>{repair.repairNo}</span> — {repair.carName || 'Vehicle'}
          </div>
          <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span><strong>Vehicle ID:</strong> {repair.vehicleId || '—'}</span>
            <span><strong>Garage:</strong> {repair.garageName || repair.garage || '—'}</span>
            <span><strong>Expected Delivery:</strong> {repair.expectedCompletionDate || '—'}</span>
          </div>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: '#10b981',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
        }}>
          <Truck size={24} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <div className="form-group">
          <label className="form-label">
            Date Vehicle Received Back <span className="required">*</span>
          </label>
          <input
            type="date"
            className="form-input"
            value={form.dateVehicleReceived}
            onChange={e => set('dateVehicleReceived', e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">KM at Time of Repair</label>
          <input
            type="number"
            className="form-input"
            value={form.kmAtTimeOfRepair}
            onChange={e => set('kmAtTimeOfRepair', e.target.value)}
            placeholder="Odometer reading (e.g. 45000)"
          />
        </div>

        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Repair Work Done</label>
          <textarea
            className="form-textarea"
            rows={2}
            value={form.repairWorkDone}
            onChange={e => set('repairWorkDone', e.target.value)}
            placeholder="Describe all repair work completed..."
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Parts Amount (₹)</label>
          <input
            type="number"
            className="form-input"
            value={form.partsAmount}
            onChange={e => set('partsAmount', e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Service Amount (₹)</label>
          <input
            type="number"
            className="form-input"
            value={form.serviceAmount}
            onChange={e => set('serviceAmount', e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Total Bill Amount (₹)</label>
          <input
            type="number"
            className="form-input"
            value={form.billAmount}
            onChange={e => set('billAmount', e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Insurance Claimed?</label>
          <select
            className="form-select"
            value={form.insuranceClaimed}
            onChange={e => set('insuranceClaimed', e.target.value)}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        {form.insuranceClaimed === 'Yes' && (
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Insurance Claim Amount (₹)</label>
            <input
              type="number"
              className="form-input"
              value={form.insuranceAmount}
              onChange={e => set('insuranceAmount', e.target.value)}
              placeholder="0"
            />
          </div>
        )}

        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Upload Final Bill / Invoice Photo</label>
          <FileUpload
            value={form.billImage}
            onChange={v => set('billImage', v)}
            accept="image/*,.pdf"
            label="Upload Garage Final Bill"
            id="delivery-bill-upload"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{ padding: '10px 24px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {submitting ? (
            <><span className="spinner" style={{ width: 15, height: 15 }} /> Submitting...</>
          ) : (
            '✓ Confirm & Submit Delivery'
          )}
        </button>
      </div>
    </form>
  );
};

// ─── View Delivery Details Modal ──────────────────────────────────────────────
const ViewDeliveryModal = ({ delivery, onClose }) => {
  if (!delivery) return null;
  const billUrl = typeof delivery.billImage === 'object' ? delivery.billImage?.url : delivery.billImage;

  return (
    <div>
      <div style={{
        padding: '16px 20px', background: '#ecfdf5', borderRadius: 14,
        border: '1.5px solid #a7f3d0', marginBottom: 20, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Completed Delivery Record
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
            <span style={{ color: '#059669', fontFamily: 'monospace' }}>{delivery.repairNo}</span> — {delivery.vehicleName || 'Vehicle'}
          </div>
          <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4 }}>
            Garage: <strong>{delivery.garageName || '—'}</strong> | Vehicle ID: <strong>{delivery.vehicleId || '—'}</strong>
          </div>
        </div>
        <Badge label="Delivered" variant="success" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
          <span style={{ fontSize: 11.5, color: '#64748b' }}>Date Received Back:</span>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{formatDate(delivery.dateVehicleReceived)}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
          <span style={{ fontSize: 11.5, color: '#64748b' }}>KM at Repair:</span>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
            {delivery.kmAtTimeOfRepair ? `${Number(delivery.kmAtTimeOfRepair).toLocaleString('en-IN')} km` : '—'}
          </div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
          <span style={{ fontSize: 11.5, color: '#64748b' }}>Total Bill:</span>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>
            {delivery.billAmount ? `₹${Number(delivery.billAmount).toLocaleString('en-IN')}` : '—'}
          </div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
          <span style={{ fontSize: 11.5, color: '#64748b' }}>Insurance Claimed:</span>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{delivery.insuranceClaimed || 'No'}</div>
        </div>
      </div>

      {delivery.repairWorkDone && (
        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>Repair Work Done:</span>
          <div style={{ fontSize: 13, color: '#1e293b', whiteSpace: 'pre-wrap' }}>{delivery.repairWorkDone}</div>
        </div>
      )}

      {billUrl && (
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>Final Bill Document:</span>
          <a
            href={billUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Eye size={14} /> Open Garage Bill (Drive)
          </a>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
        <button className="btn btn-outline" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

// ─── MAIN DELIVERY OF CAR COMPONENT ──────────────────────────────────────────
const DeliveryOfCar = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [repairs, setRepairs] = useState([]);
  const [vendorOffers, setVendorOffers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [deliveryModalRepair, setDeliveryModalRepair] = useState(null);
  const [viewModalDelivery, setViewModalDelivery] = useState(null);

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setInitialLoading(true);
    const [r, v, d] = await Promise.all([
      getRepairs(),
      getVendorOffers(),
      getDeliveries()
    ]);
    setRepairs(r);
    setVendorOffers(v);
    setDeliveries(d);
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

  // Delivered repair numbers: records that have Actual 3 recorded
  const deliveredRepairNos = new Set(
    deliveries.filter(d => (d.deliveryStatus === 'Delivery Submitted' || d.deliveredAt) && d.actualDate3).map(d => d.repairNo)
  );

  // Pending repairs: Approved in Approvals, but not yet delivered
  const pendingRepairs = repairs.filter(r => {
    const offer = vendorOffers.find(v => v.repairNo === r.repairNo);
    const isApproved = r.repairStatus === 'Approved' || offer?.approvalStatus === 'Approved' || r.actualDate2 || offer?.actualDate2;
    const isDelivered = !!(r.actualDate3 && r.actualDate3 !== '') || deliveredRepairNos.has(r.repairNo);
    return isApproved && !isDelivered;
  }).map(r => {
    const offer = vendorOffers.find(v => v.repairNo === r.repairNo);
    return {
      ...r,
      garageName: r.garageName || offer?.garageName || r.garage || '',
      expectedCompletionDate: r.expectedCompletionDate || offer?.expectedCompletionDate || '',
      typesOfRepair: offer?.typesOfRepair || r.typesOfRepair || [],
      insurance: offer?.insurance || r.insuranceToBeClaimed || 'No',
      plannedDate3: r.plannedDate3 || r['Planned 3'] || '',
    };
  });

  // History deliveries
  const historyDeliveries = deliveries.filter(d =>
    (d.deliveryStatus === 'Delivery Submitted' || d.deliveredAt) && (d.actualDate3 || deliveredRepairNos.has(d.repairNo))
  );

  // Search filter
  const currentList = activeTab === 'pending'
    ? pendingRepairs.filter(r => {
        const q = search.toLowerCase();
        return !q || r.repairNo?.toLowerCase().includes(q) || r.carName?.toLowerCase().includes(q) || r.vehicleId?.toLowerCase().includes(q);
      })
    : historyDeliveries.filter(d => {
        const q = search.toLowerCase();
        return !q || d.repairNo?.toLowerCase().includes(q) || d.vehicleName?.toLowerCase().includes(q) || d.garageName?.toLowerCase().includes(q);
      });

  const totalPages = Math.ceil(currentList.length / ITEMS_PER_PAGE) || 1;
  const pagedList = currentList.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.DELIVERY);

  return (
    <div>
      {!canEdit && <ReadOnlyNotice moduleName="Delivery of Car Management" />}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery Of Car</h1>
          <p className="page-subtitle">Manage and record vehicle delivery received back from repair garages</p>
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
          <Truck size={17} />
          Pending Delivery
          <span style={{
            background: activeTab === 'pending' ? '#ffffff' : '#ecfdf5',
            color: '#059669', padding: '2px 8px', borderRadius: 20,
            fontSize: 12, fontWeight: 800
          }}>
            {pendingRepairs.length}
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
          Delivery History
          <span style={{
            background: activeTab === 'history' ? '#ffffff' : '#f1f5f9',
            color: activeTab === 'history' ? '#059669' : '#64748b',
            padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 800
          }}>
            {historyDeliveries.length}
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
              placeholder={activeTab === 'pending' ? 'Search pending deliveries...' : 'Search delivery history...'}
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
              icon={Truck}
              title={activeTab === 'pending' ? 'No pending deliveries' : 'No delivery history found'}
              message={activeTab === 'pending' ? 'All approved vehicles have been delivered and recorded!' : 'No completed deliveries match your search.'}
            />
          ) : activeTab === 'pending' ? (
            /* ─── TAB 1: PENDING DELIVERY TABLE ─── */
            <table className="data-table">
              <thead>
                <tr>
                  <th>Repair No.</th>
                  <th>Vehicle ID</th>
                  <th>Planned Date</th>
                  <th>Car Name</th>
                  <th>Garage Name</th>
                  <th>Expected Delivery Date</th>
                  <th>Repair Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedList.map(repair => (
                  <tr key={repair.id || repair.repairNo}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{repair.repairNo}</span></td>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>{repair.vehicleId || '—'}</span></td>
                    <td>
                      {repair.plannedDate3 ? (
                        <span style={{ fontWeight: 700, color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '4px 8px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>
                          📅 {repair.plannedDate3}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{repair.carName || '—'}</td>
                    <td><span style={{ color: '#475569', fontWeight: 600, fontSize: 12.5 }}>{repair.garageName || repair.garage || '—'}</span></td>
                    <td>
                      {repair.expectedCompletionDate ? (
                        <span style={{ fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '4px 8px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>
                          📅 {repair.expectedCompletionDate}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td><Badge label="Approved" variant="success" /></td>
                    <td style={{ textAlign: 'center' }}>
                      {canEdit ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setDeliveryModalRepair(repair)}
                          style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8 }}
                        >
                          <Truck size={15} /> Deliver Car
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Delivery Restricted</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* ─── TAB 2: DELIVERY HISTORY TABLE ─── */
            <table className="data-table" style={{ minWidth: 1600 }}>
              <thead>
                <tr>
                  <th>Repair No</th>
                  <th>Garage Name</th>
                  <th>Vehicle Name</th>
                  <th>Date Of Vehicle Received Back</th>
                  <th>K.M at The Time Of Repair</th>
                  <th>Repair Work Done</th>
                  <th>Parts Amount</th>
                  <th>Service Amount</th>
                  <th>Insurance Claimed (If Any)</th>
                  <th>Insurance Amount ( If Claimed )</th>
                  <th>Bill Amount</th>
                  <th>Bill Image</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedList.map(del => {
                  const billUrl = typeof del.billImage === 'object' ? del.billImage?.url : del.billImage;
                  return (
                    <tr key={del.id || del.repairNo}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{del.repairNo}</span></td>
                      <td><span style={{ color: '#475569', fontWeight: 600, fontSize: 12.5 }}>{del.garageName || '—'}</span></td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{del.vehicleName || '—'}</div>
                        {del.vehicleId && <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{del.vehicleId}</div>}
                      </td>
                      <td>
                        {del.dateVehicleReceived ? (
                          <span style={{ fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '4px 8px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>
                            📅 {formatDate(del.dateVehicleReceived)}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        {del.kmAtTimeOfRepair ? (
                          <span style={{ fontWeight: 600, color: '#334155', fontSize: 12.5 }}>
                            {Number(del.kmAtTimeOfRepair).toLocaleString('en-IN')} km
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12.5, color: '#334155' }} title={del.repairWorkDone}>
                        {del.repairWorkDone || '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: '#334155' }}>
                        {del.partsAmount ? `₹${Number(del.partsAmount).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: '#334155' }}>
                        {del.serviceAmount ? `₹${Number(del.serviceAmount).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td>
                        <Badge
                          label={del.insuranceClaimed === 'Yes' ? 'Yes' : 'No'}
                          variant={del.insuranceClaimed === 'Yes' ? 'warning' : 'gray'}
                        />
                      </td>
                      <td style={{ fontWeight: 600, color: '#334155' }}>
                        {del.insuranceAmount ? `₹${Number(del.insuranceAmount).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ fontWeight: 800, color: '#0f172a' }}>
                        {del.billAmount ? `₹${Number(del.billAmount).toLocaleString('en-IN')}` : '—'}
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
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => setViewModalDelivery(del)}
                          title="View Details"
                          style={{ color: '#059669', background: '#ecfdf5', padding: '5px 10px', borderRadius: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Eye size={15} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Record Delivery Modal */}
      <Modal
        isOpen={!!deliveryModalRepair}
        onClose={() => setDeliveryModalRepair(null)}
        title={`Record Delivery Of Car — ${deliveryModalRepair?.repairNo}`}
        icon={Truck}
        size="lg"
      >
        <RecordDeliveryModal
          repair={deliveryModalRepair}
          onClose={() => setDeliveryModalRepair(null)}
          onSaved={() => {
            setDeliveryModalRepair(null);
            load();
          }}
        />
      </Modal>

      {/* View Delivery Modal */}
      <Modal
        isOpen={!!viewModalDelivery}
        onClose={() => setViewModalDelivery(null)}
        title={`Delivery Details — ${viewModalDelivery?.repairNo}`}
        icon={Eye}
        size="md"
      >
        <ViewDeliveryModal
          delivery={viewModalDelivery}
          onClose={() => setViewModalDelivery(null)}
        />
      </Modal>
    </div>
  );
};

export default DeliveryOfCar;
