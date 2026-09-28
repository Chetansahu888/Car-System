// pages/AccidentClaims.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, Search, Eye, Edit2, Trash2, X, Wrench, Shield, FileText, User, CheckCircle, Lock, Clock, CheckCircle2, FileCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { getClaims, addClaim, updateClaim, processAccidentClaim, deleteClaim, getRepairs, getCars, getInsurance, onStoreUpdate } from '../store/dataStore';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import { generateClaimNo, generateId } from '../utils/idGenerator';
import { formatDate, today, toInputDate } from '../utils/dateUtils';
import { validateForm, required } from '../utils/validators';
import { CLAIM_STATUS_STEPS, ITEMS_PER_PAGE, SURVEY_STATUS, CLAIM_TYPES } from '../constants';
import { useAuth, PAGE_KEYS } from '../context/AuthContext';
import ReadOnlyNotice from '../components/shared/ReadOnlyNotice';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import FileUpload from '../components/ui/FileUpload';
import SpeedingCarLoader from '../components/ui/SpeedingCarLoader';
import { openDocument } from '../utils/fileUtils';
import { uploadFileToDrive } from '../api/googleSheetsClient';

const EMPTY_CLAIM = {
  repairNo: '', vehicleId: '', vehicleName: '', registrationNo: '',
  dateOfAccident: '', timeOfAccident: '', accidentLocation: '', accidentReason: '',
  driverName: '', driverMobileNo: '', insuranceCompany: '', policyNo: '',
  policyValidity: '', insuranceClaim: 'Yes', estimatedClaimAmount: '', typeOfClaim: 'Own Damage',
  accidentPhotos: null, firRequired: 'No', firCopy: null, policeReport: null, otherDocuments: null,
  claimIntimatedDate: '', claimIntimationNo: '', surveyorName: '', surveyorMobileNo: '',
  surveyDate: '', surveyStatus: 'Pending', claimStatus: 'Claim Not Intimated',
  claimApprovedAmount: '', claimRejectedReason: '', claimSettlementDate: '', remarks: ''
};

// ─── FULL NEW / EDIT CLAIM FORM ───────────────────────────────────────────────
const ClaimForm = ({ claim, claims, repairs, onClose, onSaved, preselectedRepairNo }) => {
  const isEdit = !!claim;
  const getInitialVehicleId = () => {
    if (claim?.vehicleId) return claim.vehicleId;
    if (claim?.repairNo) {
      const r = repairs.find(x => x.repairNo === claim.repairNo);
      return r?.vehicleId || '';
    }
    return '';
  };
  const [form, setForm] = useState(isEdit ? { ...claim, vehicleId: getInitialVehicleId() } : { ...EMPTY_CLAIM, repairNo: preselectedRepairNo || '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleRepairSelect = async (repairNo) => {
    const repair = repairs.find(r => r.repairNo === repairNo);
    let insComp = form.insuranceCompany || '';
    if (!insComp && repair) {
      try {
        const insList = await getInsurance();
        const ins = insList.find(i => i.vehicleId === repair.vehicleId || (repair.carName && i.carName?.toLowerCase() === repair.carName?.toLowerCase()));
        if (ins) insComp = ins.nameOfCompany || ins.insuranceCompany || '';
      } catch (e) {}
    }
    setForm(f => ({
      ...f,
      repairNo,
      vehicleId: repair?.vehicleId || '',
      vehicleName: repair?.carName || '',
      registrationNo: repair?.registrationNo || f.registrationNo || '',
      dateOfAccident: f.dateOfAccident || repair?.dateOfAccident || today(),
      accidentReason: f.accidentReason || repair?.reasonForRepair || '',
      accidentLocation: f.accidentLocation || repair?.garage || '',
      driverName: f.driverName || repair?.whoTakingCar || '',
      insuranceCompany: f.insuranceCompany || repair?.insuranceCompany || insComp,
      estimatedClaimAmount: f.estimatedClaimAmount || repair?.estimatedClaimAmount || '',
      typeOfClaim: f.typeOfClaim || repair?.typeOfClaim || 'Own Damage',
    }));
  };

  useEffect(() => {
    if (preselectedRepairNo && !isEdit) handleRepairSelect(preselectedRepairNo);
  }, [preselectedRepairNo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm(form, { repairNo: [required], dateOfAccident: [required] });
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const processedForm = { ...form };
      const docFields = [
        { key: 'accidentPhotos', name: `${claim?.claimNo || 'CLM'}_AccidentPhotos` },
        { key: 'policeReport', name: `${claim?.claimNo || 'CLM'}_PoliceReport` },
        { key: 'firCopy', name: `${claim?.claimNo || 'CLM'}_FIRCopy` },
        { key: 'otherDocuments', name: `${claim?.claimNo || 'CLM'}_OtherDoc` },
      ];
      for (const df of docFields) {
        let docVal = processedForm[df.key];
        if (docVal && typeof docVal === 'object' && docVal.url) {
          if (typeof docVal.url === 'string' && docVal.url.startsWith('data:')) {
            const driveUrl = await uploadFileToDrive(docVal.url, df.name, docVal.type);
            processedForm[df.key] = driveUrl || docVal.url;
          } else {
            processedForm[df.key] = docVal.url;
          }
        }
      }

      if (isEdit) {
        await updateClaim(claim.claimNo, { ...processedForm, updatedAt: new Date().toISOString() });
        toast.success('Claim updated');
      } else {
        const claimNo = generateClaimNo(claims);
        await addClaim({ ...processedForm, claimNo, id: generateId(), timestamp: new Date().toISOString(), createdAt: new Date().toISOString() });
        toast.success(`Claim ${claimNo} registered`);
      }
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to save claim');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <LoadingOverlay isVisible={saving} message={isEdit ? "Updating Claim in Google Sheet..." : "Registering Claim in Google Sheet..."} />
      {isEdit && (
        <div style={{ padding: '10px 16px', background: '#ffedd5', borderRadius: 12, border: '1px solid #fed7aa', marginBottom: 20, fontSize: 13.5, color: '#c2410c', fontWeight: 700 }}>
          📋 Claim No: <span style={{ color: '#0f172a' }}>{claim.claimNo}</span>
        </div>
      )}

      <div className="form-section-header">
        <div className="form-section-icon"><Wrench size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Repair Reference</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">Repair No. <span className="required">*</span></label>
          <select className={`form-select ${errors.repairNo ? 'error' : ''}`} value={form.repairNo}
            onChange={e => handleRepairSelect(e.target.value)} disabled={isEdit}>
            <option value="">Select repair</option>
            {repairs.filter(r => r.insuranceToBeClaimed === 'Yes').map(r => (
              <option key={r.repairNo} value={r.repairNo}>{r.repairNo} — {r.carName} {r.vehicleId ? `(${r.vehicleId})` : ''}</option>
            ))}
          </select>
          {errors.repairNo && <span className="form-error">{errors.repairNo}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Vehicle ID</label>
          <input className="form-input" value={form.vehicleId || ''} readOnly style={{ opacity: 0.8, background: '#f8fafc', fontFamily: 'monospace', fontWeight: 600 }} placeholder="Auto-populated from Repair" />
        </div>
        <div className="form-group">
          <label className="form-label">Vehicle Name</label>
          <input className="form-input" value={form.vehicleName} readOnly style={{ opacity: 0.8, background: '#f8fafc' }} />
        </div>
        <div className="form-group">
          <label className="form-label">Registration No.</label>
          <input className="form-input" value={form.registrationNo} onChange={e => set('registrationNo', e.target.value)} />
        </div>
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><AlertTriangle size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Accident Incident Details</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">Date of Accident <span className="required">*</span></label>
          <input type="date" className="form-input" value={toInputDate(form.dateOfAccident) || form.dateOfAccident || ''} onChange={e => set('dateOfAccident', e.target.value)} />
          {errors.dateOfAccident && <span className="form-error">{errors.dateOfAccident}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Time of Accident</label>
          <input type="time" className="form-input" value={form.timeOfAccident} onChange={e => set('timeOfAccident', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Accident Location</label>
          <input className="form-input" value={form.accidentLocation} onChange={e => set('accidentLocation', e.target.value)} placeholder="Location / address" />
        </div>
        <div className="form-group">
          <label className="form-label">Driver Name</label>
          <input className="form-input" value={form.driverName} onChange={e => set('driverName', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Driver Mobile No.</label>
          <input className="form-input" value={form.driverMobileNo} onChange={e => set('driverMobileNo', e.target.value)} />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Accident Reason / Description</label>
          <textarea className="form-textarea" rows={3} value={form.accidentReason} onChange={e => set('accidentReason', e.target.value)} placeholder="Describe how the accident occurred..." style={{ resize: 'vertical' }} />
        </div>
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><Shield size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Insurance & Policy Coverage</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">Insurance Company</label>
          <input className="form-input" value={form.insuranceCompany} onChange={e => set('insuranceCompany', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Policy No.</label>
          <input className="form-input" value={form.policyNo} onChange={e => set('policyNo', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Policy Validity</label>
          <input type="date" className="form-input" value={form.policyValidity} onChange={e => set('policyValidity', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Estimated Claim Amount (₹)</label>
          <input type="number" className="form-input" value={form.estimatedClaimAmount} onChange={e => set('estimatedClaimAmount', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Type Of Claim</label>
          <select className="form-select" value={form.typeOfClaim} onChange={e => set('typeOfClaim', e.target.value)}>
            {CLAIM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">FIR Required?</label>
          <select className="form-select" value={form.firRequired} onChange={e => set('firRequired', e.target.value)}>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><CheckCircle size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Survey & Processing Status</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">Claim Intimated Date</label>
          <input type="date" className="form-input" value={form.claimIntimatedDate} onChange={e => set('claimIntimatedDate', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Claim Intimation No.</label>
          <input className="form-input" value={form.claimIntimationNo} onChange={e => set('claimIntimationNo', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Surveyor Name</label>
          <input className="form-input" value={form.surveyorName} onChange={e => set('surveyorName', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Surveyor Mobile</label>
          <input className="form-input" value={form.surveyorMobileNo} onChange={e => set('surveyorMobileNo', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Survey Date</label>
          <input type="date" className="form-input" value={form.surveyDate} onChange={e => set('surveyDate', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Survey Status</label>
          <select className="form-select" value={form.surveyStatus} onChange={e => set('surveyStatus', e.target.value)}>
            {SURVEY_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Claim Status</label>
          <select className="form-select" value={form.claimStatus} onChange={e => set('claimStatus', e.target.value)}>
            {CLAIM_STATUS_STEPS.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        {form.claimStatus === 'Approved' || form.claimStatus === 'Settled' ? (
          <div className="form-group">
            <label className="form-label">Claim Approved Amount (₹)</label>
            <input type="number" className="form-input" value={form.claimApprovedAmount} onChange={e => set('claimApprovedAmount', e.target.value)} />
          </div>
        ) : null}
        {form.claimStatus === 'Rejected' && (
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Rejection Reason <span className="required">*</span></label>
            <textarea className="form-textarea" rows={2} value={form.claimRejectedReason} onChange={e => set('claimRejectedReason', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Settlement Date</label>
          <input type="date" className="form-input" value={form.claimSettlementDate} onChange={e => set('claimSettlementDate', e.target.value)} />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Remarks</label>
          <textarea className="form-textarea" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} style={{ resize: 'vertical' }} />
        </div>
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><FileText size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Claim Documents & Evidence</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
        <div className="form-group">
          <label className="form-label">Accident Photos</label>
          <FileUpload value={form.accidentPhotos} onChange={v => set('accidentPhotos', v)} accept="image/*" label="Upload Accident Photos" id="accident-photos" />
        </div>
        {form.firRequired === 'Yes' && (
          <div className="form-group">
            <label className="form-label">FIR Copy</label>
            <FileUpload value={form.firCopy} onChange={v => set('firCopy', v)} accept="image/*,.pdf" label="Upload FIR Copy" id="fir-copy" />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Police Report</label>
          <FileUpload value={form.policeReport} onChange={v => set('policeReport', v)} accept="image/*,.pdf" label="Upload Police Report" id="police-report" />
        </div>
        <div className="form-group">
          <label className="form-label">Other Documents</label>
          <FileUpload value={form.otherDocuments} onChange={v => set('otherDocuments', v)} accept="image/*,.pdf" label="Upload Other Documents" id="other-docs" />
        </div>
      </div>

      <div className="modal-footer" style={{ padding: '20px 0 0' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : isEdit ? 'Update Claim' : 'Register Claim'}
        </button>
      </div>
    </form>
  );
};

// ─── ACTION PROCESS FORM MODAL (For Pending Claims) ───────────────────────────
const ClaimProcessForm = ({ claim, onClose, onSaved }) => {
  const [form, setForm] = useState({
    insuranceCompany: claim.insuranceCompany || '',
    policyNo: claim.policyNo || '',
    policyValidity: claim.policyValidity || '',
    estimatedClaimAmount: claim.estimatedClaimAmount || '',
    typeOfClaim: claim.typeOfClaim || 'Own Damage',
    firRequired: claim.firRequired || 'No',
    claimIntimatedDate: claim.claimIntimatedDate || today(),
    claimIntimationNo: claim.claimIntimationNo || '',
    surveyorName: claim.surveyorName || '',
    surveyorMobileNo: claim.surveyorMobileNo || '',
    surveyDate: claim.surveyDate || '',
    surveyStatus: claim.surveyStatus || 'Pending',
    claimStatus: claim.claimStatus && claim.claimStatus !== 'Settled' ? claim.claimStatus : 'Claim Under Process',
    claimApprovedAmount: claim.claimApprovedAmount || '',
    claimRejectedReason: claim.claimRejectedReason || '',
    claimSettlementDate: claim.claimSettlementDate || '',
    remarks: claim.remarks || '',
    accidentPhotos: claim.accidentPhotos || null,
    firCopy: claim.firCopy || null,
    policeReport: claim.policeReport || null,
    otherDocuments: claim.otherDocuments || null,
  });

  const [saving, setSaving] = useState(false);
  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.insuranceCompany) {
      toast.error('Insurance Company is required');
      return;
    }
    if (form.claimStatus === 'Rejected' && !form.claimRejectedReason?.trim()) {
      toast.error('Please enter Rejection Reason');
      return;
    }
    setSaving(true);
    try {
      const processedForm = { ...form };
      const docFields = [
        { key: 'accidentPhotos', name: `${claim.claimNo}_AccidentPhotos` },
        { key: 'policeReport', name: `${claim.claimNo}_PoliceReport` },
        { key: 'firCopy', name: `${claim.claimNo}_FIRCopy` },
        { key: 'otherDocuments', name: `${claim.claimNo}_OtherDoc` },
      ];

      for (const df of docFields) {
        let docVal = processedForm[df.key];
        if (docVal && typeof docVal === 'object' && docVal.url) {
          if (typeof docVal.url === 'string' && docVal.url.startsWith('data:')) {
            const driveUrl = await uploadFileToDrive(docVal.url, df.name, docVal.type);
            processedForm[df.key] = driveUrl || docVal.url;
          } else {
            processedForm[df.key] = docVal.url;
          }
        }
      }

      await processAccidentClaim(claim.claimNo, processedForm);
      toast.success(`Claim ${claim.claimNo} processed and saved to sheet!`);
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to update claim process');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <LoadingOverlay isVisible={saving} message="Updating Claim Processing to Google Sheets..." />

      {/* Claim Summary Card */}
      <div style={{
        padding: '14px 18px', background: '#eff6ff', borderRadius: 14,
        border: '1.5px solid #bfdbfe', marginBottom: 20, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Processing Accident Claim
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
            <span style={{ color: '#ea580c', fontFamily: 'monospace' }}>{claim.claimNo}</span> — {claim.vehicleName}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Repair No: <strong style={{ color: '#059669', fontFamily: 'monospace' }}>{claim.repairNo}</strong> | Vehicle ID: <strong>{claim.vehicleId || '—'}</strong> | Accident: <strong>{formatDate(claim.dateOfAccident)}</strong>
          </div>
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 12, background: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#2563eb', boxShadow: '0 2px 6px rgba(37,99,235,0.15)'
        }}>
          <Shield size={22} />
        </div>
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><Shield size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">1. Insurance & Policy Coverage</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">Insurance Company <span className="required">*</span></label>
          <input className="form-input" value={form.insuranceCompany} onChange={e => set('insuranceCompany', e.target.value)} placeholder="e.g. UNITED INDIA INSURANCE..." />
        </div>
        <div className="form-group">
          <label className="form-label">Policy No.</label>
          <input className="form-input" value={form.policyNo} onChange={e => set('policyNo', e.target.value)} placeholder="Enter policy number" />
        </div>
        <div className="form-group">
          <label className="form-label">Policy Validity</label>
          <input type="date" className="form-input" value={toInputDate(form.policyValidity) || form.policyValidity || ''} onChange={e => set('policyValidity', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Estimated Claim Amount (₹)</label>
          <input type="number" className="form-input" value={form.estimatedClaimAmount} onChange={e => set('estimatedClaimAmount', e.target.value)} placeholder="₹ Amount" />
        </div>
        <div className="form-group">
          <label className="form-label">Type Of Claim</label>
          <select className="form-select" value={form.typeOfClaim} onChange={e => set('typeOfClaim', e.target.value)}>
            {CLAIM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">FIR Required?</label>
          <select className="form-select" value={form.firRequired} onChange={e => set('firRequired', e.target.value)}>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><CheckCircle size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">2. Survey & Claim Status</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">Survey Status <span className="required">*</span></label>
          <select className="form-select" value={form.surveyStatus} onChange={e => set('surveyStatus', e.target.value)}>
            {SURVEY_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Claim Status <span className="required">*</span></label>
          <select className="form-select" value={form.claimStatus} onChange={e => set('claimStatus', e.target.value)} style={{ fontWeight: 700 }}>
            {CLAIM_STATUS_STEPS.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Claim Intimated Date</label>
          <input type="date" className="form-input" value={toInputDate(form.claimIntimatedDate) || form.claimIntimatedDate || ''} onChange={e => set('claimIntimatedDate', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Claim Intimation No.</label>
          <input className="form-input" value={form.claimIntimationNo} onChange={e => set('claimIntimationNo', e.target.value)} placeholder="Intimation reference no." />
        </div>
        <div className="form-group">
          <label className="form-label">Surveyor Name</label>
          <input className="form-input" value={form.surveyorName} onChange={e => set('surveyorName', e.target.value)} placeholder="Surveyor name" />
        </div>
        <div className="form-group">
          <label className="form-label">Surveyor Mobile</label>
          <input className="form-input" value={form.surveyorMobileNo} onChange={e => set('surveyorMobileNo', e.target.value)} placeholder="Mobile no." />
        </div>
        <div className="form-group">
          <label className="form-label">Survey Date</label>
          <input type="date" className="form-input" value={toInputDate(form.surveyDate) || form.surveyDate || ''} onChange={e => set('surveyDate', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Settlement Date</label>
          <input type="date" className="form-input" value={toInputDate(form.claimSettlementDate) || form.claimSettlementDate || ''} onChange={e => set('claimSettlementDate', e.target.value)} />
        </div>
        {(form.claimStatus === 'Approved' || form.claimStatus === 'Settled') && (
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Claim Approved Amount (₹)</label>
            <input type="number" className="form-input" value={form.claimApprovedAmount} onChange={e => set('claimApprovedAmount', e.target.value)} placeholder="₹ Approved Amount" style={{ borderColor: '#059669', background: '#ecfdf5' }} />
          </div>
        )}
        {form.claimStatus === 'Rejected' && (
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Rejection Reason <span className="required">*</span></label>
            <textarea className="form-textarea" rows={2} value={form.claimRejectedReason} onChange={e => set('claimRejectedReason', e.target.value)} placeholder="Reason for claim rejection..." style={{ resize: 'vertical' }} />
          </div>
        )}
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Remarks</label>
          <textarea className="form-textarea" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Internal remarks or updates..." style={{ resize: 'vertical' }} />
        </div>
      </div>

      <div className="form-section-header">
        <div className="form-section-icon"><FileText size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">3. Claim Documents & Evidence (Optional)</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
        <div className="form-group">
          <label className="form-label">Accident Photos</label>
          <FileUpload value={form.accidentPhotos} onChange={v => set('accidentPhotos', v)} accept="image/*" label="Upload Accident Photos" id="action-accident-photos" />
        </div>
        {form.firRequired === 'Yes' && (
          <div className="form-group">
            <label className="form-label">FIR Copy</label>
            <FileUpload value={form.firCopy} onChange={v => set('firCopy', v)} accept="image/*,.pdf" label="Upload FIR Copy" id="action-fir-copy" />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Police Report</label>
          <FileUpload value={form.policeReport} onChange={v => set('policeReport', v)} accept="image/*,.pdf" label="Upload Police Report" id="action-police-report" />
        </div>
        <div className="form-group">
          <label className="form-label">Other Documents</label>
          <FileUpload value={form.otherDocuments} onChange={v => set('otherDocuments', v)} accept="image/*,.pdf" label="Upload Other Documents" id="action-other-docs" />
        </div>
      </div>

      <div className="modal-footer" style={{ padding: '20px 0 0' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', fontWeight: 700 }}>
          {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Submitting Process...</> : '✓ Save Claim Processing'}
        </button>
      </div>
    </form>
  );
};

const ClaimStatusStepper = ({ status }) => {
  const steps = [...CLAIM_STATUS_STEPS];
  const currentIdx = steps.indexOf(status);
  const isRejected = status === 'Rejected';
  return (
    <div style={{ display: 'flex', gap: 0, overflowX: 'auto', padding: '12px 0' }}>
      {steps.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', border: '2px solid',
                borderColor: done ? '#059669' : active ? (isRejected ? '#ef4444' : '#059669') : '#e2e8f0',
                background: done ? '#ecfdf5' : active ? (isRejected ? '#fee2e2' : '#059669') : '#ffffff',
                color: done ? '#059669' : active ? (isRejected ? '#dc2626' : '#ffffff') : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
                flexShrink: 0, transition: 'all 0.25s'
              }}>
                {done ? '✓' : idx + 1}
              </div>
              <div style={{ fontSize: 10.5, color: done ? '#059669' : active ? '#0f172a' : '#94a3b8', textAlign: 'center', width: 75, lineHeight: 1.2, fontWeight: active ? 800 : 600 }}>
                {step}
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#86efac' : '#e2e8f0', minWidth: 20, margin: '0 4px', marginBottom: 22 }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const AccidentClaims = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'view' | 'process'
  const [selected, setSelected] = useState(null);
  const [preselectedRepairNo, setPreselectedRepairNo] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, r] = await Promise.all([getClaims(), getRepairs()]);
    setClaims(c); setRepairs(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const unsub = onStoreUpdate(() => {
      load();
    });
    return unsub;
  }, [load]);

  useEffect(() => {
    const repairNo = location.state?.preselectedRepairNo;
    const searchVal = location.state?.searchClaim;
    if (searchVal) {
      setSearch(searchVal);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (repairNo) {
      setSelected(null);
      setPreselectedRepairNo(repairNo);
      setModal('add');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Separate pending and completed claims
  // Pending: Claims that have NOT been processed yet (no process form submitted)
  // Completed: Claims where "Process Claim" form has been submitted (actual date is set, isProcessed is true, settled/approved/rejected, or policyNo filled)
  const { pendingClaims, completedClaims } = useMemo(() => {
    const pending = [];
    const completed = [];
    claims.forEach(c => {
      const st = (c.claimStatus || '').trim().toLowerCase();
      const surv = (c.surveyStatus || '').trim().toLowerCase();
      const hasActual = !!(c.actual && String(c.actual).trim() !== '');
      const isFinishedStatus = st === 'settled' || st === 'rejected' || st === 'approved' || st === 'claim settled';
      const hasProcessData = !!(c.policyNo && String(c.policyNo).trim() !== '');
      const isCompleted = c.isProcessed || hasActual || isFinishedStatus || hasProcessData || surv === 'completed';

      if (isCompleted) {
        completed.push(c);
      } else {
        pending.push(c);
      }
    });
    return { pendingClaims: pending, completedClaims: completed };
  }, [claims]);

  const activeClaimsList = activeTab === 'pending' ? pendingClaims : completedClaims;

  const filtered = activeClaimsList.filter(c => {
    const q = search.toLowerCase();
    const vehId = (c.vehicleId || repairs.find(r => r.repairNo === c.repairNo)?.vehicleId || '').toLowerCase();
    const match = !q || c.claimNo?.toLowerCase().includes(q) || c.repairNo?.toLowerCase().includes(q) || c.vehicleName?.toLowerCase().includes(q) || vehId.includes(q);
    const st = !statusFilter || c.claimStatus === statusFilter;
    return match && st;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteClaim(deleteDialog.claimNo);
      toast.success('Claim deleted');
      setDeleteDialog(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally { setDeleting(false); }
  };

  const claimStatuses = [...CLAIM_STATUS_STEPS, 'Rejected'];
  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.ACCIDENT_CLAIMS);

  return (
    <div>
      {!canEdit && <ReadOnlyNotice moduleName="Accident & Insurance Claims" />}

      <div className="page-header">
        <div>
          <h1 className="page-title">Accident / Insurance Claims</h1>
          <p className="page-subtitle">{claims.length} claim record{claims.length !== 1 ? 's' : ''} in tracking</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { setSelected(null); setPreselectedRepairNo(null); setModal('add'); }}>
            <Plus size={16} strokeWidth={2.5} /> New Claim
          </button>
        )}
      </div>

      {/* 2 Tabs: Pending vs Completed */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => { setActiveTab('pending'); setPage(1); setStatusFilter(''); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13.5,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'pending' ? '#059669' : '#ffffff',
            color: activeTab === 'pending' ? '#ffffff' : '#475569',
            border: activeTab === 'pending' ? '1.5px solid #059669' : '1.5px solid #e2e8f0',
            boxShadow: activeTab === 'pending' ? '0 4px 12px rgba(5, 150, 105, 0.25)' : 'none',
          }}
        >
          <Clock size={16} />
          Pending Claims
          <span style={{
            background: activeTab === 'pending' ? 'rgba(255,255,255,0.25)' : '#ecfdf5',
            color: activeTab === 'pending' ? '#ffffff' : '#059669',
            padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 800
          }}>
            {pendingClaims.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('completed'); setPage(1); setStatusFilter(''); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13.5,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'completed' ? '#059669' : '#ffffff',
            color: activeTab === 'completed' ? '#ffffff' : '#475569',
            border: activeTab === 'completed' ? '1.5px solid #059669' : '1.5px solid #e2e8f0',
            boxShadow: activeTab === 'completed' ? '0 4px 12px rgba(5, 150, 105, 0.25)' : 'none',
          }}
        >
          <CheckCircle2 size={16} />
          Completed Claims
          <span style={{
            background: activeTab === 'completed' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
            color: activeTab === 'completed' ? '#ffffff' : '#64748b',
            padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 800
          }}>
            {completedClaims.length}
          </span>
        </button>
      </div>

      <div className="data-table-container">
        <div className="filter-bar">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              placeholder={`Search ${activeTab === 'pending' ? 'pending' : 'completed'} claims...`}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          {activeTab === 'completed' && (
            <select className="form-select" style={{ width: 200 }} value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {claimStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
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
            <EmptyState
              icon={AlertTriangle}
              title={activeTab === 'pending' ? 'No pending claims' : 'No completed claims'}
              message={activeTab === 'pending' ? 'All claims have been fully settled or completed.' : 'Settled or finished claims will appear here.'}
              action={canEdit && activeTab === 'pending' ? <button className="btn btn-primary" onClick={() => { setSelected(null); setPreselectedRepairNo(null); setModal('add'); }}><Plus size={14} /> New Claim</button> : null}
            />
          ) : activeTab === 'pending' ? (
            /* ─────────────────────────────────────────────────────────────
               TAB 1: PENDING TABLE
               Note: 'Insurance Co.', 'Est. Amount', 'Survey', and 'Claim Status' 
               columns are removed as requested. An 'Action' column is added 
               at the end to open the Claim Process Form.
               ───────────────────────────────────────────────────────────── */
            <table className="data-table">
              <thead>
                <tr>
                  <th>Claim No.</th>
                  <th>Repair No.</th>
                  <th>Vehicle ID</th>
                  <th>Vehicle</th>
                  <th>Date of Accident</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(claim => {
                  const vehicleId = claim.vehicleId || repairs.find(r => r.repairNo === claim.repairNo)?.vehicleId || '';
                  return (
                    <tr key={claim.claimNo}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#ea580c' }}>{claim.claimNo}</span></td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#059669' }}>{claim.repairNo}</span></td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>
                          {vehicleId || '—'}
                        </span>
                      </td>
                      <td><div style={{ fontWeight: 700, color: '#0f172a' }}>{claim.vehicleName}</div></td>
                      <td>{formatDate(claim.dateOfAccident)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                          {canEdit ? (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => { setSelected(claim); setModal('process'); }}
                              style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}
                            >
                              <FileCheck size={14} /> Process Claim
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>View Only</span>
                          )}
                          <button className="btn btn-ghost btn-xs" title="View Details" onClick={() => { setSelected(claim); setModal('view'); }}><Eye size={15} /></button>
                          {canEdit && (
                            <>
                              <button className="btn btn-ghost btn-xs" title="Edit Incident" onClick={() => { setSelected(claim); setModal('edit'); }}><Edit2 size={15} /></button>
                              <button className="btn btn-ghost btn-xs" title="Delete" style={{ color: '#ef4444' }} onClick={() => setDeleteDialog(claim)}><Trash2 size={15} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               TAB 2: COMPLETED TABLE (Full detailed history table)
               ───────────────────────────────────────────────────────────── */
            <table className="data-table">
              <thead>
                <tr>
                  <th>Claim No.</th>
                  <th>Repair No.</th>
                  <th>Vehicle ID</th>
                  <th>Vehicle</th>
                  <th>Date of Accident</th>
                  <th>Insurance Co.</th>
                  <th>Est. Amount</th>
                  <th>Survey</th>
                  <th>Claim Status</th>
                  <th style={{ textAlign: 'center' }}>Documents</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(claim => {
                  const vehicleId = claim.vehicleId || repairs.find(r => r.repairNo === claim.repairNo)?.vehicleId || '';
                  const docList = [
                    { label: 'Photos', url: claim.accidentPhotos },
                    { label: 'Report', url: claim.policeReport },
                    { label: 'FIR', url: claim.firCopy },
                    { label: 'Other', url: claim.otherDocuments },
                  ].filter(d => !!d.url);

                  return (
                    <tr key={claim.claimNo}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#ea580c' }}>{claim.claimNo}</span></td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#059669' }}>{claim.repairNo}</span></td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>
                          {vehicleId || '—'}
                        </span>
                      </td>
                      <td><div style={{ fontWeight: 700, color: '#0f172a' }}>{claim.vehicleName}</div></td>
                      <td>{formatDate(claim.dateOfAccident)}</td>
                      <td>{claim.insuranceCompany || '—'}</td>
                      <td>{claim.estimatedClaimAmount ? `₹${Number(claim.estimatedClaimAmount).toLocaleString('en-IN')}` : '—'}</td>
                      <td><Badge label={claim.surveyStatus} variant={claim.surveyStatus === 'Completed' ? 'success' : 'warning'} /></td>
                      <td><Badge label={claim.claimStatus} /></td>
                      <td style={{ textAlign: 'center' }}>
                        {docList.length > 0 ? (
                          <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {docList.map(doc => {
                              const docUrl = typeof doc.url === 'object' ? doc.url?.url : doc.url;
                              return (
                                <button
                                  key={doc.label}
                                  type="button"
                                  onClick={() => openDocument(docUrl, `${claim.claimNo}_${doc.label}`)}
                                  className="btn btn-outline btn-xs"
                                  style={{ padding: '2px 7px', fontSize: 11, fontWeight: 700, borderRadius: 6 }}
                                  title={`Open ${doc.label}`}
                                >
                                  📁 {doc.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button className="btn btn-ghost btn-xs" title="View" onClick={() => { setSelected(claim); setModal('view'); }}><Eye size={15} /></button>
                          {canEdit && (
                            <>
                              <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => { setSelected(claim); setModal('edit'); }}><Edit2 size={15} /></button>
                              <button className="btn btn-ghost btn-xs" title="Delete" style={{ color: '#ef4444' }} onClick={() => setDeleteDialog(claim)}><Trash2 size={15} /></button>
                            </>
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

      {/* Add / Edit Claim Modal */}
      <Modal isOpen={modal === 'add' || modal === 'edit'} onClose={() => { setModal(null); setPreselectedRepairNo(null); }}
        title={modal === 'edit' ? `Edit Claim — ${selected?.claimNo}` : 'New Accident Claim'} icon={AlertTriangle} size="xl">
        <ClaimForm claim={selected} claims={claims} repairs={repairs} preselectedRepairNo={preselectedRepairNo}
          onClose={() => { setModal(null); setPreselectedRepairNo(null); }} onSaved={() => { setModal(null); setPreselectedRepairNo(null); load(); }} />
      </Modal>

      {/* Process Claim Form Modal (For Pending Action) */}
      <Modal isOpen={modal === 'process'} onClose={() => { setModal(null); setSelected(null); }}
        title={`Process Accident Claim — ${selected?.claimNo}`} icon={Shield} size="lg">
        {selected && (
          <ClaimProcessForm
            claim={selected}
            onClose={() => { setModal(null); setSelected(null); }}
            onSaved={() => {
              setModal(null);
              setSelected(null);
              setActiveTab('completed');
              setPage(1);
              setStatusFilter('');
              load();
            }}
          />
        )}
      </Modal>

      {/* View Modal */}
      <Modal isOpen={modal === 'view'} onClose={() => setModal(null)}
        title={`Claim Details — ${selected?.claimNo}`} icon={AlertTriangle} size="lg">
        {selected && (
          <div>
            <ClaimStatusStepper status={selected.claimStatus} />
            <div style={{ marginTop: 20 }}>
              {/* 1. Incident & Vehicle Information */}
              <div className="form-section-header" style={{ marginBottom: 12 }}>
                <div className="form-section-icon"><AlertTriangle size={17} strokeWidth={2.2} /></div>
                <div className="form-section-title">Incident & Vehicle Details</div>
              </div>
              <div className="detail-grid" style={{ marginBottom: 18 }}>
                {[
                  ['Claim No.', selected.claimNo],
                  ['Repair No.', selected.repairNo],
                  ['Vehicle ID', selected.vehicleId || repairs.find(r => r.repairNo === selected.repairNo)?.vehicleId],
                  ['Vehicle', selected.vehicleName],
                  ['Registration No.', selected.registrationNo],
                  ['Date of Accident', formatDate(selected.dateOfAccident)],
                  ['Time of Accident', selected.timeOfAccident],
                  ['Accident Location', selected.accidentLocation],
                  ['Driver Name', selected.driverName],
                  ['Driver Mobile', selected.driverMobileNo],
                ].map(([l, v]) => (
                  <div key={l} className="detail-item"><label>{l}</label><div className="value">{v || '—'}</div></div>
                ))}
              </div>

              {/* 2. Process Claim: Insurance & Policy Details */}
              <div className="form-section-header" style={{ marginBottom: 12, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                <div className="form-section-icon"><Shield size={17} strokeWidth={2.2} /></div>
                <div className="form-section-title">Insurance & Policy Coverage (Process Claim)</div>
              </div>
              <div className="detail-grid" style={{ marginBottom: 18 }}>
                {[
                  ['Insurance Company', selected.insuranceCompany],
                  ['Policy No.', selected.policyNo],
                  ['Policy Validity', formatDate(selected.policyValidity)],
                  ['Estimated Claim Amount', selected.estimatedClaimAmount ? `₹${Number(selected.estimatedClaimAmount).toLocaleString('en-IN')}` : '—'],
                  ['Type Of Claim', selected.typeOfClaim],
                  ['FIR Required?', selected.firRequired || 'No'],
                ].map(([l, v]) => (
                  <div key={l} className="detail-item"><label>{l}</label><div className="value">{v || '—'}</div></div>
                ))}
              </div>

              {/* 3. Process Claim: Survey & Claim Status Details */}
              <div className="form-section-header" style={{ marginBottom: 12, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                <div className="form-section-icon"><CheckCircle size={17} strokeWidth={2.2} /></div>
                <div className="form-section-title">Survey & Processing Status</div>
              </div>
              <div className="detail-grid" style={{ marginBottom: 18 }}>
                {[
                  ['Claim Status', selected.claimStatus || '—'],
                  ['Survey Status', selected.surveyStatus || '—'],
                  ['Claim Intimated Date', formatDate(selected.claimIntimatedDate)],
                  ['Claim Intimation No.', selected.claimIntimationNo || '—'],
                  ['Surveyor Name', selected.surveyorName || '—'],
                  ['Surveyor Mobile', selected.surveyorMobileNo || '—'],
                  ['Survey Date', formatDate(selected.surveyDate)],
                  ['Approved Amount', selected.claimApprovedAmount ? `₹${Number(selected.claimApprovedAmount).toLocaleString('en-IN')}` : '—'],
                  ['Settlement Date', formatDate(selected.claimSettlementDate)],
                ].map(([l, v]) => (
                  <div key={l} className="detail-item"><label>{l}</label><div className="value">{v || '—'}</div></div>
                ))}
              </div>

              {selected.claimRejectedReason && (
                <div className="detail-item" style={{ marginBottom: 14, background: '#fef2f2', padding: 12, borderRadius: 10, border: '1px solid #fecaca' }}>
                  <label style={{ color: '#dc2626', fontWeight: 700 }}>Claim Rejection Reason</label>
                  <div className="value" style={{ color: '#991b1b', fontWeight: 600, marginTop: 4 }}>{selected.claimRejectedReason}</div>
                </div>
              )}

              {selected.accidentReason && (
                <div className="detail-item" style={{ marginBottom: 12 }}>
                  <label>Accident Description</label>
                  <div className="value" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.accidentReason}</div>
                </div>
              )}
              {selected.remarks && (
                <div className="detail-item" style={{ marginBottom: 16 }}>
                  <label>Remarks</label>
                  <div className="value">{selected.remarks}</div>
                </div>
              )}

              {/* 4. Process Claim: Documents & Evidence */}
              <div style={{ marginTop: 22, borderTop: '1px solid #e2e8f0', paddingTop: 18 }}>
                <div className="form-section-header" style={{ marginBottom: 14 }}>
                  <div className="form-section-icon"><FileText size={18} strokeWidth={2.2} /></div>
                  <div className="form-section-title">Claim Documents & Evidence</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                  {[
                    { label: 'Accident Photos', icon: '📷', key: 'accidentPhotos', url: selected.accidentPhotos },
                    { label: 'Police Report', icon: '📑', key: 'policeReport', url: selected.policeReport },
                    { label: 'Other Documents', icon: '📁', key: 'otherDocuments', url: selected.otherDocuments },
                    { label: 'FIR Copy', icon: '📋', key: 'firCopy', url: selected.firCopy, condition: selected.firRequired === 'Yes' || selected.firCopy },
                  ].filter(d => d.condition !== false).map(doc => {
                    const docUrl = typeof doc.url === 'object' ? doc.url?.url : doc.url;
                    const hasDoc = !!docUrl && String(docUrl).trim() !== '' && String(docUrl).trim() !== '—';
                    return (
                      <div key={doc.label} style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: hasDoc ? '1.5px solid #a7f3d0' : '1px dashed #cbd5e1',
                        background: hasDoc ? '#ecfdf5' : '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: 90,
                        gap: 10
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: hasDoc ? '#065f46' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{doc.icon}</span> {doc.label}
                          </span>
                          <span style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: hasDoc ? '#d1fae5' : '#f1f5f9',
                            color: hasDoc ? '#047857' : '#94a3b8'
                          }}>
                            {hasDoc ? 'Uploaded' : 'Not Uploaded'}
                          </span>
                        </div>
                        {hasDoc ? (
                          <button
                            type="button"
                            onClick={() => openDocument(docUrl, `${selected.claimNo}_${doc.key}`)}
                            className="btn btn-outline btn-sm"
                            style={{
                              width: '100%',
                              fontWeight: 700,
                              borderColor: '#34d399',
                              color: '#065f46',
                              background: '#ffffff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}
                          >
                            <Eye size={14} /> View / Open {doc.label}
                          </button>
                        ) : (
                          <div style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
                            — No file attached —
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog isOpen={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
        loading={deleting} title="Delete Claim"
        message={`Delete claim ${deleteDialog?.claimNo}? This cannot be undone.`}
        confirmLabel="Delete" confirmClass="btn btn-danger" />
    </div>
  );
};

export default AccidentClaims;
