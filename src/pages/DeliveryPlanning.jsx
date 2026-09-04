// pages/DeliveryPlanning.jsx
import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Search, Eye, X, Lock, Wrench, CreditCard, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { getRepairs, getVendorOffers, addDeliveryPlanning, getDeliveryPlanning, syncAllFromSheets, onStoreUpdate } from '../store/dataStore';
import { generateId } from '../utils/idGenerator';
import { formatDate, today } from '../utils/dateUtils';
import { validateForm, required } from '../utils/validators';
import { ITEMS_PER_PAGE } from '../constants';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import FileUpload from '../components/ui/FileUpload';

const DeliveryPlanningForm = ({ repair, onClose, onSaved }) => {
  const [form, setForm] = useState({
    garageName: repair.garageName || repair.garage || '',
    vehicleName: repair.carName || '',
    dateVehicleReceived: '',
    kmAtTimeOfRepair: '',
    repairWorkDone: '',
    partsAmount: '',
    serviceAmount: '',
    insuranceClaimed: 'No',
    insuranceAmount: '',
    billAmount: '',
    billImage: null,
  });
  const [saving, setSaving] = useState(false);
  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.dateVehicleReceived) { toast.error('Please enter the date vehicle was received'); return; }
    if (!form.billAmount) { toast.error('Please enter the bill amount'); return; }
    setSaving(true);
    try {
      await addDeliveryPlanning({
        id: generateId(), repairNo: repair.repairNo, vehicleId: repair.vehicleId,
        ...form, createdAt: new Date().toISOString()
      });
      toast.success('Delivery planning submitted successfully');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ padding: '12px 16px', background: '#ecfdf5', borderRadius: 12, border: '1px solid #d1fae5', marginBottom: 20 }}>
        <div style={{ fontSize: 11.5, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>Approved Repair Reference</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{repair.repairNo} — {repair.carName}</div>
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><Truck size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Delivery & Return Information</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {[['Garage Name', 'garageName'], ['Vehicle Name', 'vehicleName']].map(([label, field]) => (
          <div key={field} className="form-group">
            <label className="form-label">{label}</label>
            <input className="form-input" value={form[field]} onChange={e => set(field, e.target.value)} />
          </div>
        ))}
        <div className="form-group">
          <label className="form-label">Date Vehicle Received Back <span className="required">*</span></label>
          <input type="date" className="form-input" value={form.dateVehicleReceived} onChange={e => set('dateVehicleReceived', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">KM at Time of Repair</label>
          <input type="number" className="form-input" value={form.kmAtTimeOfRepair} onChange={e => set('kmAtTimeOfRepair', e.target.value)} placeholder="Odometer reading" />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Repair Work Done</label>
          <textarea className="form-textarea" rows={3} value={form.repairWorkDone} onChange={e => set('repairWorkDone', e.target.value)} placeholder="Describe all repair work completed..." style={{ resize: 'vertical' }} />
        </div>
        <div className="form-group">
          <label className="form-label">Parts Amount (₹)</label>
          <input type="number" className="form-input" value={form.partsAmount} onChange={e => set('partsAmount', e.target.value)} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label">Service Amount (₹)</label>
          <input type="number" className="form-input" value={form.serviceAmount} onChange={e => set('serviceAmount', e.target.value)} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label">Insurance Claimed?</label>
          <select className="form-select" value={form.insuranceClaimed} onChange={e => set('insuranceClaimed', e.target.value)}>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
        {form.insuranceClaimed === 'Yes' && (
          <div className="form-group">
            <label className="form-label">Insurance Amount (₹)</label>
            <input type="number" className="form-input" value={form.insuranceAmount} onChange={e => set('insuranceAmount', e.target.value)} placeholder="0" />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Bill Amount (₹) <span className="required">*</span></label>
          <input type="number" className="form-input" value={form.billAmount} onChange={e => set('billAmount', e.target.value)} placeholder="Total bill amount" />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Bill Image / Invoice</label>
          <FileUpload value={form.billImage} onChange={v => set('billImage', v)} accept="image/*,.pdf" label="Upload Bill / Invoice" id="bill-image" />
        </div>
      </div>
      <div className="modal-footer" style={{ padding: '20px 0 0' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : 'Submit Delivery Plan'}
        </button>
      </div>
    </form>
  );
};

const DeliveryPlanning = () => {
  const [repairs, setRepairs] = useState([]);
  const [vendorOffers, setVendorOffers] = useState([]);
  const [deliveryPlans, setDeliveryPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [planModal, setPlanModal] = useState(null);
  const [viewModal, setViewModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, v, dp] = await Promise.all([getRepairs(), getVendorOffers(), getDeliveryPlanning()]);
    setRepairs(r); setVendorOffers(v); setDeliveryPlans(dp);
    setLoading(false);
    syncAllFromSheets(true);
  }, []);

  useEffect(() => {
    load();
    const unsub = onStoreUpdate(() => {
      load();
    });
    return unsub;
  }, [load]);

  // Only show repairs that are Approved (have approved vendor offer)
  const approvedRepairs = repairs.filter(r => {
    const offer = vendorOffers.find(v => v.repairNo === r.repairNo);
    return r.repairStatus === 'Approved' || offer?.approvalStatus === 'Approved' || r.actualDate2 || offer?.actualDate2;
  });

  const filtered = approvedRepairs.filter(r => {
    const q = search.toLowerCase();
    return !q || r.repairNo?.toLowerCase().includes(q) || r.carName?.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const hasPlan = (repairNo) => deliveryPlans.find(dp => dp.repairNo === repairNo);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery Planning</h1>
          <p className="page-subtitle">{approvedRepairs.length} approved repair{approvedRepairs.length !== 1 ? 's' : ''} ready for delivery schedule</p>
        </div>
      </div>

      <div className="alert-banner info" style={{ marginBottom: 20 }}>
        <Lock size={18} />
        <span>Only repairs with <strong>Approved</strong> vendor offers appear here. Complete the approval process to unlock delivery planning.</span>
      </div>

      <div className="data-table-container">
        <div className="filter-bar">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input className="search-input" placeholder="Search approved repairs..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          {search && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>
              <X size={14} /> Clear
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
              <span className="spinner" /> <span style={{ color: '#64748b', fontWeight: 600 }}>Loading records...</span>
            </div>
          ) : paged.length === 0 ? (
            <EmptyState icon={Truck} title="No approved repairs"
              message="Repairs must be approved in the Approval module before delivery planning can begin." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Repair No.</th>
                  <th>Vehicle</th>
                  <th>Garage</th>
                  <th>Department</th>
                  <th>Repair Status</th>
                  <th>Plan Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(repair => {
                  const plan = hasPlan(repair.repairNo);
                  return (
                    <tr key={repair.repairNo}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{repair.repairNo}</span></td>
                      <td><div style={{ fontWeight: 700, color: '#0f172a' }}>{repair.carName}</div><div style={{ fontSize: 11.5, color: '#64748b' }}>{repair.vehicleId}</div></td>
                      <td>{repair.garage}</td>
                      <td>{repair.department || '—'}</td>
                      <td><Badge label={repair.repairStatus} /></td>
                      <td>
                        <Badge label={plan ? 'Plan Submitted' : 'Plan Pending'}
                          variant={plan ? 'success' : 'warning'} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          {plan ? (
                            <button className="btn btn-ghost btn-xs" onClick={() => setViewModal(plan)}>
                              <Eye size={14} /> View
                            </button>
                          ) : (
                            <button className="btn btn-sm btn-primary" onClick={() => setPlanModal(repair)}>
                              <Truck size={14} /> Plan Delivery
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
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage}
          totalItems={filtered.length} itemsPerPage={ITEMS_PER_PAGE} />
      </div>

      {/* Plan Form Modal */}
      <Modal isOpen={!!planModal} onClose={() => setPlanModal(null)}
        title={`Planning Of Delivery — ${planModal?.repairNo}`} icon={Truck} size="lg">
        {planModal && <DeliveryPlanningForm repair={planModal}
          onClose={() => setPlanModal(null)} onSaved={() => { setPlanModal(null); load(); }} />}
      </Modal>

      {/* View Plan Modal */}
      <Modal isOpen={!!viewModal} onClose={() => setViewModal(null)}
        title="Delivery Plan Details" icon={Truck} size="lg">
        {viewModal && (
          <div className="detail-grid">
            {[
              ['Repair No.', viewModal.repairNo], ['Garage', viewModal.garageName],
              ['Vehicle', viewModal.vehicleName], ['Date Received', formatDate(viewModal.dateVehicleReceived)],
              ['KM at Repair', viewModal.kmAtTimeOfRepair ? `${Number(viewModal.kmAtTimeOfRepair).toLocaleString('en-IN')} km` : '—'],
              ['Parts Amount', viewModal.partsAmount ? `₹${Number(viewModal.partsAmount).toLocaleString('en-IN')}` : '—'],
              ['Service Amount', viewModal.serviceAmount ? `₹${Number(viewModal.serviceAmount).toLocaleString('en-IN')}` : '—'],
              ['Insurance Claimed', viewModal.insuranceClaimed],
              ['Insurance Amount', viewModal.insuranceAmount ? `₹${Number(viewModal.insuranceAmount).toLocaleString('en-IN')}` : '—'],
              ['Bill Amount', viewModal.billAmount ? `₹${Number(viewModal.billAmount).toLocaleString('en-IN')}` : '—'],
            ].map(([l, v]) => (
              <div key={l} className="detail-item"><label>{l}</label><div className="value">{v || '—'}</div></div>
            ))}
            {viewModal.repairWorkDone && (
              <div className="detail-item" style={{ gridColumn: '1/-1' }}>
                <label>Repair Work Done</label>
                <div className="value" style={{ whiteSpace: 'pre-wrap' }}>{viewModal.repairWorkDone}</div>
              </div>
            )}
            {viewModal.billImage?.url && (
              <div className="detail-item" style={{ gridColumn: '1/-1' }}>
                <label>Bill Image</label>
                <a href={viewModal.billImage.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                  <Eye size={13} /> View Bill
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DeliveryPlanning;
