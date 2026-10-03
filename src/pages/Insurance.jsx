// pages/Insurance.jsx
import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Search, Eye, X, AlertTriangle, CheckCircle, Clock, Car, CreditCard, ShieldCheck, RefreshCw, Calendar, Sparkles, Lock, FileText, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCars, getInsurance, addInsurance, renewInsurance } from '../store/dataStore';
import { uploadFileToDrive } from '../api/googleSheetsClient';
import { calcInsuranceRenewal, calcEarliestCoverRenewal, formatDate, daysUntil, today, toInputDate, parseAnyDate, createTimestamp } from '../utils/dateUtils';
import { generateId, generateInsuranceId, generateRenewalId } from '../utils/idGenerator';
import { validateForm, required } from '../utils/validators';
import { ITEMS_PER_PAGE } from '../constants';
import { useAuth, PAGE_KEYS } from '../context/AuthContext';
import ReadOnlyNotice from '../components/shared/ReadOnlyNotice';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import SpeedingCarLoader from '../components/ui/SpeedingCarLoader';
import FileUpload from '../components/ui/FileUpload';

const EMPTY_FORM = {
  vehicleId: '', date: '', carName: '', nameOfCompany: '',
  hasOwnDamage: 'Yes',
  odTenure: '1',
  odStartDate: '',
  odEndDate: '',
  hasThirdParty: 'Yes',
  tpTenure: '3',
  tpPolicyNo: '',
  tpStartDate: '',
  tpEndDate: '',
  tppdLimit: '750000',
  hasPaCover: 'Yes',
  paTenure: '1',
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
  keyReplacement: false, returnToInvoice: false, emergencyTransportHotel: false,
  taxAmount: '', totalPremiumAmount: '',
  claimedLastYear: 'No', policyInclusiveOfNcb: 'No', premiumOfNcb: '',
  cashlessPolicy: 'Yes',
  copyOfInsurance: null,
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
      if (field === 'date' && value) {
        const odRen = calcInsuranceRenewal(value, 1);
        const tpRen = calcInsuranceRenewal(value, updated.tpTenure || 3);
        const paRen = calcInsuranceRenewal(value, updated.paTenure || 1);
        if (!updated.odStartDate) updated.odStartDate = value;
        updated.odEndDate = odRen ? toInputDate(odRen) : updated.odEndDate;
        if (!updated.tpStartDate) updated.tpStartDate = value;
        updated.tpEndDate = tpRen ? toInputDate(tpRen) : updated.tpEndDate;
        if (!updated.paStartDate) updated.paStartDate = value;
        updated.paEndDate = paRen ? toInputDate(paRen) : updated.paEndDate;
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
      let copyOfInsUrl = form.copyOfInsurance;
      if (form.copyOfInsurance?.url && form.copyOfInsurance.url.startsWith('data:')) {
        const driveUrl = await uploadFileToDrive(
          form.copyOfInsurance.url,
          form.copyOfInsurance.name || `${form.vehicleId || 'vehicle'}_Insurance_${Date.now()}`,
          form.copyOfInsurance.type || 'application/pdf'
        );
        if (driveUrl) copyOfInsUrl = driveUrl;
      } else if (form.copyOfInsurance?.url) {
        copyOfInsUrl = form.copyOfInsurance.url;
      }

      const renewal = calcInsuranceRenewal(form.date, 1);
      const activeEnds = [];
      if (form.hasOwnDamage !== 'No' && form.odEndDate) activeEnds.push(form.odEndDate);
      if (form.hasThirdParty !== 'No' && form.tpEndDate) activeEnds.push(form.tpEndDate);
      if (form.hasPaCover !== 'No' && form.paEndDate) activeEnds.push(form.paEndDate);
      const earliestRenewal = calcEarliestCoverRenewal(...activeEnds) || (renewal ? toInputDate(renewal) : '');

      await addInsurance({
        ...form,
        copyOfInsurance: copyOfInsUrl,
        id: generateId(),
        validityDate: earliestRenewal,
        renewalDate: earliestRenewal,
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
                  const ren = sDate ? calcInsuranceRenewal(sDate, 1) : null;
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
                ['ZD (Zero Depreciation)', 'depreciationReimbursement'],
                ['EP (Engine Protect)', 'engineSecure'],
                ['CM (Consumable Expenses)', 'consumableExpenses'],
                ['PB (Loss of Personal Belonging)', 'personalBelonging'],
                ['KP (Key Protect)', 'keyReplacement'],
                ['RTI (Return to Invoice)', 'returnToInvoice'],
                ['Roadside Assistance (RSA)', 'roadsideAssistance'],
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
              <label className="form-label">TP Policy Tenure <span className="required">*</span></label>
              <select
                className="form-select"
                value={form.tpTenure || '3'}
                onChange={e => {
                  const tenure = e.target.value;
                  const sDate = form.tpStartDate || form.date;
                  const ren = sDate ? calcInsuranceRenewal(sDate, tenure) : null;
                  setForm(f => ({
                    ...f,
                    tpTenure: tenure,
                    tpEndDate: ren ? toInputDate(ren) : f.tpEndDate
                  }));
                }}
              >
                <option value="3">3 Years</option>
                <option value="1">1 Year</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">TP Policy Start Date</label>
              <input
                type="date"
                className="form-input"
                value={form.tpStartDate || ''}
                onChange={e => {
                  const sDate = e.target.value;
                  const ren = sDate ? calcInsuranceRenewal(sDate, form.tpTenure || 3) : null;
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
              <label className="form-label">PA Cover Tenure</label>
              <select
                className="form-select"
                value={form.paTenure || '1'}
                onChange={e => {
                  const tenure = e.target.value;
                  const sDate = form.paStartDate || form.date;
                  const ren = sDate ? calcInsuranceRenewal(sDate, tenure) : null;
                  setForm(f => ({
                    ...f,
                    paTenure: tenure,
                    paEndDate: ren ? toInputDate(ren) : f.paEndDate
                  }));
                }}
              >
                <option value="1">1 Year</option>
                <option value="3">3 Years</option>
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
                  const ren = sDate ? calcInsuranceRenewal(sDate, form.paTenure || 1) : null;
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

      {/* ─── 5. Copy Of Insurance Upload ─── */}
      <div className="form-section-header" style={{ marginTop: 24 }}>
        <div className="form-section-icon"><Upload size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Copy Of Insurance (PDF / Document)</div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <FileUpload
          id="ins-copy-add"
          label="Upload Copy Of Insurance (PDF or Image)"
          accept=".pdf,image/*"
          value={form.copyOfInsurance}
          onChange={val => set('copyOfInsurance', val)}
        />
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
const RenewalUpdateModal = ({ car, existingIns, allInsurance = [], onClose, onSaved }) => {
  const existingOdEnd = existingIns?.odEndDate || existingIns?.renewalDate || existingIns?.validityDate || '';
  const existingTpEnd = existingIns?.tpEndDate || '';
  const existingPaEnd = existingIns?.paEndDate || '';

  const nextRenewalId = generateRenewalId(allInsurance || []);
  const [renewalId, setRenewalId] = useState(nextRenewalId);

  const getCoverStatus = (endDateStr) => {
    if (!endDateStr) return { isDue: true, days: null, text: 'No Date Recorded (Due for Renewal)' };
    const days = daysUntil(endDateStr);
    if (days === null || isNaN(days)) return { isDue: true, days: null, text: 'Due for Renewal' };
    if (days < 0) return { isDue: true, days, text: `Expired (${Math.abs(days)} days ago)` };
    if (days <= 30) return { isDue: true, days, text: `Expiring Soon (${days} days left)` };
    return { isDue: false, days, text: `Active & Valid (${days} days remaining)` };
  };

  const odStatus = getCoverStatus(existingOdEnd);
  const tpStatus = getCoverStatus(existingTpEnd);
  const paStatus = getCoverStatus(existingPaEnd);

  // By default, open the form section ONLY IF the renewal date has arrived (isDue === true)
  const [renewOd, setRenewOd] = useState(odStatus.isDue);
  const [renewTp, setRenewTp] = useState(tpStatus.isDue);
  const [renewPa, setRenewPa] = useState(paStatus.isDue);
  const [renewTpTenure, setRenewTpTenure] = useState('1');
  const [renewPaTenure, setRenewPaTenure] = useState('1');

  const [form, setForm] = useState({
    date: '',
    nameOfCompany: existingIns?.nameOfCompany || '',
    agentName: existingIns?.agentName || '',
    
    // 1. Own Damage
    hasOwnDamage: existingIns?.hasOwnDamage || 'Yes',
    odStartDate: '',
    odEndDate: '',
    idvValue: existingIns?.idvValue || '',
    basicPremium: existingIns?.basicPremium || '',
    claimedLastYear: 'No',
    policyInclusiveOfNcb: existingIns?.policyInclusiveOfNcb || 'Yes',
    premiumOfNcb: existingIns?.premiumOfNcb || '',
    cashlessPolicy: existingIns?.cashlessPolicy || 'Yes',
    addOnPremium: existingIns?.addOnPremium || '',
    depreciationReimbursement: existingIns?.depreciationReimbursement || false,
    engineSecure: existingIns?.engineSecure || false,
    consumableExpenses: existingIns?.consumableExpenses || false,
    personalBelonging: existingIns?.personalBelonging || false,
    roadsideAssistance: existingIns?.roadsideAssistance ?? true,
    keyReplacement: existingIns?.keyReplacement || false,
    returnToInvoice: existingIns?.returnToInvoice || false,
    emergencyTransportHotel: existingIns?.emergencyTransportHotel || false,

    // 2. Third Party
    hasThirdParty: existingIns?.hasThirdParty || 'Yes',
    tpPolicyNo: existingIns?.tpPolicyNo || '',
    tpStartDate: '',
    tpEndDate: '',
    tppdLimit: existingIns?.tppdLimit || '750000',
    thirdPartyPremium: existingIns?.thirdPartyPremium || '',

    // 3. Personal Accident
    hasPaCover: existingIns?.hasPaCover || 'Yes',
    paCoverType: existingIns?.paCoverType || 'Owner-Driver CPA (₹15 Lakhs)',
    paSumInsured: existingIns?.paSumInsured || '1500000',
    paPremium: existingIns?.paPremium || '',
    paStartDate: '',
    paEndDate: '',
    paNomineeName: existingIns?.paNomineeName || '',
    paNomineeRelation: existingIns?.paNomineeRelation || '',

    // 4. Totals
    taxAmount: '0',
    totalPremiumAmount: '0',
    totalPremiumToBePaid: '0',
    copyOfInsurance: existingIns?.copyOfInsurance || null,
  });
  const [saving, setSaving] = useState(false);

  const recomputeTotals = (currentForm, isOd, isTp, isPa) => {
    const od = (isOd && currentForm.hasOwnDamage !== 'No') ? (Number(currentForm.basicPremium) || 0) : 0;
    const addOn = (isOd && currentForm.hasOwnDamage !== 'No') ? (Number(currentForm.addOnPremium) || 0) : 0;
    const ncb = (isOd && currentForm.hasOwnDamage !== 'No') ? (Number(currentForm.premiumOfNcb) || 0) : 0;
    const tp = (isTp && currentForm.hasThirdParty !== 'No') ? (Number(currentForm.thirdPartyPremium) || 0) : 0;
    const pa = (isPa && currentForm.hasPaCover !== 'No') ? (Number(currentForm.paPremium) || 0) : 0;

    const net = Math.max(0, od + addOn - ncb) + tp + pa;
    if (net > 0) {
      const gst = Math.round(net * 0.18);
      const total = net + gst;
      return { taxAmount: String(gst), totalPremiumAmount: String(total), totalPremiumToBePaid: String(total) };
    }
    return { taxAmount: '0', totalPremiumAmount: '0', totalPremiumToBePaid: '0' };
  };

  const set = (field, val) => {
    setForm(f => {
      const updated = { ...f, [field]: val };

      // Auto-set sub-dates when main renewal start date is picked
      if (field === 'date') {
        const renStrOd = val ? toInputDate(calcInsuranceRenewal(val, 1)) : '';
        const renStrTp = val ? toInputDate(calcInsuranceRenewal(val, renewTpTenure || 1)) : '';
        const renStrPa = val ? toInputDate(calcInsuranceRenewal(val, renewPaTenure || 1)) : '';
        if (renewOd) {
          if (!updated.odStartDate) updated.odStartDate = val;
          if (!updated.odEndDate) updated.odEndDate = renStrOd;
        }
        if (renewTp) {
          if (!updated.tpStartDate) updated.tpStartDate = val;
          if (!updated.tpEndDate) updated.tpEndDate = renStrTp;
        }
        if (renewPa) {
          if (!updated.paStartDate) updated.paStartDate = val;
          if (!updated.paEndDate) updated.paEndDate = renStrPa;
        }
      }

      const isCalcField = [
        'basicPremium', 'thirdPartyPremium', 'addOnPremium', 'premiumOfNcb',
        'paPremium', 'hasOwnDamage', 'hasThirdParty', 'hasPaCover'
      ].includes(field);

      if (isCalcField) {
        const totals = recomputeTotals(updated, renewOd, renewTp, renewPa);
        return { ...updated, ...totals };
      } else if (field === 'taxAmount') {
        const od = (renewOd && updated.hasOwnDamage !== 'No') ? (Number(updated.basicPremium) || 0) : 0;
        const addOn = (renewOd && updated.hasOwnDamage !== 'No') ? (Number(updated.addOnPremium) || 0) : 0;
        const ncb = (renewOd && updated.hasOwnDamage !== 'No') ? (Number(updated.premiumOfNcb) || 0) : 0;
        const tp = (renewTp && updated.hasThirdParty !== 'No') ? (Number(updated.thirdPartyPremium) || 0) : 0;
        const pa = (renewPa && updated.hasPaCover !== 'No') ? (Number(updated.paPremium) || 0) : 0;
        const net = Math.max(0, od + addOn - ncb) + tp + pa;
        const gst = Number(val) || 0;
        const total = net + gst;
        updated.totalPremiumAmount = String(total);
        updated.totalPremiumToBePaid = String(total);
      }
      return updated;
    });
  };

  const toggleSection = (section, enable) => {
    let nextOd = renewOd;
    let nextTp = renewTp;
    let nextPa = renewPa;
    if (section === 'od') { setRenewOd(enable); nextOd = enable; }
    if (section === 'tp') { setRenewTp(enable); nextTp = enable; }
    if (section === 'pa') { setRenewPa(enable); nextPa = enable; }

    setForm(f => {
      const totals = recomputeTotals(f, nextOd, nextTp, nextPa);
      return { ...f, ...totals };
    });
  };

  const nextRenewal = form.date ? calcInsuranceRenewal(form.date, 1) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) { toast.error('Please enter renewal policy start date'); return; }
    if (!form.nameOfCompany) { toast.error('Please enter insurance company name'); return; }
    if (!renewOd && !renewTp && !renewPa) {
      toast.error('No cover is selected for renewal. Please choose at least one cover.');
      return;
    }

    setSaving(true);
    try {
      let copyOfInsUrl = form.copyOfInsurance;
      if (form.copyOfInsurance?.url && form.copyOfInsurance.url.startsWith('data:')) {
        const driveUrl = await uploadFileToDrive(
          form.copyOfInsurance.url,
          form.copyOfInsurance.name || `${car.registrationNo || car.vehicleId || 'car'}_Insurance_${Date.now()}`,
          form.copyOfInsurance.type || 'application/pdf'
        );
        if (driveUrl) copyOfInsUrl = driveUrl;
      } else if (form.copyOfInsurance?.url) {
        copyOfInsUrl = form.copyOfInsurance.url;
      }

      const nextRenStr = nextRenewal ? toInputDate(nextRenewal) : '';

      // Collect all active end dates to calculate the earliest upcoming renewal
      const allActiveEnds = [];
      const finalOdEnd = renewOd ? (form.odEndDate || toInputDate(calcInsuranceRenewal(form.date, 1))) : existingIns?.odEndDate;
      const finalTpEnd = renewTp ? (form.tpEndDate || toInputDate(calcInsuranceRenewal(form.date, renewTpTenure || 1))) : existingIns?.tpEndDate;
      const finalPaEnd = renewPa ? (form.paEndDate || toInputDate(calcInsuranceRenewal(form.date, renewPaTenure || 1))) : existingIns?.paEndDate;
      if (finalOdEnd) allActiveEnds.push(finalOdEnd);
      if (finalTpEnd) allActiveEnds.push(finalTpEnd);
      if (finalPaEnd) allActiveEnds.push(finalPaEnd);
      const earliestMasterRenewal = calcEarliestCoverRenewal(...allActiveEnds) || nextRenStr;

      const finalRenewalId = (renewalId && renewalId.trim()) || nextRenewalId;

      // Net premiums for each cover
      const currentOdNet = (renewOd && form.hasOwnDamage !== 'No') ? Math.max(0, (Number(form.basicPremium) || 0) + (Number(form.addOnPremium) || 0) - (Number(form.premiumOfNcb) || 0)) : 0;
      const currentTpNet = (renewTp && form.hasThirdParty !== 'No') ? (Number(form.thirdPartyPremium) || 0) : 0;
      const currentPaNet = (renewPa && form.hasPaCover !== 'No') ? (Number(form.paPremium) || 0) : 0;

      // ─── 1. Type Of Cover (Own Damage / Self Accident , Third Party (TP) Insurance , Personal Accident (PA Cover)) ───
      const renewedCoverList = [];
      if (renewOd) renewedCoverList.push('Own Damage / Self Accident');
      if (renewTp) renewedCoverList.push('Third Party (TP) Insurance');
      if (renewPa) renewedCoverList.push('Personal Accident (PA Cover)');
      const typeOfCover = renewedCoverList.join(', ');

      // ─── 2. Policy End Date (Pichhli/Expiring waali cover ki end date) ───
      let previousCoverEndDate = '';
      if (renewOd && existingIns?.odEndDate) previousCoverEndDate = existingIns.odEndDate;
      else if (renewTp && existingIns?.tpEndDate) previousCoverEndDate = existingIns.tpEndDate;
      else if (renewPa && existingIns?.paEndDate) previousCoverEndDate = existingIns.paEndDate;
      else previousCoverEndDate = existingIns?.validityDate || existingIns?.renewalDate || existingIns?.odEndDate || existingIns?.tpEndDate || existingIns?.paEndDate || '';

      // ─── 3. FMS Tracking: Planned & Delay have sheet formulas (do NOT send/overwrite), only Actual gets submission timestamp ───
      const actualSubmissionTimestamp = createTimestamp();

      // ─── 4. Tax & Totals Breakdown for OD, TP, PA ───
      const odTax = renewOd ? Math.round(currentOdNet * 0.18) : '';
      const odTot = renewOd ? (currentOdNet + (odTax || 0)) : '';
      const tpTax = renewTp ? Math.round(currentTpNet * 0.18) : '';
      const tpTot = renewTp ? (currentTpNet + (tpTax || 0)) : '';
      const paTax = renewPa ? Math.round(currentPaNet * 0.18) : '';
      const paTot = renewPa ? (currentPaNet + (paTax || 0)) : '';

      const payload = {
        ...existingIns,
        ...form,
        copyOfInsurance: copyOfInsUrl,
        insuranceId: existingIns?.insuranceId || '', // PURE UNCHANGED ORIGINAL INSURANCE ID!
        renewalId: finalRenewalId,                  // DEDICATED REINS- ID
        vehicleId: car.vehicleId,
        carName: car.carName,
        registrationNo: car.registrationNo || '',

        // Flags indicating which covers were renewed
        renewOd: !!renewOd,
        renewTp: !!renewTp,
        renewPa: !!renewPa,

        // Previous cover end dates
        previousOdEndDate: existingIns?.odEndDate || '',
        previousTpEndDate: existingIns?.tpEndDate || '',
        previousPaEndDate: existingIns?.paEndDate || '',

        // Sheet Header Specifics
        typeOfCover,
        policyEndDate: previousCoverEndDate, // Pichhle waali policy end date!
        actual: actualSubmissionTimestamp,   // Renewal form submit hone par exact timestamp

        odTaxAmount: odTax,
        odTotalAmount: odTot,
        tpTaxAmount: tpTax,
        tpTotalAmount: tpTot,
        paTaxAmount: paTax,
        paTotalAmount: paTot,

        // 1. OD Fields
        hasOwnDamage: renewOd ? form.hasOwnDamage : (existingIns?.hasOwnDamage || 'No'),
        odStartDate: renewOd ? form.odStartDate : (existingIns?.odStartDate || ''),
        odEndDate: renewOd ? (form.odEndDate || toInputDate(calcInsuranceRenewal(form.date, 1))) : (existingIns?.odEndDate || ''),
        basicPremium: renewOd ? form.basicPremium : (existingIns?.basicPremium || ''),
        addOnPremium: renewOd ? form.addOnPremium : (existingIns?.addOnPremium || ''),
        idvValue: renewOd ? form.idvValue : (existingIns?.idvValue || ''),

        // 2. TP Fields
        hasThirdParty: renewTp ? form.hasThirdParty : (existingIns?.hasThirdParty || 'No'),
        tpTenure: renewTp ? (renewTpTenure || '1') : (existingIns?.tpTenure || '1'),
        tpStartDate: renewTp ? form.tpStartDate : (existingIns?.tpStartDate || ''),
        tpEndDate: renewTp ? (form.tpEndDate || toInputDate(calcInsuranceRenewal(form.date, renewTpTenure || 1))) : (existingIns?.tpEndDate || ''),
        thirdPartyPremium: renewTp ? form.thirdPartyPremium : (existingIns?.thirdPartyPremium || ''),
        tpPolicyNo: renewTp ? form.tpPolicyNo : (existingIns?.tpPolicyNo || ''),
        tppdLimit: renewTp ? form.tppdLimit : (existingIns?.tppdLimit || '750000'),

        // 3. PA Fields
        hasPaCover: renewPa ? form.hasPaCover : (existingIns?.hasPaCover || 'No'),
        paTenure: renewPa ? (renewPaTenure || '1') : (existingIns?.paTenure || '1'),
        paStartDate: renewPa ? form.paStartDate : (existingIns?.paStartDate || ''),
        paEndDate: renewPa ? (form.paEndDate || toInputDate(calcInsuranceRenewal(form.date, renewPaTenure || 1))) : (existingIns?.paEndDate || ''),
        paPremium: renewPa ? form.paPremium : (existingIns?.paPremium || ''),

        // Master renewal tracking date: set to earliest upcoming expiration among active covers
        validityDate: earliestMasterRenewal,
        renewalDate: earliestMasterRenewal,
      };

      await renewInsurance(car.vehicleId, payload);
      toast.success(`Insurance for ${car.carName} renewed! (Renewal ID: ${finalRenewalId})`);
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Renewal update failed');
    } finally {
      setSaving(false);
    }
  };

  const odNet = (renewOd && form.hasOwnDamage !== 'No') ? Math.max(0, (Number(form.basicPremium) || 0) + (Number(form.addOnPremium) || 0) - (Number(form.premiumOfNcb) || 0)) : 0;
  const tpNet = (renewTp && form.hasThirdParty !== 'No') ? (Number(form.thirdPartyPremium) || 0) : 0;
  const paNet = (renewPa && form.hasPaCover !== 'No') ? (Number(form.paPremium) || 0) : 0;
  const renewNet = odNet + tpNet + paNet;

  return (
    <form onSubmit={handleSubmit}>
      {/* Vehicle Info Header */}
      <div style={{ padding: '14px 18px', background: '#ecfdf5', borderRadius: 14, border: '1px solid #a7f3d0', marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11.5, color: '#059669', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Vehicle To Renew</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{car.carName}</div>
          <div style={{ fontSize: 12.5, color: '#64748b' }}>{car.vehicleId} · {car.registrationNo}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Permanent Insurance ID</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a', fontFamily: 'monospace' }}>
            {existingIns?.insuranceId || '—'}
          </div>
          {existingIns?.renewalDate && (
            <div style={{ fontSize: 12, color: '#ea580c', fontWeight: 600, marginTop: 2 }}>
              Renewal Due: {formatDate(existingIns.renewalDate)}
            </div>
          )}
        </div>
      </div>

      {/* Main Schedule & Company */}
      <div className="form-section-header">
        <div className="form-section-icon"><Calendar size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">New Policy Renewal Schedule</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Renewal ID (Reins- Auto Generated - Permanent / Read-Only) */}
        <div className="form-group">
          <label className="form-label">Renewal ID <span className="required">*</span></label>
          <input
            type="text"
            className="form-input"
            value={renewalId}
            readOnly
            style={{
              fontFamily: 'monospace',
              fontWeight: 800,
              color: '#047857',
              letterSpacing: 0.5,
              background: '#f0fdf4',
              border: '1.5px solid #a7f3d0',
              cursor: 'not-allowed',
              userSelect: 'all'
            }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">New Policy Start Date <span className="required">*</span></label>
          <input type="date" className="form-input" value={form.date} onChange={e => set('date', e.target.value)} />
          {nextRenewal && (
            <div style={{ fontSize: 12, color: '#059669', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={13} /> Next Renewal: {formatDate(nextRenewal)} (1 Year − 1 Day)
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Insurance Company <span className="required">*</span></label>
          <input className="form-input" value={form.nameOfCompany} onChange={e => set('nameOfCompany', e.target.value)} placeholder="e.g. New India Assurance" />
        </div>
        <div className="form-group">
          <label className="form-label">Insurance Agent / Broker</label>
          <input className="form-input" value={form.agentName} onChange={e => set('agentName', e.target.value)} placeholder="Agent name" />
        </div>
      </div>

      {/* ─── 1. OWN DAMAGE / SELF ACCIDENT ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div className="form-section-header" style={{ margin: 0 }}>
          <div className="form-section-icon"><Car size={18} strokeWidth={2.2} /></div>
          <div className="form-section-title">Own Damage / Self Accident Details</div>
        </div>
        <div>
          {renewOd ? (
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#fef3c7', color: '#b45309' }}>
              ● Due for Renewal
            </span>
          ) : (
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#ecfdf5', color: '#059669' }}>
              ✓ Valid till {existingOdEnd ? formatDate(existingOdEnd) : 'Active'}
            </span>
          )}
        </div>
      </div>

      {!renewOd ? (
        <div style={{ padding: '14px 18px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={15} /> Own Damage is Active & Valid till {existingOdEnd ? formatDate(existingOdEnd) : 'Active'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Renewal date has not arrived yet {odStatus.days !== null ? `(${odStatus.days} days remaining)` : ''}. Form is closed for this section.
            </div>
          </div>
          <button type="button" onClick={() => toggleSection('od', true)} className="btn btn-outline btn-xs" style={{ fontSize: 11.5 }}>
            ↻ Renew Anyway
          </button>
        </div>
      ) : (
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #fed7aa', padding: '16px', marginBottom: 24 }}>
          {!odStatus.isDue && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button type="button" onClick={() => toggleSection('od', false)} className="btn btn-ghost btn-xs" style={{ color: '#64748b', fontSize: 11 }}>
                ✕ Cancel OD Renewal & Keep Existing
              </button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">OD Policy Start Date</label>
              <input type="date" className="form-input" value={form.odStartDate || ''} onChange={e => {
                const s = e.target.value;
                const ren = s ? calcInsuranceRenewal(s) : null;
                set('odStartDate', s);
                if (ren) set('odEndDate', toInputDate(ren));
              }} />
            </div>
            <div className="form-group">
              <label className="form-label">OD Policy End Date</label>
              <input type="date" className="form-input" value={form.odEndDate || ''} onChange={e => set('odEndDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Renewed IDV Value (₹)</label>
              <input type="number" className="form-input" value={form.idvValue} onChange={e => set('idvValue', e.target.value)} placeholder="e.g. 1200000" />
            </div>
            <div className="form-group">
              <label className="form-label">Own Damage / Basic Premium (₹)</label>
              <input type="number" className="form-input" value={form.basicPremium} onChange={e => set('basicPremium', e.target.value)} placeholder="0" />
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
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">NCB Discount Amount (₹)</label>
              <input type="number" className="form-input" value={form.premiumOfNcb} onChange={e => set('premiumOfNcb', e.target.value)} placeholder="0" />
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
              <input type="number" className="form-input" value={form.addOnPremium} onChange={e => set('addOnPremium', e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Add-On Covers Included */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 12 }}>
              Add-On Covers Included
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, padding: '16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              {[
                ['ZD (Zero Depreciation)', 'depreciationReimbursement'],
                ['EP (Engine Protect)', 'engineSecure'],
                ['CM (Consumable Expenses)', 'consumableExpenses'],
                ['PB (Loss of Personal Belonging)', 'personalBelonging'],
                ['KP (Key Protect)', 'keyReplacement'],
                ['RTI (Return to Invoice)', 'returnToInvoice'],
                ['Roadside Assistance (RSA)', 'roadsideAssistance'],
                ['Emergency Transport & Hotel', 'emergencyTransportHotel'],
              ].map(([label, field]) => (
                <CheckField key={field} label={label} checked={form[field]} onChange={() => set(field, !form[field])} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. THIRD PARTY (TP) INSURANCE ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div className="form-section-header" style={{ margin: 0 }}>
          <div className="form-section-icon"><Shield size={18} strokeWidth={2.2} /></div>
          <div className="form-section-title">Third Party (TP) Insurance Details</div>
        </div>
        <div>
          {renewTp ? (
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#fef3c7', color: '#b45309' }}>
              ● Due for Renewal
            </span>
          ) : (
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#ecfdf5', color: '#059669' }}>
              ✓ Valid till {existingTpEnd ? formatDate(existingTpEnd) : 'Active'}
            </span>
          )}
        </div>
      </div>

      {!renewTp ? (
        <div style={{ padding: '14px 18px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={15} /> Third Party (TP) Insurance is Active & Valid till {existingTpEnd ? formatDate(existingTpEnd) : 'Active'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {existingIns?.tpPolicyNo ? `Policy No: ${existingIns.tpPolicyNo} · ` : ''}Renewal date has not arrived yet {tpStatus.days !== null ? `(${tpStatus.days} days remaining)` : ''}. Form is closed for this section.
            </div>
          </div>
          <button type="button" onClick={() => toggleSection('tp', true)} className="btn btn-outline btn-xs" style={{ fontSize: 11.5 }}>
            ↻ Renew Anyway
          </button>
        </div>
      ) : (
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #fed7aa', padding: '16px', marginBottom: 24 }}>
          {!tpStatus.isDue && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button type="button" onClick={() => toggleSection('tp', false)} className="btn btn-ghost btn-xs" style={{ color: '#64748b', fontSize: 11 }}>
                ✕ Cancel TP Renewal & Keep Existing
              </button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">TP Renewal Tenure</label>
              <select
                className="form-select"
                value={renewTpTenure}
                onChange={e => {
                  const val = e.target.value;
                  setRenewTpTenure(val);
                  const s = form.tpStartDate || form.date;
                  const ren = s ? calcInsuranceRenewal(s, val) : null;
                  if (ren) set('tpEndDate', toInputDate(ren));
                }}
              >
                <option value="1">1 Year</option>
                <option value="3">3 Years</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">TP Policy Start Date</label>
              <input type="date" className="form-input" value={form.tpStartDate || ''} onChange={e => {
                const s = e.target.value;
                const ren = s ? calcInsuranceRenewal(s, renewTpTenure || 1) : null;
                set('tpStartDate', s);
                if (ren) set('tpEndDate', toInputDate(ren));
              }} />
            </div>
            <div className="form-group">
              <label className="form-label">TP Policy End Date</label>
              <input type="date" className="form-input" value={form.tpEndDate || ''} onChange={e => set('tpEndDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">3rd Party Premium (₹)</label>
              <input type="number" className="form-input" value={form.thirdPartyPremium} onChange={e => set('thirdPartyPremium', e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">TP Policy / Certificate No.</label>
              <input className="form-input" value={form.tpPolicyNo} onChange={e => set('tpPolicyNo', e.target.value)} placeholder="Policy / Certificate number" />
            </div>
            <div className="form-group">
              <label className="form-label">TPPD Coverage Limit (₹)</label>
              <input type="number" className="form-input" value={form.tppdLimit} onChange={e => set('tppdLimit', e.target.value)} placeholder="750000" />
            </div>
          </div>
        </div>
      )}

      {/* ─── 3. PERSONAL ACCIDENT (PA) COVER ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div className="form-section-header" style={{ margin: 0 }}>
          <div className="form-section-icon"><Clock size={18} strokeWidth={2.2} /></div>
          <div className="form-section-title">Personal Accident (PA) Cover Details</div>
        </div>
        <div>
          {renewPa ? (
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#fef3c7', color: '#b45309' }}>
              ● Due for Renewal
            </span>
          ) : (
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#ecfdf5', color: '#059669' }}>
              ✓ Valid till {existingPaEnd ? formatDate(existingPaEnd) : 'Active'}
            </span>
          )}
        </div>
      </div>

      {!renewPa ? (
        <div style={{ padding: '14px 18px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={15} /> Personal Accident (PA) Cover is Active & Valid till {existingPaEnd ? formatDate(existingPaEnd) : 'Active'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {existingIns?.paNomineeName ? `Nominee: ${existingIns.paNomineeName} · ` : ''}Renewal date has not arrived yet {paStatus.days !== null ? `(${paStatus.days} days remaining)` : ''}. Form is closed for this section.
            </div>
          </div>
          <button type="button" onClick={() => toggleSection('pa', true)} className="btn btn-outline btn-xs" style={{ fontSize: 11.5 }}>
            ↻ Renew Anyway
          </button>
        </div>
      ) : (
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #fed7aa', padding: '16px', marginBottom: 24 }}>
          {!paStatus.isDue && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button type="button" onClick={() => toggleSection('pa', false)} className="btn btn-ghost btn-xs" style={{ color: '#64748b', fontSize: 11 }}>
                ✕ Cancel PA Renewal & Keep Existing
              </button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">PA Cover Type</label>
              <select className="form-select" value={form.paCoverType} onChange={e => set('paCoverType', e.target.value)}>
                <option value="Owner-Driver CPA (₹15 Lakhs)">Owner-Driver CPA (₹15 Lakhs)</option>
                <option value="Named Passenger Cover">Named Passenger Cover</option>
                <option value="Paid Driver Cover">Paid Driver Cover</option>
                <option value="None / Separate Policy">None / Separate Policy</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">PA Renewal Tenure</label>
              <select
                className="form-select"
                value={renewPaTenure}
                onChange={e => {
                  const val = e.target.value;
                  setRenewPaTenure(val);
                  const s = form.paStartDate || form.date;
                  const ren = s ? calcInsuranceRenewal(s, val) : null;
                  if (ren) set('paEndDate', toInputDate(ren));
                }}
              >
                <option value="1">1 Year</option>
                <option value="3">3 Years</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">PA Sum Insured (₹)</label>
              <input type="number" className="form-input" value={form.paSumInsured} onChange={e => set('paSumInsured', e.target.value)} placeholder="1500000" />
            </div>
            <div className="form-group">
              <label className="form-label">PA Premium (₹)</label>
              <input type="number" className="form-input" value={form.paPremium} onChange={e => set('paPremium', e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">PA Start Date</label>
              <input type="date" className="form-input" value={form.paStartDate || ''} onChange={e => {
                const s = e.target.value;
                const ren = s ? calcInsuranceRenewal(s, renewPaTenure || 1) : null;
                set('paStartDate', s);
                if (ren) set('paEndDate', toInputDate(ren));
              }} />
            </div>
            <div className="form-group">
              <label className="form-label">PA End Date</label>
              <input type="date" className="form-input" value={form.paEndDate || ''} onChange={e => set('paEndDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Nominee Name</label>
              <input className="form-input" value={form.paNomineeName} onChange={e => set('paNomineeName', e.target.value)} placeholder="Full name of nominee" />
            </div>
            <div className="form-group">
              <label className="form-label">Nominee Relationship</label>
              <input className="form-input" value={form.paNomineeRelation} onChange={e => set('paNomineeRelation', e.target.value)} placeholder="e.g. Spouse, Father, Mother" />
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. TOTAL PREMIUM & TAXES BREAKDOWN ─── */}
      <div className="form-section-header">
        <div className="form-section-icon"><CreditCard size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Total Premium & Taxes Breakdown</div>
      </div>
      {renewNet > 0 ? (
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
      ) : (
        <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16, fontSize: 12, color: '#64748b' }}>
          ℹ No covers currently selected for renewal. Premium will calculate as you renew covers.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="form-group">
          <label className="form-label">Tax / GST (18%) (₹)</label>
          <input type="number" className="form-input" value={form.taxAmount} onChange={e => set('taxAmount', e.target.value)} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label">Total Premium Amount (₹) <span className="required">*</span></label>
          <input type="number" className="form-input" value={form.totalPremiumAmount} onChange={e => set('totalPremiumAmount', e.target.value)} placeholder="0" style={{ fontWeight: 800, color: '#059669', fontSize: 16 }} />
        </div>
      </div>

      {/* ─── 5. Copy Of Insurance Upload ─── */}
      <div className="form-section-header" style={{ marginTop: 24 }}>
        <div className="form-section-icon"><Upload size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Copy Of Insurance (PDF / Document)</div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <FileUpload
          id="ins-copy-renew"
          label="Upload Renewed Copy Of Insurance (PDF or Image)"
          accept=".pdf,image/*"
          value={form.copyOfInsurance}
          onChange={val => set('copyOfInsurance', val)}
        />
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
const InsuranceDetails = ({ ins, canEdit = true, onRenew }) => {
  const hasOd = ins.hasOwnDamage === 'Yes' || !!ins.basicPremium;
  const hasTp = ins.hasThirdParty === 'Yes' || !!ins.thirdPartyPremium;
  const hasPa = ins.hasPaCover === 'Yes' || !!ins.paPremium;

  const odEnd = ins.odEndDate || ins.renewalDate || ins.validityDate;
  const tpEnd = ins.tpEndDate;
  const paEnd = ins.paEndDate;
  const allEnds = [odEnd, tpEnd, paEnd].filter(Boolean);
  const dayCounts = allEnds.map(d => daysUntil(d)).filter(d => d !== null && !isNaN(d));
  const minDays = dayCounts.length > 0 ? Math.min(...dayCounts) : null;
  const isDueWithin7Days = minDays !== null && minDays <= 7;

  const addOns = [
    ['ZD (Zero Depreciation)', ins.depreciationReimbursement],
    ['EP (Engine Protect)', ins.engineSecure],
    ['CM (Consumables)', ins.consumableExpenses],
    ['PB (Loss of Personal Belonging)', ins.personalBelonging],
    ['KP (Key Protect)', ins.keyReplacement],
    ['RTI (Return to Invoice)', ins.returnToInvoice],
    ['Roadside Assistance (RSA)', ins.roadsideAssistance],
    ['Emergency Transport & Hotel', ins.emergencyTransportHotel],
  ].filter(([, v]) => v);

  return (
    <div>
      {/* Insurance & Vehicle Header Info */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: '#eff6ff',
        borderRadius: 12,
        border: '1px solid #bfdbfe',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 800, textTransform: 'uppercase' }}>Insurance ID</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1e3a8a', fontFamily: 'monospace' }}>
            {ins.insuranceId || '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Vehicle ID</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{ins.vehicleId || '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Car Name</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{ins.carName || '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Insurance Company</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{ins.nameOfCompany || '—'}</div>
        </div>
        {canEdit && onRenew && isDueWithin7Days && (
          <div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onRenew}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, boxShadow: '0 2px 6px rgba(5,150,105,0.25)' }}
            >
              <RefreshCw size={13} strokeWidth={2.4} /> Renewal Update
            </button>
          </div>
        )}
      </div>

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

      {ins.copyOfInsurance && (
        <div style={{ marginTop: 16, marginBottom: 16, padding: '14px 18px', background: '#f0f9ff', borderRadius: 12, border: '1px solid #bae6fd' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={15} /> Copy Of Insurance (Uploaded Document)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <a
              href={typeof ins.copyOfInsurance === 'object' ? ins.copyOfInsurance?.url : ins.copyOfInsurance}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0284c7', borderColor: '#38bdf8', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
            >
              <Eye size={14} /> View / Open Policy PDF / Document
            </a>
          </div>
        </div>
      )}

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

      {canEdit && onRenew && isDueWithin7Days && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Policy renewal due within 7 days. Renew this vehicle policy with a new Renewal ID.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onRenew}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <RefreshCw size={15} strokeWidth={2.4} /> Open Renewal Update
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Date with Renewal Alert Sign ─────────────────────────────────────────────
const DateWithAlert = ({ dateStr }) => {
  if (!dateStr) return <span style={{ color: '#94a3b8' }}>—</span>;
  const days = daysUntil(dateStr);
  if (days === null || isNaN(days)) {
    return <span style={{ color: '#0f172a', fontWeight: 600, fontSize: 12 }}>{formatDate(dateStr)}</span>;
  }

  // 1. Expired (Renewal overdue)
  if (days < 0) {
    return (
      <span
        title={`Expired ${Math.abs(days)} days ago! Immediate renewal required.`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 7px', borderRadius: 6,
          background: '#fee2e2', color: '#b91c1c', fontWeight: 800, fontSize: 11.5,
          border: '1px solid #fca5a5', whiteSpace: 'nowrap'
        }}
      >
        <AlertTriangle size={12} color="#dc2626" /> {formatDate(dateStr)}
      </span>
    );
  }

  // 2. Urgent (≤7 Days)
  if (days <= 7) {
    return (
      <span
        title={`Urgent: Renewal due in ${days} days!`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 7px', borderRadius: 6,
          background: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 11.5,
          border: '1px solid #fde68a', whiteSpace: 'nowrap'
        }}
      >
        <AlertTriangle size={12} color="#d97706" /> {formatDate(dateStr)}
      </span>
    );
  }

  // 3. Expiring Soon (≤30 Days)
  if (days <= 30) {
    return (
      <span
        title={`Renewal upcoming in ${days} days`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 7px', borderRadius: 6,
          background: '#ffedd5', color: '#c2410c', fontWeight: 700, fontSize: 11.5,
          border: '1px solid #fed7aa', whiteSpace: 'nowrap'
        }}
      >
        <Clock size={12} color="#ea580c" /> {formatDate(dateStr)}
      </span>
    );
  }

  // 4. Active & Safe (>30 Days)
  return (
    <span style={{ color: '#0f172a', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
      {formatDate(dateStr)}
    </span>
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
    if (!ins) return null;
    const odEnd = ins.odEndDate || ins.renewalDate || ins.validityDate;
    const tpEnd = ins.tpEndDate;
    const paEnd = ins.paEndDate;
    const allEnds = [odEnd, tpEnd, paEnd].filter(Boolean);
    if (allEnds.length === 0) return null;
    const dayCounts = allEnds.map(d => daysUntil(d)).filter(d => d !== null && !isNaN(d));
    if (dayCounts.length === 0) return null;
    return Math.min(...dayCounts);
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
                  <th style={{ whiteSpace: 'nowrap' }}>Insurance ID</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Vehicle ID</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Car Name</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Reg. No.</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Insurance Company</th>

                  {/* 1. Own Damage Group */}
                  <th style={{ whiteSpace: 'nowrap', background: '#f0fdf4', color: '#166534', borderLeft: '1.5px solid #bbf7d0' }}>Own Damage (OD)</th>
                  <th style={{ whiteSpace: 'nowrap', background: '#f0fdf4', color: '#166534' }}>IDV Value</th>
                  <th style={{ whiteSpace: 'nowrap', background: '#f0fdf4', color: '#166534' }}>OD Policy Start Date</th>
                  <th style={{ whiteSpace: 'nowrap', background: '#f0fdf4', color: '#166534', borderRight: '1.5px solid #bbf7d0' }}>OD Policy End Date</th>

                  {/* 2. Third Party Group */}
                  <th style={{ whiteSpace: 'nowrap', background: '#f0f9ff', color: '#0369a1', borderLeft: '1.5px solid #bae6fd' }}>3rd Party Premium (₹)</th>
                  <th style={{ whiteSpace: 'nowrap', background: '#f0f9ff', color: '#0369a1' }}>TP Policy Start Date</th>
                  <th style={{ whiteSpace: 'nowrap', background: '#f0f9ff', color: '#0369a1', borderRight: '1.5px solid #bae6fd' }}>TP Policy End Date</th>

                  {/* 3. Personal Accident Group */}
                  <th style={{ whiteSpace: 'nowrap', background: '#fffbeb', color: '#92400e', borderLeft: '1.5px solid #fde68a' }}>Personal Accident (PA)</th>
                  <th style={{ whiteSpace: 'nowrap', background: '#fffbeb', color: '#92400e' }}>PA Premium (₹)</th>
                  <th style={{ whiteSpace: 'nowrap', background: '#fffbeb', color: '#92400e' }}>PA Start Date</th>
                  <th style={{ whiteSpace: 'nowrap', background: '#fffbeb', color: '#92400e', borderRight: '1.5px solid #fde68a' }}>PA End Date</th>

                  <th style={{ whiteSpace: 'nowrap' }}>Total Premium</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Copy Of Insurance</th>
                  <th style={{ textAlign: 'center', background: '#ecfdf5', color: '#065f46', borderLeft: '1.5px solid #a7f3d0', whiteSpace: 'nowrap' }}>
                    🔄 Renewal Action
                  </th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(({ car, ins, days, status, isRenewalDue }) => {
                  const isWeekReminder = days !== null && days >= 0 && days <= 7;
                  const isExpired = days !== null && days < 0;

                  return (
                    <tr key={car.vehicleId} style={{ background: isWeekReminder ? '#fefce8' : isExpired ? '#fff1f2' : undefined }}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {ins?.insuranceId ? (
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                            {ins.insuranceId}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{car.vehicleId}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{car.carName}</div>
                        {isWeekReminder && (
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: 10, display: 'inline-block', marginTop: 2 }}>
                            ⚡ 7-Day Renewal Due
                          </span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}><span style={{ fontWeight: 600 }}>{car.registrationNo}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{ins?.nameOfCompany || <span style={{ color: '#94a3b8' }}>—</span>}</td>

                      {/* 1. Own Damage Group */}
                      <td style={{ borderLeft: '1.5px solid #bbf7d0', background: isWeekReminder ? '#fefce8' : '#f0fdf420', whiteSpace: 'nowrap' }}>
                        {ins?.basicPremium ? `₹${Number(ins.basicPremium).toLocaleString('en-IN')}` : (ins?.hasOwnDamage === 'No' ? <span style={{ color: '#94a3b8' }}>No</span> : '—')}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {ins?.idvValue ? `₹${Number(ins.idvValue).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {ins ? formatDate(ins.odStartDate || ins.date) : '—'}
                      </td>
                      <td style={{ borderRight: '1.5px solid #bbf7d0', whiteSpace: 'nowrap' }}>
                        <DateWithAlert dateStr={ins?.odEndDate || ins?.validityDate || ins?.renewalDate} />
                      </td>

                      {/* 2. Third Party Group */}
                      <td style={{ borderLeft: '1.5px solid #bae6fd', background: isWeekReminder ? '#fefce8' : '#f0f9ff20', whiteSpace: 'nowrap' }}>
                        {ins?.thirdPartyPremium ? `₹${Number(ins.thirdPartyPremium).toLocaleString('en-IN')}` : (ins?.hasThirdParty === 'No' ? <span style={{ color: '#94a3b8' }}>No</span> : '—')}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {ins ? formatDate(ins.tpStartDate || (ins.hasThirdParty === 'Yes' ? ins.date : '')) : '—'}
                      </td>
                      <td style={{ borderRight: '1.5px solid #bae6fd', whiteSpace: 'nowrap' }}>
                        <DateWithAlert dateStr={ins?.tpEndDate || (ins?.hasThirdParty === 'Yes' ? (ins.odEndDate || ins.validityDate) : '')} />
                      </td>

                      {/* 3. Personal Accident Group */}
                      <td style={{ borderLeft: '1.5px solid #fde68a', background: isWeekReminder ? '#fefce8' : '#fffbeb20', whiteSpace: 'nowrap' }}>
                        {ins?.hasPaCover === 'No' ? (
                          <span style={{ color: '#94a3b8' }}>No</span>
                        ) : ins?.paCoverType ? (
                          <span style={{ fontSize: 11.5, fontWeight: 600 }}>{ins.paCoverType}</span>
                        ) : (
                          ins?.hasPaCover === 'Yes' ? 'Owner-Driver CPA' : '—'
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {ins?.paPremium ? `₹${Number(ins.paPremium).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {ins ? formatDate(ins.paStartDate || (ins.hasPaCover === 'Yes' ? ins.date : '')) : '—'}
                      </td>
                      <td style={{ borderRight: '1.5px solid #fde68a', whiteSpace: 'nowrap' }}>
                        <DateWithAlert dateStr={ins?.paEndDate || (ins?.hasPaCover === 'Yes' ? (ins.odEndDate || ins.validityDate) : '')} />
                      </td>

                      {/* Total Premium */}
                      <td style={{ fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}>
                        {ins?.totalPremiumAmount || ins?.totalPremiumToBePaid ? `₹${Number(ins.totalPremiumAmount || ins.totalPremiumToBePaid).toLocaleString('en-IN')}` : '—'}
                      </td>

                      {/* Status */}
                      <td style={{ whiteSpace: 'nowrap' }}>
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

                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {ins?.copyOfInsurance ? (
                          <a
                            href={typeof ins.copyOfInsurance === 'object' ? ins.copyOfInsurance?.url : ins.copyOfInsurance}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-xs"
                            style={{ color: '#0284c7', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0f9ff', padding: '3px 8px', borderRadius: 6, border: '1px solid #bae6fd' }}
                            title="Open Copy Of Insurance (PDF)"
                          >
                            <FileText size={13} /> PDF
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* ─── Renewal Action Column (Only within 7 Days of End Date or Expired) ─── */}
                      <td style={{ textAlign: 'center', background: (isWeekReminder || isExpired) ? (isExpired ? '#fee2e2' : '#fef9c3') : undefined, borderLeft: '1.5px solid #a7f3d0', whiteSpace: 'nowrap' }}>
                        {canEdit ? (
                          !ins ? (
                            <button
                              onClick={() => setAddModal(true)}
                              className="btn btn-xs btn-outline"
                              style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px' }}
                            >
                              + Add Policy
                            </button>
                          ) : (isWeekReminder || isExpired) ? (
                            <button
                              onClick={() => setRenewalModalCar(car)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '5px 12px',
                                borderRadius: 10, fontSize: 12, fontWeight: 700,
                                cursor: 'pointer', transition: 'all 0.18s ease',
                                background: isExpired ? '#fef2f2' : '#ffffff',
                                color: isExpired ? '#dc2626' : '#059669',
                                border: `1.5px solid ${isExpired ? '#ef4444' : '#10b981'}`,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                              }}
                              title={isExpired ? 'Policy expired! Click to renew' : `Due in ${days} days! Click to renew`}
                            >
                              <RefreshCw size={13} strokeWidth={2.4} />
                              <span>Renew Policy</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>—</span>
                          )
                        ) : (
                          <span style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 600 }}>
                            {ins ? 'Protected' : 'No Policy'}
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
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
            allInsurance={insurance}
            onClose={() => setRenewalModalCar(null)}
            onSaved={() => { setRenewalModalCar(null); load(); }}
          />
        )}
      </Modal>

      {/* Details Modal */}
      <Modal isOpen={!!detailModal} onClose={() => setDetailModal(null)}
        title={`Insurance Details — ${detailModal?.carName}`} icon={Shield} size="lg">
        {detailModal && (
          <InsuranceDetails
            ins={detailModal}
            canEdit={canEdit}
            onRenew={() => {
              const car = cars.find(c => c.vehicleId === detailModal.vehicleId || c.carName === detailModal.carName);
              if (car) {
                setDetailModal(null);
                setRenewalModalCar(car);
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default Insurance;
