// pages/AccidentClaims.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, Search, Eye, Edit2, Trash2, X, Wrench, Shield, FileText, User, CheckCircle, Lock, Clock, CheckCircle2, FileCheck, ChevronRight, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { getClaims, addClaim, updateClaim, processAccidentClaim, deleteClaim, getRepairs, getCars, getInsurance, onStoreUpdate } from '../store/dataStore';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import { generateClaimNo, generateId } from '../utils/idGenerator';
import { formatDate, today, toInputDate, calculateExpectedSettlementDate, getClaimTATDays } from '../utils/dateUtils';
import { validateForm, required } from '../utils/validators';
import { CLAIM_STATUS_STEPS, ITEMS_PER_PAGE, SURVEY_STATUS, CLAIM_TYPES, CLAIM_MODES } from '../constants';
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
import { isStage1Completed, isStage2Completed, isStage3Completed, getClaimCurrentStage } from '../utils/claimWorkflow';

const EMPTY_CLAIM = {
  repairNo: '', vehicleId: '', vehicleName: '', registrationNo: '',
  dateOfAccident: '', timeOfAccident: '', accidentLocation: '', accidentReason: '',
  policyValidity: '', insuranceClaim: 'Yes', estimatedClaimAmount: '',
  typeOfClaim: 'Own Damage', claimMode: 'Cashless Claim (Network Garage)',
  accidentPhotos: null, firRequired: 'No', firCopy: null, policeReport: null, otherDocuments: null,
  claimIntimatedDate: '', claimIntimationNo: '', surveyorName: '', surveyorMobileNo: '',
  surveyDate: '', surveyStatus: 'Pending', claimStatus: 'Claim Not Intimated',
  expectedSettlementDate: '',
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
  const initialType = isEdit ? (claim.typeOfClaim || 'Own Damage') : 'Own Damage';
  const initialMode = isEdit ? (claim.claimMode || 'Cashless Claim (Network Garage)') : 'Cashless Claim (Network Garage)';
  const initialExpDate = isEdit
    ? (claim.expectedSettlementDate || calculateExpectedSettlementDate(claim.claimIntimatedDate || claim.dateOfAccident || today(), initialMode))
    : calculateExpectedSettlementDate(today(), initialMode);

  const [form, setForm] = useState(isEdit
    ? { ...claim, vehicleId: getInitialVehicleId(), typeOfClaim: initialType, claimMode: initialMode, expectedSettlementDate: initialExpDate }
    : { ...EMPTY_CLAIM, repairNo: preselectedRepairNo || '', typeOfClaim: initialType, claimMode: initialMode, expectedSettlementDate: initialExpDate }
  );
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
    const selType = repair?.typeOfClaim || form.typeOfClaim || 'Own Damage';
    const selMode = repair?.claimMode || form.claimMode || 'Cashless Claim (Network Garage)';
    const baseD = form.dateOfAccident || repair?.dateOfAccident || today();
    const expD = calculateExpectedSettlementDate(baseD, selMode);
    setForm(f => ({
      ...f,
      repairNo,
      vehicleId: repair?.vehicleId || '',
      vehicleName: repair?.carName || '',
      registrationNo: repair?.registrationNo || f.registrationNo || '',
      dateOfAccident: baseD,
      accidentReason: f.accidentReason || repair?.reasonForRepair || '',
      accidentLocation: f.accidentLocation || repair?.garage || '',
      driverName: f.driverName || repair?.whoTakingCar || '',
      insuranceCompany: f.insuranceCompany || repair?.insuranceCompany || insComp,
      estimatedClaimAmount: f.estimatedClaimAmount || repair?.estimatedClaimAmount || '',
      typeOfClaim: selType,
      claimMode: selMode,
      expectedSettlementDate: f.expectedSettlementDate || expD,
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
          <select
            className="form-select"
            value={form.typeOfClaim || 'Own Damage'}
            onChange={e => set('typeOfClaim', e.target.value)}
          >
            {CLAIM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Claim Settlement Mode</label>
          <select
            className="form-select"
            value={form.claimMode || 'Cashless Claim (Network Garage)'}
            onChange={e => {
              const val = e.target.value;
              const baseD = form.claimIntimatedDate || form.dateOfAccident || today();
              const expD = calculateExpectedSettlementDate(baseD, val);
              setForm(f => ({ ...f, claimMode: val, expectedSettlementDate: expD || f.expectedSettlementDate }));
            }}
          >
            {CLAIM_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {form.claimMode?.includes('Cashless') && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: '#0284c7', background: '#f0f9ff', padding: '6px 10px', borderRadius: 6, border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚡ <strong>TAT: 24–48 Ghante (2 Din)</strong> {form.expectedSettlementDate ? `— Expected: ${formatDate(form.expectedSettlementDate)}` : ''}</span>
            </div>
          )}
          {form.claimMode?.includes('Reimbursement') && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: '#7c3aed', background: '#f5f3ff', padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>💰 <strong>TAT: 7–15 Din</strong> {form.expectedSettlementDate ? `— Expected: ${formatDate(form.expectedSettlementDate)}` : ''}</span>
            </div>
          )}
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
          <label className="form-label">
            Expected Settlement Date
            {form.typeOfClaim?.includes('Cashless') && <span style={{ color: '#0284c7', fontSize: 11, marginLeft: 6 }}>(24–48h TAT)</span>}
            {form.typeOfClaim?.includes('Reimbursement') && <span style={{ color: '#7c3aed', fontSize: 11, marginLeft: 6 }}>(15 Din TAT)</span>}
          </label>
          <input
            type="date"
            className="form-input"
            value={toInputDate(form.expectedSettlementDate) || form.expectedSettlementDate || ''}
            onChange={e => set('expectedSettlementDate', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Actual Settlement Date</label>
          <input
            type="date"
            className="form-input"
            value={toInputDate(form.claimSettlementDate) || form.claimSettlementDate || ''}
            onChange={e => set('claimSettlementDate', e.target.value)}
          />
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

// ─── ACTION PROCESS FORM MODAL (For 3-Stage Workflow) ───────────────────────────
const ClaimProcessForm = ({ claim, targetStage, onClose, onSaved }) => {
  const initialType = claim.typeOfClaim || 'Own Damage';
  const initialMode = claim.claimMode || 'Cashless Claim (Network Garage)';
  const defaultExpDate = claim.expectedSettlementDate || calculateExpectedSettlementDate(claim.claimIntimatedDate || claim.dateOfAccident || today(), initialMode);

  const effectiveStage = targetStage || (
    !isStage1Completed(claim) ? 'incident' :
    !isStage2Completed(claim) ? 'process' :
    'settlement'
  );

  const [form, setForm] = useState({
    // Incident Details
    dateOfAccident: claim.dateOfAccident || today(),
    timeOfAccident: claim.timeOfAccident || '',
    accidentLocation: claim.accidentLocation || '',
    accidentReason: claim.accidentReason || '',
    driverName: claim.driverName || '',
    driverMobileNo: claim.driverMobileNo || '',
    // Policy & Insurance
    insuranceCompany: claim.insuranceCompany || '',
    policyNo: claim.policyNo || '',
    policyValidity: claim.policyValidity || '',
    estimatedClaimAmount: claim.estimatedClaimAmount || '',
    typeOfClaim: initialType,
    claimMode: initialMode,
    expectedSettlementDate: defaultExpDate,
    firRequired: claim.firRequired || 'No',
    // Survey & Process
    claimIntimatedDate: claim.claimIntimatedDate || today(),
    claimIntimationNo: claim.claimIntimationNo || '',
    surveyorName: claim.surveyorName || '',
    surveyorMobileNo: claim.surveyorMobileNo || '',
    surveyDate: claim.surveyDate || '',
    surveyStatus: claim.surveyStatus || (effectiveStage === 'process' ? 'Survey In Progress' : 'Pending'),
    surveyAssessmentNotes: claim.surveyAssessmentNotes || '',
    // Settlement
    claimStatus: claim.claimStatus && claim.claimStatus !== 'Settled' ? claim.claimStatus : (effectiveStage === 'settlement' ? 'Settled' : 'Claim Under Process'),
    claimApprovedAmount: claim.claimApprovedAmount || claim.estimatedClaimAmount || '',
    claimRejectedReason: claim.claimRejectedReason || '',
    claimSettlementDate: claim.claimSettlementDate || today(),
    settlementPaymentMode: claim.settlementPaymentMode || 'Direct to Network Garage (Cashless)',
    settlementRefNo: claim.settlementRefNo || '',
    remarks: claim.remarks || '',
    // Documents
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
    if (effectiveStage === 'settlement' && form.claimStatus === 'Rejected' && !form.claimRejectedReason?.trim()) {
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

      if (effectiveStage === 'incident') {
        processedForm.stage1Completed = true;
        processedForm.stage1CompletedAt = today();
        if (!processedForm.claimStatus || processedForm.claimStatus === 'Claim Not Intimated') {
          processedForm.claimStatus = 'Claim Intimated';
        }
      } else if (effectiveStage === 'process') {
        processedForm.stage1Completed = true;
        processedForm.stage2Completed = true;
        processedForm.stage2CompletedAt = today();
        processedForm.surveyStatus = 'Completed';
        if (!processedForm.claimStatus || processedForm.claimStatus === 'Claim Intimated' || processedForm.claimStatus === 'Claim Not Intimated') {
          processedForm.claimStatus = 'Approved';
        }
      } else if (effectiveStage === 'settlement') {
        processedForm.stage1Completed = true;
        processedForm.stage2Completed = true;
        processedForm.stage3Completed = true;
        processedForm.stage3CompletedAt = today();
        processedForm.claimSettlementDate = form.claimSettlementDate || today();
        if (!processedForm.claimStatus || processedForm.claimStatus !== 'Rejected') {
          processedForm.claimStatus = 'Settled';
        }
      }

      await processAccidentClaim(claim.claimNo, processedForm);

      if (effectiveStage === 'incident') {
        toast.success(`Claim ${claim.claimNo} completed in Claim of Accident! Moved to Process of Claim Pending.`);
      } else if (effectiveStage === 'process') {
        toast.success(`Process of Claim completed for ${claim.claimNo}! Moved to Claim Settlement Pending.`);
      } else {
        toast.success(`Claim ${claim.claimNo} successfully settled and closed!`);
      }

      onSaved(effectiveStage);
    } catch (err) {
      toast.error(err.message || 'Failed to update claim');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <LoadingOverlay isVisible={saving} message="Updating Claim Workflow to Google Sheets..." />

      {/* Workflow Stepper in Modal */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: '#f8fafc', borderRadius: 12,
        border: '1px solid #e2e8f0', marginBottom: 18
      }}>
        {[
          { key: 'incident', num: '1', title: 'Claim of Accident', done: isStage1Completed(claim), active: effectiveStage === 'incident' },
          { key: 'process', num: '2', title: 'Process of Claim', done: isStage2Completed(claim), active: effectiveStage === 'process' },
          { key: 'settlement', num: '3', title: 'Claim Settlement', done: isStage3Completed(claim), active: effectiveStage === 'settlement' },
        ].map((step, idx) => (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800,
              background: step.done ? '#059669' : step.active ? (effectiveStage === 'incident' ? '#ea580c' : effectiveStage === 'process' ? '#0284c7' : '#059669') : '#e2e8f0',
              color: step.done || step.active ? '#ffffff' : '#64748b'
            }}>
              {step.done ? '✓' : step.num}
            </div>
            <span style={{
              fontSize: 12.5,
              fontWeight: step.active ? 800 : step.done ? 600 : 500,
              color: step.active ? (effectiveStage === 'incident' ? '#ea580c' : effectiveStage === 'process' ? '#0284c7' : '#059669') : step.done ? '#059669' : '#64748b'
            }}>
              {step.title}
            </span>
            {idx < 2 && <span style={{ color: '#cbd5e1', margin: '0 4px' }}>→</span>}
          </div>
        ))}
      </div>

      {/* Claim Summary Card */}
      <div style={{
        padding: '12px 16px',
        background: effectiveStage === 'incident' ? '#fff7ed' : effectiveStage === 'process' ? '#f0f9ff' : '#ecfdf5',
        borderRadius: 12,
        border: effectiveStage === 'incident' ? '1.5px solid #fed7aa' : effectiveStage === 'process' ? '1.5px solid #bae6fd' : '1.5px solid #a7f3d0',
        marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5,
            color: effectiveStage === 'incident' ? '#c2410c' : effectiveStage === 'process' ? '#0369a1' : '#047857'
          }}>
            {effectiveStage === 'incident' ? 'Step 1: Claim of Accident Verification & Intimation' : effectiveStage === 'process' ? 'Step 2: Process of Claim & Surveyor Inspection' : 'Step 3: Final Claim Settlement & Payout'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
            <span style={{ color: '#ea580c', fontFamily: 'monospace' }}>{claim.claimNo}</span> — {claim.vehicleName}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Repair No: <strong style={{ color: '#059669', fontFamily: 'monospace' }}>{claim.repairNo}</strong> | Vehicle ID: <strong>{claim.vehicleId || '—'}</strong> | Date: <strong>{formatDate(claim.dateOfAccident)}</strong>
          </div>
        </div>
      </div>

      {/* STAGE 1 FIELDS: CLAIM OF ACCIDENT */}
      {effectiveStage === 'incident' && (
        <>
          <div className="form-section-header">
            <div className="form-section-icon"><AlertTriangle size={17} strokeWidth={2.2} /></div>
            <div className="form-section-title">1. Incident Information</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Date of Accident <span className="required">*</span></label>
              <input type="date" className="form-input" value={toInputDate(form.dateOfAccident) || form.dateOfAccident} onChange={e => set('dateOfAccident', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Time of Accident</label>
              <input type="time" className="form-input" value={form.timeOfAccident} onChange={e => set('timeOfAccident', e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Accident Location</label>
              <input className="form-input" value={form.accidentLocation} onChange={e => set('accidentLocation', e.target.value)} placeholder="e.g. NH-48 near Toll Plaza" />
            </div>
            <div className="form-group">
              <label className="form-label">Driver Name</label>
              <input className="form-input" value={form.driverName} onChange={e => set('driverName', e.target.value)} placeholder="Driver at the time of accident" />
            </div>
            <div className="form-group">
              <label className="form-label">Driver Mobile</label>
              <input className="form-input" value={form.driverMobileNo} onChange={e => set('driverMobileNo', e.target.value)} placeholder="Driver phone number" />
            </div>
          </div>

          <div className="form-section-header">
            <div className="form-section-icon"><Shield size={17} strokeWidth={2.2} /></div>
            <div className="form-section-title">2. Insurance & Policy Coverage</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Insurance Company <span className="required">*</span></label>
              <input className="form-input" value={form.insuranceCompany} onChange={e => set('insuranceCompany', e.target.value)} placeholder="e.g. HDFC ERGO, ICICI Lombard..." required />
            </div>
            <div className="form-group">
              <label className="form-label">Policy No.</label>
              <input className="form-input" value={form.policyNo} onChange={e => set('policyNo', e.target.value)} placeholder="Enter policy number" />
            </div>
            <div className="form-group">
              <label className="form-label">Policy Validity</label>
              <input type="date" className="form-input" value={toInputDate(form.policyValidity) || form.policyValidity} onChange={e => set('policyValidity', e.target.value)} />
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
              <label className="form-label">Claim Settlement Mode</label>
              <select
                className="form-select"
                value={form.claimMode}
                onChange={e => {
                  const val = e.target.value;
                  const baseD = form.dateOfAccident || today();
                  const expD = calculateExpectedSettlementDate(baseD, val);
                  setForm(f => ({ ...f, claimMode: val, expectedSettlementDate: expD || f.expectedSettlementDate }));
                }}
              >
                {CLAIM_MODES.map(m => <option key={m} value={m}>{m}</option>)}
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
            <div className="form-section-icon"><FileText size={17} strokeWidth={2.2} /></div>
            <div className="form-section-title">3. Photos & Incident Evidence</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
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
        </>
      )}

      {/* STAGE 2 FIELDS: PROCESS OF CLAIM */}
      {effectiveStage === 'process' && (
        <>
          <div className="form-section-header">
            <div className="form-section-icon"><Clock size={17} strokeWidth={2.2} /></div>
            <div className="form-section-title">1. Claim Intimation & Surveyor Appointment</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Claim Intimated Date <span className="required">*</span></label>
              <input type="date" className="form-input" value={toInputDate(form.claimIntimatedDate) || form.claimIntimatedDate} onChange={e => set('claimIntimatedDate', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Claim Intimation No. / Ticket</label>
              <input className="form-input" value={form.claimIntimationNo} onChange={e => set('claimIntimationNo', e.target.value)} placeholder="Insurance intimation reference" />
            </div>
            <div className="form-group">
              <label className="form-label">Surveyor Name</label>
              <input className="form-input" value={form.surveyorName} onChange={e => set('surveyorName', e.target.value)} placeholder="Assigned surveyor name" />
            </div>
            <div className="form-group">
              <label className="form-label">Surveyor Mobile No.</label>
              <input className="form-input" value={form.surveyorMobileNo} onChange={e => set('surveyorMobileNo', e.target.value)} placeholder="Surveyor contact" />
            </div>
            <div className="form-group">
              <label className="form-label">Survey Date</label>
              <input type="date" className="form-input" value={toInputDate(form.surveyDate) || form.surveyDate} onChange={e => set('surveyDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Survey Status <span className="required">*</span></label>
              <select className="form-select" value={form.surveyStatus} onChange={e => set('surveyStatus', e.target.value)} style={{ fontWeight: 700 }}>
                {SURVEY_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                Expected Settlement Date
                {form.claimMode?.includes('Cashless') && <span style={{ color: '#0284c7', fontSize: 11, marginLeft: 6 }}>(24–48h TAT)</span>}
                {form.claimMode?.includes('Reimbursement') && <span style={{ color: '#7c3aed', fontSize: 11, marginLeft: 6 }}>(7–15 Din TAT)</span>}
              </label>
              <input type="date" className="form-input" value={toInputDate(form.expectedSettlementDate) || form.expectedSettlementDate} onChange={e => set('expectedSettlementDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Claim Current Status</label>
              <select className="form-select" value={form.claimStatus} onChange={e => set('claimStatus', e.target.value)}>
                {CLAIM_STATUS_STEPS.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Survey Assessment & Inspection Remarks</label>
              <textarea className="form-textarea" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Surveyor notes, parts verified, approval updates..." style={{ resize: 'vertical' }} />
            </div>
          </div>

          <div className="form-section-header">
            <div className="form-section-icon"><FileText size={17} strokeWidth={2.2} /></div>
            <div className="form-section-title">2. Survey Documents & Reports</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Survey Report / Documents</label>
              <FileUpload value={form.otherDocuments} onChange={v => set('otherDocuments', v)} accept="image/*,.pdf" label="Upload Survey Report" id="action-survey-doc" />
            </div>
            <div className="form-group">
              <label className="form-label">Accident Photos</label>
              <FileUpload value={form.accidentPhotos} onChange={v => set('accidentPhotos', v)} accept="image/*" label="Update Photos" id="action-accident-photos-2" />
            </div>
          </div>
        </>
      )}

      {/* STAGE 3 FIELDS: CLAIM SETTLEMENT */}
      {effectiveStage === 'settlement' && (
        <>
          <div className="form-section-header">
            <div className="form-section-icon"><CheckCircle2 size={17} strokeWidth={2.2} /></div>
            <div className="form-section-title">1. Final Settlement & Payout Details</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Estimated Claim Amount</label>
              <div style={{ padding: '9px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontWeight: 700, color: '#475569' }}>
                ₹{Number(form.estimatedClaimAmount || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Final Approved Claim Amount (₹) <span className="required">*</span></label>
              <input
                type="number"
                className="form-input"
                value={form.claimApprovedAmount}
                onChange={e => set('claimApprovedAmount', e.target.value)}
                placeholder="₹ Final Approved Amount"
                style={{ borderColor: '#059669', background: '#ecfdf5', fontWeight: 800, fontSize: 15 }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Actual Settlement Date <span className="required">*</span></label>
              <input
                type="date"
                className="form-input"
                value={toInputDate(form.claimSettlementDate) || form.claimSettlementDate}
                onChange={e => set('claimSettlementDate', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Claim Final Status <span className="required">*</span></label>
              <select className="form-select" value={form.claimStatus} onChange={e => set('claimStatus', e.target.value)} style={{ fontWeight: 800 }}>
                <option value="Settled">Settled (Approved & Paid)</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            {form.claimStatus === 'Rejected' && (
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Rejection Reason <span className="required">*</span></label>
                <textarea className="form-textarea" rows={2} value={form.claimRejectedReason} onChange={e => set('claimRejectedReason', e.target.value)} placeholder="Reason for claim rejection..." required style={{ resize: 'vertical' }} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Settlement / Payout Mode</label>
              <select className="form-select" value={form.settlementPaymentMode} onChange={e => set('settlementPaymentMode', e.target.value)}>
                <option value="Direct to Network Garage (Cashless)">Direct to Network Garage (Cashless)</option>
                <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                <option value="Cheque / Draft">Cheque / Draft</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Ref. / UTR No.</label>
              <input className="form-input" value={form.settlementRefNo} onChange={e => set('settlementRefNo', e.target.value)} placeholder="Transaction / UTR / Cheque No." />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Settlement Closure Remarks</label>
              <textarea className="form-textarea" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Final settlement closure notes..." style={{ resize: 'vertical' }} />
            </div>
          </div>
        </>
      )}

      {/* Modal Actions */}
      <div className="modal-footer" style={{ padding: '16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', fontWeight: 800, fontSize: 13.5,
            background: effectiveStage === 'incident' ? '#ea580c' : effectiveStage === 'process' ? '#0284c7' : '#059669',
            borderColor: 'transparent'
          }}
        >
          {saving ? (
            <><span className="spinner" style={{ width: 14, height: 14 }} /> Submitting...</>
          ) : effectiveStage === 'incident' ? (
            '✓ Submit Claim of Accident → Move to Process of Claim'
          ) : effectiveStage === 'process' ? (
            '✓ Submit Process of Claim → Move to Claim Settlement'
          ) : (
            '✓ Finalize & Settle Claim'
          )}
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

const AccidentClaims = ({ defaultStage }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);

  const getStageFromUrl = useCallback(() => {
    if (defaultStage) return defaultStage;
    if (location.pathname.includes('process-of-claim')) return 'process';
    if (location.pathname.includes('claim-settlement')) return 'settlement';
    if (location.pathname.includes('claim-of-accident')) return 'incident';
    const params = new URLSearchParams(location.search);
    const stage = params.get('stage');
    if (stage === 'process' || stage === 'settlement' || stage === 'incident') return stage;
    return 'incident';
  }, [defaultStage, location.pathname, location.search]);

  const [activeStage, setActiveStage] = useState(getStageFromUrl); // 'incident' | 'process' | 'settlement'
  const [statusTab, setStatusTab] = useState('pending'); // 'pending' | 'completed'
  const [modalStage, setModalStage] = useState('incident'); // 'incident' | 'process' | 'settlement'
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
    const stage = getStageFromUrl();
    setActiveStage(stage);
    setStatusTab('pending');
  }, [location.pathname, location.search, getStageFromUrl]);

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

  // Stage-specific Pending and Completed claims
  const { stagePendingClaims, stageCompletedClaims } = useMemo(() => {
    let pending = [];
    let completed = [];

    if (activeStage === 'incident') {
      pending = claims.filter(c => !isStage1Completed(c));
      completed = claims.filter(c => isStage1Completed(c));
    } else if (activeStage === 'process') {
      pending = claims.filter(c => isStage1Completed(c) && !isStage2Completed(c));
      completed = claims.filter(c => isStage2Completed(c));
    } else if (activeStage === 'settlement') {
      pending = claims.filter(c => isStage2Completed(c) && !isStage3Completed(c));
      completed = claims.filter(c => isStage3Completed(c));
    } else {
      // 'all' stage:
      pending = claims.filter(c => !isStage3Completed(c));
      completed = claims.filter(c => isStage3Completed(c));
    }

    return { stagePendingClaims: pending, stageCompletedClaims: completed };
  }, [claims, activeStage]);

  // Counts for Stage Workflow Selector Chips
  const stageCounts = useMemo(() => ({
    stage1Pending: claims.filter(c => !isStage1Completed(c)).length,
    stage1Completed: claims.filter(c => isStage1Completed(c)).length,
    stage2Pending: claims.filter(c => isStage1Completed(c) && !isStage2Completed(c)).length,
    stage2Completed: claims.filter(c => isStage2Completed(c)).length,
    stage3Pending: claims.filter(c => isStage2Completed(c) && !isStage3Completed(c)).length,
    stage3Completed: claims.filter(c => isStage3Completed(c)).length,
    allPending: claims.filter(c => !isStage3Completed(c)).length,
    allCompleted: claims.filter(c => isStage3Completed(c)).length,
  }), [claims]);

  const handleStageChange = (stage) => {
    setActiveStage(stage);
    setPage(1);
    setStatusFilter('');
    setStatusTab('pending');
    const targetUrl = stage === 'incident' 
      ? '/accident-claims/claim-of-accident' 
      : stage === 'process' 
      ? '/accident-claims/process-of-claim' 
      : stage === 'settlement' 
      ? '/accident-claims/claim-settlement' 
      : '/accident-claims';
    navigate(targetUrl, { replace: true });
  };

  const filterList = useCallback((list) => {
    return list.filter(c => {
      const q = search.toLowerCase();
      const vehId = (c.vehicleId || repairs.find(r => r.repairNo === c.repairNo)?.vehicleId || '').toLowerCase();
      const ins = (c.insuranceCompany || repairs.find(r => r.repairNo === c.repairNo)?.insuranceCompany || '').toLowerCase();
      const match = !q || c.claimNo?.toLowerCase().includes(q) || c.repairNo?.toLowerCase().includes(q) || c.vehicleName?.toLowerCase().includes(q) || vehId.includes(q) || ins.includes(q);
      const st = !statusFilter || c.claimStatus === statusFilter;
      return match && st;
    });
  }, [search, statusFilter, repairs]);

  const filteredPending = useMemo(() => filterList(stagePendingClaims), [filterList, stagePendingClaims]);
  const filteredCompleted = useMemo(() => filterList(stageCompletedClaims), [filterList, stageCompletedClaims]);

  const currentList = statusTab === 'completed' ? filteredCompleted : filteredPending;
  const totalPages = Math.ceil(currentList.length / ITEMS_PER_PAGE);
  const pagedList = currentList.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const openStageActionModal = (claim) => {
    setSelected(claim);
    const stg = activeStage !== 'all' ? activeStage : getClaimCurrentStage(claim);
    setModalStage(stg);
    setModal('process');
  };

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

  const processStatuses = ['Claim Intimated', 'Surveyor Appointed', 'Survey In Progress', 'Survey Completed', 'Documents Submitted', 'Claim Under Process', 'Approved'];
  const settlementStatuses = ['Settled', 'Rejected'];

  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.ACCIDENT_CLAIMS);

  /* ─────────────────────────────────────────────────────────────
     RENDER: PENDING CLAIMS TABLE
     Columns tailored for active stage with appropriate action button
     ───────────────────────────────────────────────────────────── */
  const renderPendingTable = (list) => (
    <table className="data-table">
      <thead>
        <tr>
          <th>Claim No.</th>
          <th>Repair No.</th>
          <th>Vehicle ID</th>
          <th>Vehicle</th>
          <th>Date of Accident</th>
          <th>Insurance Co.</th>
          {activeStage === 'all' && <th>Current Stage</th>}
          {activeStage === 'process' && <th>Policy No.</th>}
          <th>Est. Amount</th>
          {activeStage === 'process' && <th>Surveyor Details</th>}
          {activeStage === 'process' && <th>Survey Status</th>}
          <th>Claim Mode</th>
          <th>Expected Settlement</th>
          <th style={{ textAlign: 'center' }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {list.map(claim => {
          const vehicleId = claim.vehicleId || repairs.find(r => r.repairNo === claim.repairNo)?.vehicleId || '';
          const expDate = claim.expectedSettlementDate || calculateExpectedSettlementDate(claim.claimIntimatedDate || claim.dateOfAccident || claim.createdAt, claim.claimMode);
          const isCashless = (claim.claimMode || '').includes('Cashless');
          const isReimb = (claim.claimMode || '').includes('Reimbursement');
          const estAmt = claim.estimatedClaimAmount || repairs.find(r => r.repairNo === claim.repairNo)?.estimatedClaimAmount || '';
          const insCompany = claim.insuranceCompany || repairs.find(r => r.repairNo === claim.repairNo)?.insuranceCompany || '';
          const currStage = getClaimCurrentStage(claim);

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
              <td>{insCompany || '—'}</td>

              {activeStage === 'all' && (
                <td>
                  <span style={{
                    fontSize: 11.5, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                    background: currStage === 'incident' ? '#fff7ed' : currStage === 'process' ? '#f0f9ff' : '#ecfdf5',
                    color: currStage === 'incident' ? '#ea580c' : currStage === 'process' ? '#0284c7' : '#059669',
                    border: currStage === 'incident' ? '1px solid #fed7aa' : currStage === 'process' ? '1px solid #bae6fd' : '1px solid #a7f3d0'
                  }}>
                    {currStage === 'incident' ? '1. Incident' : currStage === 'process' ? '2. Process' : '3. Settlement'}
                  </span>
                </td>
              )}

              {activeStage === 'process' && (
                <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{claim.policyNo || '—'}</span></td>
              )}

              <td>
                {estAmt ? (
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    ₹{Number(estAmt).toLocaleString('en-IN')}
                  </span>
                ) : (
                  <span style={{ color: '#94a3b8' }}>—</span>
                )}
              </td>

              {activeStage === 'process' && (
                <td>
                  {claim.surveyorName ? (
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 12 }}>{claim.surveyorName}</div>
                      {claim.surveyorMobileNo && <div style={{ fontSize: 11, color: '#64748b' }}>{claim.surveyorMobileNo}</div>}
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>Awaiting Surveyor</span>
                  )}
                </td>
              )}

              {activeStage === 'process' && (
                <td>
                  <Badge label={claim.surveyStatus || 'Pending'} variant={claim.surveyStatus === 'Completed' ? 'success' : 'warning'} />
                </td>
              )}

              <td>
                {isCashless ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11.5 }}>
                    ⚡ Cashless (Network)
                  </span>
                ) : isReimb ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ede9fe', color: '#6d28d9', padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11.5 }}>
                    💰 Reimbursement
                  </span>
                ) : (
                  <span style={{ color: '#64748b', fontSize: 12 }}>—</span>
                )}
              </td>
              <td>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatDate(expDate)}</div>
                  {isCashless && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0284c7' }}>Within 24–48h</span>}
                  {isReimb && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#7c3aed' }}>Within 7–15 Days</span>}
                </div>
              </td>
              <td style={{ textAlign: 'center' }}>
                {canEdit ? (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => openStageActionModal(claim)}
                    style={{
                      fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                      background: (activeStage === 'process' || (activeStage === 'all' && currStage === 'process'))
                        ? '#0284c7'
                        : (activeStage === 'settlement' || (activeStage === 'all' && currStage === 'settlement'))
                        ? '#059669'
                        : '#ea580c',
                      borderColor: 'transparent'
                    }}
                  >
                    <FileCheck size={14} />
                    {activeStage === 'incident'
                      ? 'Submit Claim'
                      : activeStage === 'process'
                      ? 'Update Process'
                      : activeStage === 'settlement'
                      ? 'Settle Claim'
                      : currStage === 'incident'
                      ? '1. Submit Claim'
                      : currStage === 'process'
                      ? '2. Update Process'
                      : '3. Settle Claim'}
                  </button>
                ) : (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => { setSelected(claim); setModal('view'); }}
                    style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px' }}
                  >
                    <Eye size={13} /> View
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  /* ─────────────────────────────────────────────────────────────
     RENDER: COMPLETED CLAIMS TABLE
     Columns tailored for active stage
     ───────────────────────────────────────────────────────────── */
  const renderCompletedTable = (list) => (
    <table className="data-table">
      <thead>
        <tr>
          <th>Claim No.</th>
          <th>Repair No.</th>
          <th>Vehicle ID</th>
          <th>Vehicle</th>
          <th>Date of Accident</th>
          <th>Insurance Co.</th>
          {activeStage === 'process' && <th>Policy No.</th>}
          <th>Est. Amount</th>
          {activeStage === 'process' && <th>Surveyor</th>}
          {activeStage === 'process' && <th>Survey Status</th>}
          {(activeStage === 'settlement' || activeStage === 'all') && <th>Approved Amount</th>}
          {(activeStage === 'settlement' || activeStage === 'all') && <th>Settlement Date</th>}
          <th>Claim Mode</th>
          <th>Stage Status</th>
          {(activeStage === 'settlement' || activeStage === 'all') && <th style={{ textAlign: 'center' }}>Documents</th>}
          <th style={{ textAlign: 'center' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {list.map(claim => {
          const vehicleId = claim.vehicleId || repairs.find(r => r.repairNo === claim.repairNo)?.vehicleId || '';
          const docList = [
            { label: 'Photos', url: claim.accidentPhotos },
            { label: 'Report', url: claim.policeReport },
            { label: 'FIR', url: claim.firCopy },
            { label: 'Other', url: claim.otherDocuments },
          ].filter(d => !!d.url);
          const isCashless = (claim.claimMode || '').includes('Cashless');
          const isReimb = (claim.claimMode || '').includes('Reimbursement');
          const estAmt = claim.estimatedClaimAmount || repairs.find(r => r.repairNo === claim.repairNo)?.estimatedClaimAmount || '';
          const insCompany = claim.insuranceCompany || repairs.find(r => r.repairNo === claim.repairNo)?.insuranceCompany || '';

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
              <td>{insCompany || '—'}</td>

              {activeStage === 'process' && (
                <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{claim.policyNo || '—'}</span></td>
              )}

              <td>{estAmt ? `₹${Number(estAmt).toLocaleString('en-IN')}` : '—'}</td>

              {activeStage === 'process' && (
                <td><span style={{ fontWeight: 700, fontSize: 12 }}>{claim.surveyorName || 'Assigned'}</span></td>
              )}

              {activeStage === 'process' && (
                <td><Badge label={claim.surveyStatus || 'Completed'} variant="success" /></td>
              )}

              {(activeStage === 'settlement' || activeStage === 'all') && (
                <td>
                  {claim.claimApprovedAmount ? (
                    <span style={{ fontWeight: 800, color: '#059669', fontSize: 13 }}>
                      ₹{Number(claim.claimApprovedAmount).toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>—</span>
                  )}
                </td>
              )}

              {(activeStage === 'settlement' || activeStage === 'all') && (
                <td>
                  {claim.claimSettlementDate ? (
                    <div style={{ fontWeight: 700, color: '#059669' }}>
                      {formatDate(claim.claimSettlementDate)}
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>—</span>
                  )}
                </td>
              )}

              <td>
                {isCashless ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11.5 }}>
                    ⚡ Cashless
                  </span>
                ) : isReimb ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ede9fe', color: '#6d28d9', padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11.5 }}>
                    💰 Reimbursement
                  </span>
                ) : (
                  <span style={{ color: '#64748b', fontSize: 12 }}>—</span>
                )}
              </td>

              <td>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: '#ecfdf5', color: '#047857', padding: '3px 8px',
                  borderRadius: 6, fontSize: 11.5, fontWeight: 800
                }}>
                  {activeStage === 'incident'
                    ? '✓ Incident Submitted'
                    : activeStage === 'process'
                    ? '✓ Survey & Process Done'
                    : activeStage === 'settlement'
                    ? (claim.claimStatus === 'Rejected' ? '❌ Rejected' : '✓ Claim Settled')
                    : (claim.claimStatus === 'Rejected' ? '❌ Rejected' : '✓ Settled')}
                </span>
              </td>

              {(activeStage === 'settlement' || activeStage === 'all') && (
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
              )}

              <td style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button className="btn btn-ghost btn-xs" title="View Details" onClick={() => { setSelected(claim); setModal('view'); }}><Eye size={15} /></button>
                  {canEdit && (
                    <>
                      <button className="btn btn-ghost btn-xs" title="Edit Claim" onClick={() => { setSelected(claim); setModal('edit'); }}><Edit2 size={15} /></button>
                      {(activeStage === 'settlement' || activeStage === 'all') && (
                        <button className="btn btn-ghost btn-xs" title="Delete Claim" style={{ color: '#ef4444' }} onClick={() => setDeleteDialog(claim)}><Trash2 size={15} /></button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div>
      {!canEdit && <ReadOnlyNotice moduleName="Accident & Insurance Claims" />}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: 6 }}>
              Accident & Insurance Claims
            </span>
          </div>
          <h1 className="page-title">
            {activeStage === 'incident' 
              ? 'Claim of accident' 
              : activeStage === 'process' 
              ? 'Process of claim' 
              : 'Claim settlement'}
          </h1>
          <p className="page-subtitle">
            {activeStage === 'incident' && `${stagePendingClaims.length} accident claims awaiting incident submission, ${stageCompletedClaims.length} completed`}
            {activeStage === 'process' && `${stagePendingClaims.length} claims awaiting survey & processing, ${stageCompletedClaims.length} completed`}
            {activeStage === 'settlement' && `${stagePendingClaims.length} claims awaiting settlement approval, ${stageCompletedClaims.length} finalized & settled`}
          </p>
        </div>
        {canEdit && activeStage === 'incident' && (
          <button className="btn btn-primary" onClick={() => { setSelected(null); setPreselectedRepairNo(null); setModal('add'); }}>
            <Plus size={16} strokeWidth={2.5} /> New Claim
          </button>
        )}
      </div>

      {/* 2 Main Status Tabs (Pending Claims & Completed Claims) */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => { setStatusTab('pending'); setPage(1); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13.5,
            cursor: 'pointer', transition: 'all 0.15s',
            background: statusTab === 'pending' ? '#059669' : '#ffffff',
            color: statusTab === 'pending' ? '#ffffff' : '#475569',
            border: statusTab === 'pending' ? '1.5px solid #059669' : '1.5px solid #e2e8f0',
            boxShadow: statusTab === 'pending' ? '0 4px 12px rgba(5, 150, 105, 0.25)' : 'none',
          }}
        >
          <Clock size={16} />
          Pending Claims
          <span style={{
            background: statusTab === 'pending' ? 'rgba(255,255,255,0.25)' : '#ecfdf5',
            color: statusTab === 'pending' ? '#ffffff' : '#059669',
            padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 800
          }}>
            {stagePendingClaims.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setStatusTab('completed'); setPage(1); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13.5,
            cursor: 'pointer', transition: 'all 0.15s',
            background: statusTab === 'completed' ? '#059669' : '#ffffff',
            color: statusTab === 'completed' ? '#ffffff' : '#475569',
            border: statusTab === 'completed' ? '1.5px solid #059669' : '1.5px solid #e2e8f0',
            boxShadow: statusTab === 'completed' ? '0 4px 12px rgba(5, 150, 105, 0.25)' : 'none',
          }}
        >
          <CheckCircle2 size={16} />
          Completed Claims
          <span style={{
            background: statusTab === 'completed' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
            color: statusTab === 'completed' ? '#ffffff' : '#64748b',
            padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 800
          }}>
            {stageCompletedClaims.length}
          </span>
        </button>
      </div>

      <div className="data-table-container">
        <div className="filter-bar">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              placeholder={
                statusTab === 'pending' 
                  ? 'Search pending claims...' 
                  : statusTab === 'completed'
                  ? 'Search completed claims...'
                  : 'Search all claims...'
              }
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {statusTab === 'completed' ? (
            <select className="form-select" style={{ width: 180 }} value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {settlementStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <select className="form-select" style={{ width: 210 }} value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Process Statuses</option>
              {processStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {(search || statusFilter) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); }}>
              <X size={14} /> Clear
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto', padding: statusTab === 'both' ? '16px' : '0' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <SpeedingCarLoader size="medium" />
            </div>
          ) : statusTab === 'pending' ? (
            /* ─────────────────────────────────────────────────────────────
               TAB 1: PENDING TABLE
               ───────────────────────────────────────────────────────────── */
            filteredPending.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No pending accident claims"
                message="All claims for this stage have been completed or moved to the next step."
                action={canEdit && activeStage === 'incident' && (
                  <button className="btn btn-primary" onClick={() => { setSelected(null); setPreselectedRepairNo(null); setModal('add'); }}>
                    <Plus size={14} /> New Claim
                  </button>
                )}
              />
            ) : (
              renderPendingTable(pagedList)
            )
          ) : (
            /* ─────────────────────────────────────────────────────────────
               TAB 2: COMPLETED TABLE
               ───────────────────────────────────────────────────────────── */
            filteredCompleted.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No completed claims"
                message="Claims that complete this stage will appear here."
              />
            ) : (
              renderCompletedTable(pagedList)
            )
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

      {/* Add / Edit Claim Modal (Full Form) */}
      <Modal isOpen={modal === 'add' || modal === 'edit'} onClose={() => { setModal(null); setPreselectedRepairNo(null); }}
        title={modal === 'edit' ? `Edit Claim — ${selected?.claimNo}` : 'New Accident Claim'} icon={AlertTriangle} size="xl">
        <ClaimForm claim={selected} claims={claims} repairs={repairs} preselectedRepairNo={preselectedRepairNo}
          onClose={() => { setModal(null); setPreselectedRepairNo(null); }} onSaved={() => { setModal(null); setPreselectedRepairNo(null); handleStageChange('incident'); load(); }} />
      </Modal>

      {/* Stage Action Form Modal (Opens when user clicks Action button in Pending table) */}
      <Modal isOpen={modal === 'process'} onClose={() => { setModal(null); setSelected(null); }}
        title={
          modalStage === 'incident' 
            ? `Stage 1: Claim of Accident — ${selected?.claimNo}`
            : modalStage === 'process'
            ? `Stage 2: Process of Claim — ${selected?.claimNo}`
            : `Stage 3: Claim Settlement — ${selected?.claimNo}`
        }
        icon={modalStage === 'settlement' ? CheckCircle2 : modalStage === 'process' ? Clock : Shield}
        size="lg"
      >
        {selected && (
          <ClaimProcessForm
            claim={selected}
            targetStage={modalStage}
            onClose={() => { setModal(null); setSelected(null); }}
            onSaved={(stg) => {
              setModal(null);
              setSelected(null);
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

              {/* 2. Insurance & Policy Coverage */}
              <div className="form-section-header" style={{ marginBottom: 12 }}>
                <div className="form-section-icon"><Shield size={17} strokeWidth={2.2} /></div>
                <div className="form-section-title">Insurance & Policy Coverage</div>
              </div>
              <div className="detail-grid" style={{ marginBottom: 18 }}>
                {[
                  ['Insurance Company', selected.insuranceCompany || repairs.find(r => r.repairNo === selected.repairNo)?.insuranceCompany],
                  ['Policy No.', selected.policyNo],
                  ['Policy Validity', formatDate(selected.policyValidity)],
                  ['Type Of Claim', selected.typeOfClaim || 'Own Damage'],
                  ['Claim Settlement Mode', selected.claimMode],
                  ['Estimated Claim Amount', selected.estimatedClaimAmount ? `₹${Number(selected.estimatedClaimAmount).toLocaleString('en-IN')}` : '—'],
                  ['Expected Settlement Date', formatDate(selected.expectedSettlementDate || calculateExpectedSettlementDate(selected.claimIntimatedDate || selected.dateOfAccident, selected.claimMode))],
                  ['FIR Required', selected.firRequired],
                ].map(([l, v]) => (
                  <div key={l} className="detail-item"><label>{l}</label><div className="value">{v || '—'}</div></div>
                ))}
              </div>

              {/* 3. Survey & Processing */}
              <div className="form-section-header" style={{ marginBottom: 12 }}>
                <div className="form-section-icon"><CheckCircle size={17} strokeWidth={2.2} /></div>
                <div className="form-section-title">Survey & Processing</div>
              </div>
              <div className="detail-grid" style={{ marginBottom: 18 }}>
                {[
                  ['Claim Intimated Date', formatDate(selected.claimIntimatedDate)],
                  ['Claim Intimation No.', selected.claimIntimationNo],
                  ['Surveyor Name', selected.surveyorName],
                  ['Surveyor Mobile', selected.surveyorMobileNo],
                  ['Survey Date', formatDate(selected.surveyDate)],
                  ['Survey Status', selected.surveyStatus],
                  ['Claim Status', selected.claimStatus],
                  ['Claim Approved Amount', selected.claimApprovedAmount ? `₹${Number(selected.claimApprovedAmount).toLocaleString('en-IN')}` : '—'],
                  ['Actual Settlement Date', formatDate(selected.claimSettlementDate)],
                ].map(([l, v]) => (
                  <div key={l} className="detail-item"><label>{l}</label><div className="value">{v || '—'}</div></div>
                ))}
              </div>
              {selected.claimStatus === 'Rejected' && selected.claimRejectedReason && (
                <div className="detail-item" style={{ marginBottom: 16 }}>
                  <label style={{ color: '#ef4444' }}>Rejection Reason</label>
                  <div className="value" style={{ color: '#ef4444' }}>{selected.claimRejectedReason}</div>
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
