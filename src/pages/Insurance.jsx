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
import SpeedingCarLoader from '../components/ui/SpeedingCarLoader';

const EMPTY_FORM = {
  vehicleId: '', date: '', carName: '', nameOfCompany: '',
  hasOwnDamage: 'Yes',
  odStartDate: '',
  odEndDate: '',
  hasThirdParty: 'Yes',
  tpPolicyNo: '',
  tpStartDate: '',
  tpEndDate: '',
  tppdLimit: '750000',
  hasPaCover: 'Yes',
  paCoverType: 'Owner-Driver CPA (₹15 Lakhs)',
  paSumInsured: '1500000',
  paPremium: '',
  paStartDate: '',
  paEndDate: '',
  paNomineeName: '',
  paNomineeRelation: '',
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
  const [form, setForm] = useState({ ...EMPTY_FORM, date: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);

  const set = (field, value) => {
    setForm(f => {
      const updated = { ...f, [field]: value };
      const isCalcField = [
        'basicPremium', 'addOnPremium', 'premiumOfNcb',
        'thirdPartyPremium', 'paPremium',
        'hasOwnDamage', 'hasThirdParty', 'hasPaCover'
      ].includes(field);

      if (isCalcField) {
        const od = updated.hasOwnDamage !== 'No' ? (Number(updated.basicPremium) || 0) : 0;
        const addOn = updated.hasOwnDamage !== 'No' ? (Number(updated.addOnPremium) || 0) : 0;
        const ncb = updated.hasOwnDamage !== 'No' ? (Number(updated.premiumOfNcb) || 0) : 0;
        const tp = updated.hasThirdParty !== 'No' ? (Number(updated.thirdPartyPremium) || 0) : 0;
        const pa = updated.hasPaCover !== 'No' ? (Number(updated.paPremium) || 0) : 0;

        const net = Math.max(0, od + addOn - ncb) + tp + pa;
        if (net > 0) {
          const gst = Math.round(net * 0.18);
          const total = net + gst;
          updated.taxAmount = String(gst);
          updated.totalPremiumAmount = String(total);
          updated.totalPremiumToBePaid = String(total);
        } else {
          updated.taxAmount = '0';
          updated.totalPremiumAmount = '0';
          updated.totalPremiumToBePaid = '0';
        }
      } else if (field === 'taxAmount') {
        const od = updated.hasOwnDamage !== 'No' ? (Number(updated.basicPremium) || 0) : 0;
        const addOn = updated.hasOwnDamage !== 'No' ? (Number(updated.addOnPremium) || 0) : 0;
        const ncb = updated.hasOwnDamage !== 'No' ? (Number(updated.premiumOfNcb) || 0) : 0;
        const tp = updated.hasThirdParty !== 'No' ? (Number(updated.thirdPartyPremium) || 0) : 0;
        const pa = updated.hasPaCover !== 'No' ? (Number(updated.paPremium) || 0) : 0;
        const net = Math.max(0, od + addOn - ncb) + tp + pa;
        const gst = Number(value) || 0;
        const total = net + gst;
        updated.totalPremiumAmount = String(total);
        updated.totalPremiumToBePaid = String(total);
      } else if (field === 'totalPremiumAmount') {
        updated.totalPremiumToBePaid = value;
      }
      return updated;
    });
  };

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

      {/* Coverage Selection Dropdowns */}
      <div className="form-section-header">
        <div className="form-section-icon"><ShieldCheck size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Insurance Coverage Selection</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="form-group">
          <label className="form-label">Own Damage / Self Accident</label>
          <select
            className="form-select"
            value={form.hasOwnDamage}
            onChange={e => set('hasOwnDamage', e.target.value)}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Third Party (TP) Insurance</label>
          <select
            className="form-select"
            value={form.hasThirdParty}
            onChange={e => set('hasThirdParty', e.target.value)}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Personal Accident (PA Cover)</label>
          <select
            className="form-select"
            value={form.hasPaCover}
            onChange={e => set('hasPaCover', e.target.value)}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
      </div>

      {/* 1. Own Damage / Self Accident Form (When YES) */}
      {form.hasOwnDamage === 'Yes' && (
        <>
          <div className="form-section-header">
            <div className="form-section-icon"><Car size={18} strokeWidth={2.2} /></div>
            <div className="form-section-title">Own Damage / Self Accident Details</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">OD Policy Start Date</label>
              <input
                type="date"
                className="form-input"
                value={form.odStartDate || ''}
                onChange={e => {
                  const sDate = e.target.value;
                  const ren = sDate ? calcInsuranceRenewal(sDate) : null;
                  setForm(f => ({
                    ...f,
                    odStartDate: sDate,
                    odEndDate: ren ? toInputDate(ren) : f.odEndDate
                  }));
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">OD Policy End Date</label>
              <input
                type="date"
                className="form-input"
                value={form.odEndDate || ''}
                onChange={e => set('odEndDate', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">IDV Value (₹)</label>
              <input
                type="number"
                className="form-input"
                value={form.idvValue}
                onChange={e => set('idvValue', e.target.value)}
                placeholder="e.g. 1200000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Own Damage / Basic Premium (₹)</label>
              <input
                type="number"
                className="form-input"
                value={form.basicPremium}
                onChange={e => set('basicPremium', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Claimed Insurance Last Year?</label>
              <select className="form-select" value={form.claimedLastYear} onChange={e => set('claimedLastYear', e.target.value)}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Policy Inclusive of NCB?</label>
              <select className="form-select" value={form.policyInclusiveOfNcb} onChange={e => set('policyInclusiveOfNcb', e.target.value)}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">NCB Discount Amount (₹)</label>
              <input
                type="number"
                className="form-input"
                value={form.premiumOfNcb}
                onChange={e => set('premiumOfNcb', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Cashless Facility Available?</label>
              <select className="form-select" value={form.cashlessPolicy} onChange={e => set('cashlessPolicy', e.target.value)}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Add-On Premium (₹)</label>
              <input
                type="number"
                className="form-input"
                value={form.addOnPremium}
                onChange={e => set('addOnPremium', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Add-on Covers */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 12 }}>
              Add-On Covers Included
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
              padding: '16px',
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0'
            }}>
              {[
                ['Depreciation Reimbursement (Zero Dep)', 'depreciationReimbursement'],
                ['Engine Secure', 'engineSecure'],
                ['Consumable Expenses', 'consumableExpenses'],
                ['Loss of Personal Belonging', 'personalBelonging'],
                ['Roadside Assistance (RSA)', 'roadsideAssistance'],
                ['Key Replacement', 'keyReplacement'],
                ['Emergency Transport & Hotel', 'emergencyTransportHotel'],
              ].map(([label, field]) => (
                <CheckField
                  key={field}
                  label={label}
                  checked={form[field]}
                  onChange={() => set(field, !form[field])}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* 2. Third Party Insurance Form (When YES) */}
      {form.hasThirdParty === 'Yes' && (
        <>
          <div className="form-section-header">
            <div className="form-section-icon"><Shield size={18} strokeWidth={2.2} /></div>
            <div className="form-section-title">Third Party (TP) Insurance Details</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="form-group">
              <label className="form-label">TP Policy Start Date</label>
              <input
                type="date"
                className="form-input"
                value={form.tpStartDate || ''}
                onChange={e => {
                  const sDate = e.target.value;
                  const ren = sDate ? calcInsuranceRenewal(sDate) : null;
                  setForm(f => ({
                    ...f,
                    tpStartDate: sDate,
                    tpEndDate: ren ? toInputDate(ren) : f.tpEndDate
                  }));
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">TP Policy End Date</label>
              <input
                type="date"
                className="form-input"
                value={form.tpEndDate || ''}
                onChange={e => set('tpEndDate', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">3rd Party Premium (₹)</label>
              <input
                type="number"
                className="form-input"
                value={form.thirdPartyPremium}
                onChange={e => set('thirdPartyPremium', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">TP Policy / Certificate No.</label>
              <input
                className="form-input"
                value={form.tpPolicyNo}
                onChange={e => set('tpPolicyNo', e.target.value)}
                placeholder="Policy / Certificate number"
              />
            </div>
            <div className="form-group">
              <label className="form-label">TPPD Coverage Limit (₹)</label>
              <input
                type="number"
                className="form-input"
                value={form.tppdLimit}
                onChange={e => set('tppdLimit', e.target.value)}
                placeholder="750000"
              />
            </div>
          </div>
        </>
      )}

      {/* 3. Personal Accident Cover Form (When YES) */}
      {form.hasPaCover === 'Yes' && (
        <>
          <div className="form-section-header">
            <div className="form-section-icon"><Clock size={18} strokeWidth={2.2} /></div>
            <div className="form-section-title">Personal Accident (PA) Cover Details</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="form-group">
              <label className="form-label">PA Cover Type</label>
              <select className="form-select" value={form.paCoverType} onChange={e => set('paCoverType', e.target.value)}>
                <option value="Owner-Driver CPA (₹15 Lakhs)">Owner-Driver CPA (₹15 Lakhs)</option>
                <option value="Paid Driver Cover">Paid Driver Cover</option>
                <option value="Unnamed Passenger Cover">Unnamed Passenger Cover</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">PA Sum Insured (₹)</label>
              <input
                type="number"
                className="form-input"
                value={form.paSumInsured}
                onChange={e => set('paSumInsured', e.target.value)}
                placeholder="1500000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">PA Premium (₹)</label>
              <input
                type="number"
                className="form-input"
                value={form.paPremium}
                onChange={e => set('paPremium', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">PA Start Date</label>
              <input
                type="date"
                className="form-input"
                value={form.paStartDate || ''}
                onChange={e => {
                  const sDate = e.target.value;
                  const ren = sDate ? calcInsuranceRenewal(sDate) : null;
                  setForm(f => ({
                    ...f,
                    paStartDate: sDate,
                    paEndDate: ren ? toInputDate(ren) : f.paEndDate
                  }));
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">PA End Date</label>
              <input
                type="date"
                className="form-input"
                value={form.paEndDate || ''}
                onChange={e => set('paEndDate', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nominee Name</label>
              <input
                className="form-input"
                value={form.paNomineeName}
                onChange={e => set('paNomineeName', e.target.value)}
                placeholder="Full name of nominee"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nominee Relationship</label>
              <input
                className="form-input"
                value={form.paNomineeRelation}
                onChange={e => set('paNomineeRelation', e.target.value)}
                placeholder="e.g. Spouse, Father, Mother"
              />
            </div>
          </div>
        </>
      )}

      {/* Overall Premium Summary & Tax */}
      <div className="form-section-header">
        <div className="form-section-icon"><CreditCard size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Total Premium & Taxes Breakdown</div>
      </div>
      {(() => {
        const odNet = form.hasOwnDamage !== 'No' ? Math.max(0, (Number(form.basicPremium) || 0) + (Number(form.addOnPremium) || 0) - (Number(form.premiumOfNcb) || 0)) : 0;
        const tpAmt = form.hasThirdParty !== 'No' ? (Number(form.thirdPartyPremium) || 0) : 0;
        const paAmt = form.hasPaCover !== 'No' ? (Number(form.paPremium) || 0) : 0;
        const netPremium = odNet + tpAmt + paAmt;

        return (
          <>
            {netPremium > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: '#ecfdf5',
                borderRadius: 8,
                border: '1px solid #a7f3d0',
                marginBottom: 16,
                fontSize: 12.5,
                color: '#065f46',
                flexWrap: 'wrap'
              }}>
                <span>Net Premium: <strong>₹{netPremium.toLocaleString('en-IN')}</strong></span>
                <span>•</span>
                <span>Auto 18% GST: <strong>₹{(Math.round(netPremium * 0.18)).toLocaleString('en-IN')}</strong></span>
                <span>•</span>
                <span style={{ fontWeight: 800 }}>Total Premium: ₹{(netPremium + Math.round(netPremium * 0.18)).toLocaleString('en-IN')}</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 8 }}>
              <div className="form-group">
                <label className="form-label">Tax / GST Amount (18%) (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.taxAmount}
                  onChange={e => set('taxAmount', e.target.value)}
                  placeholder="0"
                />
                {netPremium > 0 && (
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                    Auto: 18% GST on Net ₹{netPremium.toLocaleString('en-IN')}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Total Premium Amount (₹) <span className="required">*</span></label>
                <input
                  type="number"
                  className="form-input"
                  value={form.totalPremiumAmount || form.totalPremiumToBePaid}
                  onChange={e => {
                    const val = e.target.value;
                    set('totalPremiumAmount', val);
                    set('totalPremiumToBePaid', val);
                  }}
                  placeholder="0"
                  style={{ fontWeight: 800, color: '#059669' }}
                />
                {netPremium > 0 && (
                  <div style={{ fontSize: 11.5, color: '#059669', fontWeight: 600, marginTop: 4 }}>
                    ✓ Auto: Net Premium + 18% GST
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

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
    date: '',
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
  const set = (field, val) => {
    setForm(f => {
      const updated = { ...f, [field]: val };
      const isCalcField = ['basicPremium', 'thirdPartyPremium', 'addOnPremium', 'premiumOfNcb'].includes(field);
      if (isCalcField) {
        const od = Number(updated.basicPremium) || 0;
        const addOn = Number(updated.addOnPremium) || 0;
        const ncb = Number(updated.premiumOfNcb) || 0;
        const tp = Number(updated.thirdPartyPremium) || 0;
        const net = Math.max(0, od + addOn - ncb) + tp;
        if (net > 0) {
          const gst = Math.round(net * 0.18);
          const total = net + gst;
          updated.taxAmount = String(gst);
          updated.totalPremiumAmount = String(total);
          updated.totalPremiumToBePaid = String(total);
        } else {
          updated.taxAmount = '0';
          updated.totalPremiumAmount = '0';
          updated.totalPremiumToBePaid = '0';
        }
      } else if (field === 'taxAmount') {
        const od = Number(updated.basicPremium) || 0;
        const addOn = Number(updated.addOnPremium) || 0;
        const ncb = Number(updated.premiumOfNcb) || 0;
        const tp = Number(updated.thirdPartyPremium) || 0;
        const net = Math.max(0, od + addOn - ncb) + tp;
        const gst = Number(val) || 0;
        const total = net + gst;
        updated.totalPremiumAmount = String(total);
        updated.totalPremiumToBePaid = String(total);
      }
      return updated;
    });
  };

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

  const renewNet = Math.max(0, (Number(form.basicPremium) || 0) + (Number(form.addOnPremium) || 0) - (Number(form.premiumOfNcb) || 0)) + (Number(form.thirdPartyPremium) || 0);

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
      {renewNet > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          background: '#ecfdf5',
          borderRadius: 8,
          border: '1px solid #a7f3d0',
          marginBottom: 16,
          fontSize: 12.5,
          color: '#065f46',
          flexWrap: 'wrap'
        }}>
          <span>Net Premium: <strong>₹{renewNet.toLocaleString('en-IN')}</strong></span>
          <span>•</span>
          <span>Auto 18% GST: <strong>₹{(Math.round(renewNet * 0.18)).toLocaleString('en-IN')}</strong></span>
          <span>•</span>
          <span style={{ fontWeight: 800 }}>Total: ₹{(renewNet + Math.round(renewNet * 0.18)).toLocaleString('en-IN')}</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="form-group">
          <label className="form-label">Renewed IDV Value (₹)</label>
          <input type="number" className="form-input" value={form.idvValue} onChange={e => set('idvValue', e.target.value)} placeholder="0" />
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
        <div className="form-group">
          <label className="form-label">Tax / GST (18%) (₹)</label>
          <input type="number" className="form-input" value={form.taxAmount} onChange={e => set('taxAmount', e.target.value)} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label">Total Premium Amount (₹) <span className="required">*</span></label>
          <input type="number" className="form-input" value={form.totalPremiumAmount} onChange={e => set('totalPremiumAmount', e.target.value)} placeholder="0" style={{ fontWeight: 800, color: '#059669' }} />
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
  const hasOd = ins.hasOwnDamage === 'Yes' || !!ins.basicPremium;
  const hasTp = ins.hasThirdParty === 'Yes' || !!ins.thirdPartyPremium;
  const hasPa = ins.hasPaCover === 'Yes' || !!ins.paPremium;

  const addOns = [
    ['Depreciation Reimbursement (Zero Dep)', ins.depreciationReimbursement],
    ['Engine Secure', ins.engineSecure], ['Consumable Expenses', ins.consumableExpenses],
    ['Loss of Personal Belonging', ins.personalBelonging], ['Roadside Assistance', ins.roadsideAssistance],
    ['Key Replacement', ins.keyReplacement], ['Emergency Transport & Hotel', ins.emergencyTransportHotel],
  ].filter(([, v]) => v);

  return (
    <div>
      {/* Active Coverage Type Badges */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
        padding: '12px 16px',
        background: '#f8fafc',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Coverage Included:</span>
        {hasOd && (
          <span style={{ background: '#d1fae5', color: '#065f46', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle size={13} /> Own Damage (Self Accident)
          </span>
        )}
        {hasTp && (
          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle size={13} /> Third Party (TP)
          </span>
        )}
        {hasPa && (
          <span style={{ background: '#fef9c3', color: '#854d0e', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle size={13} /> Personal Accident (PA)
          </span>
        )}
      </div>

      {/* 1. Own Damage Details */}
      {hasOd && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '16px', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, color: '#166534', fontSize: 13.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Car size={16} /> Own Damage / Self Accident
          </div>
          <div className="detail-grid">
            <div className="detail-item">
              <label>OD Validity (कब से कब तक)</label>
              <div className="value">
                {ins.odStartDate ? formatDate(ins.odStartDate) : formatDate(ins.date)} — {ins.odEndDate ? formatDate(ins.odEndDate) : formatDate(ins.validityDate)}
              </div>
            </div>
            <div className="detail-item">
              <label>IDV Value</label>
              <div className="value">{ins.idvValue ? `₹${Number(ins.idvValue).toLocaleString('en-IN')}` : '—'}</div>
            </div>
            <div className="detail-item">
              <label>OD / Basic Premium</label>
              <div className="value">{ins.basicPremium ? `₹${Number(ins.basicPremium).toLocaleString('en-IN')}` : '—'}</div>
            </div>
            <div className="detail-item">
              <label>NCB Discount</label>
              <div className="value">{ins.premiumOfNcb ? `₹${Number(ins.premiumOfNcb).toLocaleString('en-IN')}` : '—'}</div>
            </div>
            <div className="detail-item">
              <label>Cashless Facility</label>
              <div className="value">{ins.cashlessPolicy || 'Yes'}</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Third Party Details */}
      {hasTp && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '16px', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, color: '#1e40af', fontSize: 13.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={16} /> Third Party (TP) Insurance
          </div>
          <div className="detail-grid">
            <div className="detail-item">
              <label>TP Validity (कब से कब तक)</label>
              <div className="value">
                {ins.tpStartDate ? formatDate(ins.tpStartDate) : formatDate(ins.date)} — {ins.tpEndDate ? formatDate(ins.tpEndDate) : formatDate(ins.validityDate)}
              </div>
            </div>
            <div className="detail-item">
              <label>3rd Party Premium</label>
              <div className="value">{ins.thirdPartyPremium ? `₹${Number(ins.thirdPartyPremium).toLocaleString('en-IN')}` : '—'}</div>
            </div>
            <div className="detail-item">
              <label>TP Policy No.</label>
              <div className="value">{ins.tpPolicyNo || '—'}</div>
            </div>
            <div className="detail-item">
              <label>TPPD Limit</label>
              <div className="value">{ins.tppdLimit ? `₹${Number(ins.tppdLimit).toLocaleString('en-IN')}` : '₹7,50,000'}</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Personal Accident Details */}
      {hasPa && (
        <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: 12, padding: '16px', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, color: '#854d0e', fontSize: 13.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={16} /> Personal Accident (PA) Cover
          </div>
          <div className="detail-grid">
            <div className="detail-item">
              <label>PA Validity (कब से कब तक)</label>
              <div className="value">
                {ins.paStartDate ? formatDate(ins.paStartDate) : formatDate(ins.date)} — {ins.paEndDate ? formatDate(ins.paEndDate) : formatDate(ins.validityDate)}
              </div>
            </div>
            <div className="detail-item">
              <label>PA Cover Type</label>
              <div className="value">{ins.paCoverType || 'Owner-Driver CPA'}</div>
            </div>
            <div className="detail-item">
              <label>PA Sum Insured</label>
              <div className="value">{ins.paSumInsured ? `₹${Number(ins.paSumInsured).toLocaleString('en-IN')}` : '₹15,00,000'}</div>
            </div>
            <div className="detail-item">
              <label>PA Premium</label>
              <div className="value">{ins.paPremium ? `₹${Number(ins.paPremium).toLocaleString('en-IN')}` : '—'}</div>
            </div>
            <div className="detail-item">
              <label>Nominee Name</label>
              <div className="value">{ins.paNomineeName || '—'}</div>
            </div>
            <div className="detail-item">
              <label>Nominee Relation</label>
              <div className="value">{ins.paNomineeRelation || '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Financials & Addons */}
      <div className="detail-grid" style={{ marginBottom: 20 }}>
        <div className="detail-item">
          <label>Insurance Company</label>
          <div className="value">{ins.nameOfCompany || '—'}</div>
        </div>
        <div className="detail-item">
          <label>Agent Name</label>
          <div className="value">{ins.agentName || '—'}</div>
        </div>
        <div className="detail-item">
          <label>Add-On Premium</label>
          <div className="value">{ins.addOnPremium ? `₹${Number(ins.addOnPremium).toLocaleString('en-IN')}` : '—'}</div>
        </div>
        <div className="detail-item">
          <label>Tax Amount</label>
          <div className="value">{ins.taxAmount ? `₹${Number(ins.taxAmount).toLocaleString('en-IN')}` : '—'}</div>
        </div>
        <div className="detail-item">
          <label>Total Premium Paid</label>
          <div className="value" style={{ fontWeight: 800, color: '#059669', fontSize: 16 }}>
            {ins.totalPremiumAmount || ins.totalPremiumToBePaid ? `₹${Number(ins.totalPremiumAmount || ins.totalPremiumToBePaid).toLocaleString('en-IN')}` : '—'}
          </div>
        </div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <SpeedingCarLoader size="medium" />
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
