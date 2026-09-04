// pages/Insurance.jsx
import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Search, Eye, X, AlertTriangle, CheckCircle, Clock, Car, CreditCard, ShieldCheck, RefreshCw, Calendar, Sparkles, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCars, getInsurance, addInsurance, renewInsurance } from '../store/dataStore';
import { calcInsuranceRenewal, formatDate, daysUntil, today, toInputDate } from '../utils/dateUtils';
import { generateId } from '../utils/idGenerator';
import { validateForm, required } from '../utils/validators';
import { ITEMS_PER_PAGE } from '../constants';
import { useAuth, PAGE_KEYS } from '../context/AuthContext';
import ReadOnlyNotice from '../components/shared/ReadOnlyNotice';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';

const EMPTY_FORM = {
  vehicleId: '', date: '', carName: '', nameOfCompany: '',
  idvValue: '', totalPremiumToBePaid: '', basicPremium: '', thirdPartyPremium: '',
  addOnPremium: '', depreciationReimbursement: false, engineSecure: false,
  consumableExpenses: false, personalBelonging: false, roadsideAssistance: false,
  keyReplacement: false, emergencyTransportHotel: false,
  taxAmount: '', totalPremiumAmount: '',
  claimedLastYear: 'No', policyInclusiveOfNcb: 'No', premiumOfNcb: '',
  cashlessPolicy: 'Yes',
};

const FORM_RULES = { vehicleId: [required], date: [required], nameOfCompany: [required] };

const CheckField = ({ label, checked, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5, color: '#334155', userSelect: 'none' }}>
    <div onClick={onChange} style={{
      width: 20, height: 20, borderRadius: 6, border: `2px solid ${checked ? '#059669' : '#cbd5e1'}`,
      background: checked ? '#059669' : '#ffffff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
    }}>
      {checked && <CheckCircle size={13} color="#ffffff" />}
    </div>
    {label}
  </label>
);

// ─── Add Insurance Form ───────────────────────────────────────────────────────
const InsuranceForm = ({ cars, existingInsurance, onClose, onSaved }) => {
  const [form, setForm] = useState({ ...EMPTY_FORM, date: today() });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleCarSelect = (vehicleId) => {
    const car = cars.find(c => c.vehicleId === vehicleId);
    setSelectedCar(car);
    setForm(f => ({ ...f, vehicleId, carName: car?.carName || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm(form, FORM_RULES);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const already = existingInsurance.find(i => i.vehicleId === form.vehicleId);
    if (already) { toast.error('Insurance already exists for this vehicle. Please use "Renew Update" to renew.'); return; }
    setSaving(true);
    try {
      const renewal = calcInsuranceRenewal(form.date);
      await addInsurance({
        ...form, id: generateId(),
        validityDate: renewal ? toInputDate(renewal) : '',
        renewalDate: renewal ? toInputDate(renewal) : '',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      toast.success('Insurance record added successfully');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to save insurance');
    } finally {
      setSaving(false);
    }
  };

  const renewal = form.date ? calcInsuranceRenewal(form.date) : null;

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-section-header">
        <div className="form-section-icon"><Car size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Vehicle Selection</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">Vehicle <span className="required">*</span></label>
          <select className={`form-select ${errors.vehicleId ? 'error' : ''}`} value={form.vehicleId}
            onChange={e => handleCarSelect(e.target.value)}>
            <option value="">Select vehicle</option>
            {cars.map(c => <option key={c.vehicleId} value={c.vehicleId}>{c.vehicleId} — {c.carName}</option>)}
          </select>
          {errors.vehicleId && <span className="form-error">{errors.vehicleId}</span>}
        </div>
        {selectedCar && (
          <div style={{ padding: '12px 16px', background: '#ecfdf5', borderRadius: 12, border: '1px solid #d1fae5' }}>
            <div style={{ fontSize: 11.5, color: '#059669', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Selected Vehicle</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{selectedCar.carName}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{selectedCar.registrationNo} · {selectedCar.fuelType}</div>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <div className="form-group">
          <label className="form-label">Insurance Date <span className="required">*</span></label>
          <input type="date" className="form-input" value={form.date} onChange={e => set('date', e.target.value)} />
          {renewal && <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 4 }}>
            ✓ Next Renewal: {formatDate(renewal)} (1 year − 1 day)
          </div>}
        </div>
        <div className="form-group">
          <label className="form-label">Insurance Company <span className="required">*</span></label>
          <input className={`form-input ${errors.nameOfCompany ? 'error' : ''}`} value={form.nameOfCompany}
            onChange={e => set('nameOfCompany', e.target.value)} placeholder="e.g. New India Assurance" />
          {errors.nameOfCompany && <span className="form-error">{errors.nameOfCompany}</span>}
        </div>
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><CreditCard size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Premium Breakdown</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[['IDV Value (₹)', 'idvValue'], ['Total Premium (₹)', 'totalPremiumToBePaid'],
          ['Basic Premium (₹)', 'basicPremium'], ['3rd Party Premium (₹)', 'thirdPartyPremium'],
          ['Add-On Premium (₹)', 'addOnPremium'], ['Tax Amount (₹)', 'taxAmount'],
          ['Total Premium Amount (₹)', 'totalPremiumAmount'], ['NCB Premium (₹)', 'premiumOfNcb']
        ].map(([label, field]) => (
          <div key={field} className="form-group">
            <label className="form-label">{label}</label>
            <input type="number" className="form-input" value={form[field]} onChange={e => set(field, e.target.value)} placeholder="0" />
          </div>
        ))}
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><ShieldCheck size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Add-On Covers Included</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 28, padding: '18px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0' }}>
        {[
          ['Depreciation Reimbursement', 'depreciationReimbursement'],
          ['Engine Secure', 'engineSecure'],
          ['Consumable Expenses', 'consumableExpenses'],
          ['Loss of Personal Belonging', 'personalBelonging'],
          ['Roadside Assistance', 'roadsideAssistance'],
          ['Key Replacement', 'keyReplacement'],
          ['Emergency Transport & Hotel', 'emergencyTransportHotel'],
        ].map(([label, field]) => (
          <CheckField key={field} label={label} checked={form[field]}
            onChange={() => set(field, !form[field])} />
        ))}
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><Shield size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Policy Terms & NCB</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 8 }}>
        {[
          ['Claimed Insurance Last Year?', 'claimedLastYear'],
          ['Policy Inclusive of NCB?', 'policyInclusiveOfNcb'],
          ['Cashless Policy?', 'cashlessPolicy'],
        ].map(([label, field]) => (
          <div key={field} className="form-group">
            <label className="form-label">{label}</label>
            <select className="form-select" value={form[field]} onChange={e => set(field, e.target.value)}>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
        ))}
      </div>

      <div className="modal-footer" style={{ padding: '20px 0 0' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : '+ Add Insurance'}
        </button>
      </div>
    </form>
  );
};

// ─── Renewal Update Modal Form ────────────────────────────────────────────────
const RenewalUpdateModal = ({ car, existingIns, onClose, onSaved }) => {
  const [form, setForm] = useState({
    date: today(),
    nameOfCompany: existingIns?.nameOfCompany || '',
    idvValue: existingIns?.idvValue || '',
    totalPremiumToBePaid: existingIns?.totalPremiumToBePaid || '',
    basicPremium: existingIns?.basicPremium || '',
    thirdPartyPremium: existingIns?.thirdPartyPremium || '',
    addOnPremium: existingIns?.addOnPremium || '',
    depreciationReimbursement: existingIns?.depreciationReimbursement || false,
    engineSecure: existingIns?.engineSecure || false,
    consumableExpenses: existingIns?.consumableExpenses || false,
    personalBelonging: existingIns?.personalBelonging || false,
    roadsideAssistance: existingIns?.roadsideAssistance ?? true,
    keyReplacement: existingIns?.keyReplacement || false,
    emergencyTransportHotel: existingIns?.emergencyTransportHotel || false,
    taxAmount: existingIns?.taxAmount || '',
    totalPremiumAmount: existingIns?.totalPremiumAmount || '',
    claimedLastYear: 'No',
    policyInclusiveOfNcb: existingIns?.policyInclusiveOfNcb || 'Yes',
    premiumOfNcb: existingIns?.premiumOfNcb || '',
    cashlessPolicy: 'Yes',
  });
  const [saving, setSaving] = useState(false);
  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const nextRenewal = form.date ? calcInsuranceRenewal(form.date) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) { toast.error('Please enter renewal policy start date'); return; }
    if (!form.nameOfCompany) { toast.error('Please enter insurance company name'); return; }
    setSaving(true);
    try {
      await renewInsurance(car.vehicleId, {
        ...form,
        carName: car.carName,
        validityDate: nextRenewal ? toInputDate(nextRenewal) : '',
        renewalDate: nextRenewal ? toInputDate(nextRenewal) : '',
      });
      toast.success(`Insurance for ${car.carName} (${car.vehicleId}) renewed successfully!`);
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Renewal update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ padding: '14px 18px', background: '#ecfdf5', borderRadius: 14, border: '1px solid #a7f3d0', marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11.5, color: '#059669', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Vehicle To Renew</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{car.carName}</div>
          <div style={{ fontSize: 12.5, color: '#64748b' }}>{car.vehicleId} · {car.registrationNo}</div>
        </div>
        {existingIns?.renewalDate && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Current Renewal Date</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ea580c' }}>{formatDate(existingIns.renewalDate)}</div>
          </div>
        )}
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><Calendar size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">New Policy Renewal Schedule</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="form-group">
          <label className="form-label">New Policy Start Date <span className="required">*</span></label>
          <input type="date" className="form-input" value={form.date} onChange={e => set('date', e.target.value)} />
          {nextRenewal && (
            <div style={{ fontSize: 12.5, color: '#059669', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={13} /> Next Renewal: {formatDate(nextRenewal)} (1 Year − 1 Day)
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Insurance Company <span className="required">*</span></label>
          <input className="form-input" value={form.nameOfCompany} onChange={e => set('nameOfCompany', e.target.value)} placeholder="e.g. New India Assurance" />
        </div>
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><CreditCard size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Renewed Premium Details</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="form-group">
          <label className="form-label">Renewed IDV Value (₹)</label>
          <input type="number" className="form-input" value={form.idvValue} onChange={e => set('idvValue', e.target.value)} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label">Total Premium Amount (₹) <span className="required">*</span></label>
          <input type="number" className="form-input" value={form.totalPremiumAmount} onChange={e => set('totalPremiumAmount', e.target.value)} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label">Basic Premium (₹)</label>
          <input type="number" className="form-input" value={form.basicPremium} onChange={e => set('basicPremium', e.target.value)} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label">3rd Party Premium (₹)</label>
          <input type="number" className="form-input" value={form.thirdPartyPremium} onChange={e => set('thirdPartyPremium', e.target.value)} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label">Add-On Premium (₹)</label>
          <input type="number" className="form-input" value={form.addOnPremium} onChange={e => set('addOnPremium', e.target.value)} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label">NCB Premium / Discount (₹)</label>
          <input type="number" className="form-input" value={form.premiumOfNcb} onChange={e => set('premiumOfNcb', e.target.value)} placeholder="0" />
        </div>
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><ShieldCheck size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Add-On Covers</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 24, padding: '18px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0' }}>
        {[
          ['Depreciation Reimbursement', 'depreciationReimbursement'],
          ['Engine Secure', 'engineSecure'],
          ['Consumable Expenses', 'consumableExpenses'],
          ['Loss of Personal Belonging', 'personalBelonging'],
          ['Roadside Assistance', 'roadsideAssistance'],
          ['Key Replacement', 'keyReplacement'],
          ['Emergency Transport & Hotel', 'emergencyTransportHotel'],
        ].map(([label, field]) => (
          <CheckField key={field} label={label} checked={form[field]}
            onChange={() => set(field, !form[field])} />
        ))}
      </div>

      <div className="modal-footer" style={{ padding: '20px 0 0' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Updating...</> : '✓ Confirm & Update Renewal'}
        </button>
      </div>
    </form>
  );
};

// ─── Details Modal ────────────────────────────────────────────────────────────
const InsuranceDetails = ({ ins }) => {
  const fields = [
    ['Insurance Company', ins.nameOfCompany], ['IDV Value', ins.idvValue ? `₹${Number(ins.idvValue).toLocaleString('en-IN')}` : '—'],
    ['Total Premium', ins.totalPremiumToBePaid ? `₹${Number(ins.totalPremiumToBePaid).toLocaleString('en-IN')}` : '—'],
    ['Basic Premium', ins.basicPremium ? `₹${Number(ins.basicPremium).toLocaleString('en-IN')}` : '—'],
    ['3rd Party Premium', ins.thirdPartyPremium ? `₹${Number(ins.thirdPartyPremium).toLocaleString('en-IN')}` : '—'],
    ['Add-On Premium', ins.addOnPremium ? `₹${Number(ins.addOnPremium).toLocaleString('en-IN')}` : '—'],
    ['Tax Amount', ins.taxAmount ? `₹${Number(ins.taxAmount).toLocaleString('en-IN')}` : '—'],
    ['Total Premium Amount', ins.totalPremiumAmount ? `₹${Number(ins.totalPremiumAmount).toLocaleString('en-IN')}` : '—'],
    ['Validity Date', formatDate(ins.validityDate)], ['Renewal Date', formatDate(ins.renewalDate)],
    ['Claimed Last Year?', ins.claimedLastYear], ['Inclusive of NCB?', ins.policyInclusiveOfNcb],
    ['NCB Premium', ins.premiumOfNcb ? `₹${Number(ins.premiumOfNcb).toLocaleString('en-IN')}` : '—'],
    ['Cashless Policy?', ins.cashlessPolicy], ['Insurance Date', formatDate(ins.date)],
  ];
  const addOns = [
    ['Depreciation Reimbursement', ins.depreciationReimbursement],
    ['Engine Secure', ins.engineSecure], ['Consumable Expenses', ins.consumableExpenses],
    ['Personal Belonging', ins.personalBelonging], ['Roadside Assistance', ins.roadsideAssistance],
    ['Key Replacement', ins.keyReplacement], ['Emergency Transport & Hotel', ins.emergencyTransportHotel],
  ].filter(([, v]) => v);

  return (
    <div>
      <div className="detail-grid" style={{ marginBottom: 20 }}>
        {fields.map(([label, value]) => (
          <div key={label} className="detail-item">
            <label>{label}</label>
            <div className="value">{value || '—'}</div>
          </div>
        ))}
      </div>
      {addOns.length > 0 && (
        <div>
          <div className="form-section-header">
            <div className="form-section-icon"><ShieldCheck size={18} /></div>
            <div className="form-section-title">Add-On Covers Included</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {addOns.map(([label]) => (
              <span key={label} className="badge badge-success"><CheckCircle size={12} /> {label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Insurance Component ─────────────────────────────────────────────────
const Insurance = () => {
  const [cars, setCars] = useState([]);
  const [insurance, setInsurance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [addModal, setAddModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [renewalModalCar, setRenewalModalCar] = useState(null); // car object for renewal

  const load = useCallback(async () => {
    setLoading(true);
    const [c, i] = await Promise.all([getCars(), getInsurance()]);
    setCars(c); setInsurance(i);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const insMap = {};
  insurance.forEach(i => { insMap[i.vehicleId] = i; });

  const getDaysLeft = (car) => {
    const ins = insMap[car.vehicleId];
    if (!ins || (!ins.renewalDate && !ins.validityDate)) return null;
    return daysUntil(ins.renewalDate || ins.validityDate);
  };

  const getStatus = (car) => {
    const ins = insMap[car.vehicleId];
    if (!ins) return 'Not Available';
    const days = getDaysLeft(car);
    if (days === null) return 'Available';
    if (days < 0) return 'Expired';
    if (days <= 7) return 'Renewal Due (≤7d)';
    if (days <= 30) return 'Expiring Soon';
    return 'Available';
  };

  const rows = cars.map(car => {
    const ins = insMap[car.vehicleId];
    const days = getDaysLeft(car);
    const status = getStatus(car);
    const isRenewalDue = !ins || (days !== null && days <= 7);
    return { car, ins, days, status, isRenewalDue };
  });

  const filtered = rows.filter(({ car, status }) => {
    const q = search.toLowerCase();
    const match = !q || car.carName?.toLowerCase().includes(q) || car.vehicleId?.toLowerCase().includes(q) || car.registrationNo?.toLowerCase().includes(q);
    const st = !statusFilter || (
      statusFilter === 'Renewal Due' ? (status.includes('Due') || status === 'Expired') :
      status === statusFilter
    );
    return match && st;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // 7-day reminder count
  const renewalDueVehicles = rows.filter(r => r.ins && r.days !== null && r.days >= 0 && r.days <= 7);
  const expiredVehicles = rows.filter(r => r.ins && r.days !== null && r.days < 0);

  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.INSURANCE);

  return (
    <div>
      {!canEdit && <ReadOnlyNotice moduleName="Insurance Records & Policies" />}

      <div className="page-header">
        <div>
          <h1 className="page-title">Insurance Management</h1>
          <p className="page-subtitle">{cars.length} fleet vehicles · 7-day renewal reminder tracking enabled</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>
            <Plus size={16} strokeWidth={2.5} /> Add Insurance
          </button>
        )}
      </div>

      {/* ─── 7-Day Renewal Reminder Banner ─── */}
      {renewalDueVehicles.length > 0 && (
        <div className="alert-banner warning" style={{ marginBottom: 18, border: '1.5px solid #fde68a', background: '#fffbeb' }}>
          <Clock size={20} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#92400e', fontSize: 14 }}>⚠️ Renewal Reminder: </strong>
            <span style={{ color: '#78350f' }}>
              <strong>{renewalDueVehicles.length} vehicle(s)</strong> ({renewalDueVehicles.map(v => `${v.car.carName} [${v.days}d left]`).join(', ')}) are in their <strong>7-Day Renewal Week</strong>! Please update policy renewals.
            </span>
          </div>
        </div>
      )}

      {expiredVehicles.length > 0 && (
        <div className="alert-banner danger" style={{ marginBottom: 18 }}>
          <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#991b1b', fontSize: 14 }}>⚠️ Expired Policies: </strong>
            <span style={{ color: '#7f1d1d' }}>
              <strong>{expiredVehicles.length} vehicle(s)</strong> have expired insurance policies. Use <strong>"Renewal Update"</strong> to renew.
            </span>
          </div>
        </div>
      )}

      <div className="data-table-container">
        <div className="filter-bar">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input className="search-input" placeholder="Search vehicles by name, ID, reg no..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-select" style={{ width: 210 }} value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="Renewal Due">⚠️ Renewal Due (≤7 Days / Expired)</option>
            <option value="Available">Available (Active)</option>
            <option value="Expiring Soon">Expiring Soon (≤30 Days)</option>
            <option value="Not Available">Not Available</option>
            <option value="Expired">Expired</option>
          </select>
          {(search || statusFilter) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); }}>
              <X size={14} /> Clear
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', gap: 12 }}>
              <span className="spinner" /> <span style={{ color: '#64748b', fontWeight: 600 }}>Loading insurance records...</span>
            </div>
          ) : paged.length === 0 ? (
            <EmptyState icon={Shield} title="No vehicles found" message="Adjust search filters to view vehicles." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehicle ID</th>
                  <th>Car Name</th>
                  <th>Reg. No.</th>
                  <th>Insurance Company</th>
                  <th>IDV Value</th>
                  <th>Total Premium</th>
                  <th>Insurance Date</th>
                  <th>Validity Date</th>
                  <th>Renewal Date</th>
                  <th>Days Left</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center', background: '#ecfdf5', color: '#065f46', borderLeft: '1.5px solid #a7f3d0' }}>
                    🔄 Renewal Action
                  </th>
                  <th style={{ textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(({ car, ins, days, status, isRenewalDue }) => {
                  const isWeekReminder = days !== null && days >= 0 && days <= 7;
                  const isExpired = days !== null && days < 0;

                  return (
                    <tr key={car.vehicleId} style={{ background: isWeekReminder ? '#fefce8' : isExpired ? '#fff1f2' : undefined }}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{car.vehicleId}</span></td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{car.carName}</div>
                        {isWeekReminder && (
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: 10, display: 'inline-block', marginTop: 2 }}>
                            ⚡ 7-Day Renewal Due
                          </span>
                        )}
                      </td>
                      <td><span style={{ fontWeight: 600 }}>{car.registrationNo}</span></td>
                      <td>{ins?.nameOfCompany || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                      <td>{ins?.idvValue ? `₹${Number(ins.idvValue).toLocaleString('en-IN')}` : '—'}</td>
                      <td>{ins?.totalPremiumAmount ? `₹${Number(ins.totalPremiumAmount).toLocaleString('en-IN')}` : '—'}</td>
                      <td>{ins ? formatDate(ins.date) : '—'}</td>
                      <td>{ins ? formatDate(ins.validityDate) : '—'}</td>
                      <td>
                        {ins ? (
                          <span style={{ fontWeight: isWeekReminder || isExpired ? 800 : 500, color: isWeekReminder ? '#b45309' : isExpired ? '#dc2626' : 'inherit' }}>
                            {formatDate(ins.renewalDate)}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {days !== null ? (
                          <span style={{
                            fontSize: 13, fontWeight: 800,
                            color: days < 0 ? '#dc2626' : days <= 7 ? '#d97706' : days <= 30 ? '#ea580c' : '#059669',
                            background: days <= 7 || days < 0 ? 'rgba(0,0,0,0.04)' : 'transparent',
                            padding: '2px 6px', borderRadius: 6
                          }}>
                            {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <Badge
                          label={
                            !ins ? 'Not Available' :
                            isExpired ? 'Expired' :
                            isWeekReminder ? `Due in ${days}d` :
                            days <= 30 ? 'Expiring Soon' : 'Active'
                          }
                          variant={
                            !ins ? 'danger' :
                            isExpired ? 'danger' :
                            isWeekReminder ? 'warning' :
                            days <= 30 ? 'warning' : 'success'
                          }
                        />
                      </td>

                      {/* ─── Renewal Action Column (Direct Update Button) ─── */}
                      <td style={{ textAlign: 'center', background: isWeekReminder ? '#fef9c3' : '#f0fdf4', borderLeft: '1.5px solid #a7f3d0' }}>
                        {canEdit ? (
                          ins ? (
                            <button
                              onClick={() => setRenewalModalCar(car)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: isWeekReminder || isExpired ? '6px 12px' : '5px 10px',
                                borderRadius: 10, fontSize: 12, fontWeight: 700,
                                cursor: 'pointer', transition: 'all 0.18s',
                                background: isWeekReminder || isExpired ? '#059669' : '#ffffff',
                                color: isWeekReminder || isExpired ? '#ffffff' : '#059669',
                                border: '1.5px solid #059669',
                                boxShadow: isWeekReminder ? '0 2px 8px rgba(5,150,105,0.3)' : 'none'
                              }}
                              title="Click to update insurance renewal"
                            >
                              <RefreshCw size={13} strokeWidth={2.4} />
                              <span>{isWeekReminder || isExpired ? 'Renewal Update' : 'Renew Policy'}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setAddModal(true)}
                              className="btn btn-xs btn-outline"
                              style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px' }}
                            >
                              + Add Policy
                            </button>
                          )
                        ) : (
                          <span style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 600 }}>
                            {ins ? 'Protected' : 'No Policy'}
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {ins ? (
                          <button className="btn btn-ghost btn-xs" onClick={() => setDetailModal(ins)}>
                            <Eye size={15} /> Details
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
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

      {/* Add Insurance Modal */}
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="Add New Insurance" icon={Shield} size="xl">
        <InsuranceForm cars={cars} existingInsurance={insurance}
          onClose={() => setAddModal(false)} onSaved={() => { setAddModal(false); load(); }} />
      </Modal>

      {/* ─── Update Renewal Modal ─── */}
      <Modal
        isOpen={!!renewalModalCar}
        onClose={() => setRenewalModalCar(null)}
        title={`Insurance Renewal Update — ${renewalModalCar?.carName}`}
        icon={RefreshCw}
        size="xl"
      >
        {renewalModalCar && (
          <RenewalUpdateModal
            car={renewalModalCar}
            existingIns={insMap[renewalModalCar.vehicleId]}
            onClose={() => setRenewalModalCar(null)}
            onSaved={() => { setRenewalModalCar(null); load(); }}
          />
        )}
      </Modal>

      {/* Details Modal */}
      <Modal isOpen={!!detailModal} onClose={() => setDetailModal(null)}
        title={`Insurance Details — ${detailModal?.carName}`} icon={Shield} size="lg">
        {detailModal && <InsuranceDetails ins={detailModal} />}
      </Modal>
    </div>
  );
};

export default Insurance;
