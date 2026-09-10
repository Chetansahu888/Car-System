// pages/AccidentClaims.jsx
import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Plus, Search, Eye, Edit2, Trash2, X, Wrench, Shield, FileText, User, CheckCircle, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getClaims, addClaim, updateClaim, deleteClaim, getRepairs, getCars, getInsurance, onStoreUpdate } from '../store/dataStore';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import { generateClaimNo, generateId } from '../utils/idGenerator';
import { formatDate, today } from '../utils/dateUtils';
import { validateForm, required } from '../utils/validators';
import { CLAIM_STATUS_STEPS, ITEMS_PER_PAGE, SURVEY_STATUS } from '../constants';
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

const EMPTY_CLAIM = {
  repairNo: '', vehicleId: '', vehicleName: '', registrationNo: '',
  dateOfAccident: '', timeOfAccident: '', accidentLocation: '', accidentReason: '',
  driverName: '', driverMobileNo: '', insuranceCompany: '', policyNo: '',
  policyValidity: '', insuranceClaim: 'Yes', estimatedClaimAmount: '',
  accidentPhotos: null, firRequired: 'No', firCopy: null, policeReport: null, otherDocuments: null,
  claimIntimatedDate: '', claimIntimationNo: '', surveyorName: '', surveyorMobileNo: '',
  surveyDate: '', surveyStatus: 'Pending', claimStatus: 'Claim Not Intimated',
  claimApprovedAmount: '', claimRejectedReason: '', claimSettlementDate: '', remarks: ''
};

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

  const handleRepairSelect = (repairNo) => {
    const repair = repairs.find(r => r.repairNo === repairNo);
    setForm(f => ({
      ...f, repairNo, vehicleId: repair?.vehicleId || '',
      vehicleName: repair?.carName || '', registrationNo: '',
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
      if (isEdit) {
        await updateClaim(claim.claimNo, { ...form, updatedAt: new Date().toISOString() });
        toast.success('Claim updated');
      } else {
        const claimNo = generateClaimNo(claims);
        await addClaim({ ...form, claimNo, id: generateId(), timestamp: new Date().toISOString(), createdAt: new Date().toISOString() });
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
          <input type="date" className="form-input" value={form.dateOfAccident} onChange={e => set('dateOfAccident', e.target.value)} />
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
  const [claims, setClaims] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
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

  const filtered = claims.filter(c => {
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
          <button className="btn btn-primary" onClick={() => { setSelected(null); setModal('add'); }}>
            <Plus size={16} strokeWidth={2.5} /> New Claim
          </button>
        )}
      </div>

      <div className="data-table-container">
        <div className="filter-bar">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input className="search-input" placeholder="Search claims..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-select" style={{ width: 200 }} value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {claimStatuses.map(s => <option key={s} value={s}>{s}</option>)}
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
            <EmptyState icon={AlertTriangle} title="No claims found"
              message="Accident claims will appear here when insurance is claimed from a repair."
              action={canEdit ? <button className="btn btn-primary" onClick={() => setModal('add')}><Plus size={14} /> New Claim</button> : null}
            />
          ) : (
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
                  <th style={{ textAlign: 'center' }}>Actions</th>
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
                      <td>{claim.insuranceCompany || '—'}</td>
                      <td>{claim.estimatedClaimAmount ? `₹${Number(claim.estimatedClaimAmount).toLocaleString('en-IN')}` : '—'}</td>
                      <td><Badge label={claim.surveyStatus} variant={claim.surveyStatus === 'Completed' ? 'success' : 'warning'} /></td>
                      <td><Badge label={claim.claimStatus} /></td>
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

      {/* Add/Edit Modal */}
      <Modal isOpen={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'edit' ? `Edit Claim — ${selected?.claimNo}` : 'New Accident Claim'} icon={AlertTriangle} size="xl">
        <ClaimForm claim={selected} claims={claims} repairs={repairs}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      </Modal>

      {/* View Modal */}
      <Modal isOpen={modal === 'view'} onClose={() => setModal(null)}
        title={`Claim Details — ${selected?.claimNo}`} icon={AlertTriangle} size="lg">
        {selected && (
          <div>
            <ClaimStatusStepper status={selected.claimStatus} />
            <div style={{ marginTop: 20 }}>
              <div className="detail-grid">
                {[
                  ['Claim No.', selected.claimNo], ['Repair No.', selected.repairNo],
                  ['Vehicle ID', selected.vehicleId || repairs.find(r => r.repairNo === selected.repairNo)?.vehicleId],
                  ['Vehicle', selected.vehicleName], ['Registration', selected.registrationNo],
                  ['Date of Accident', formatDate(selected.dateOfAccident)], ['Time', selected.timeOfAccident],
                  ['Location', selected.accidentLocation], ['Driver', selected.driverName],
                  ['Driver Mobile', selected.driverMobileNo], ['Insurance Company', selected.insuranceCompany],
                  ['Policy No.', selected.policyNo], ['Policy Validity', formatDate(selected.policyValidity)],
                  ['Estimated Amount', selected.estimatedClaimAmount ? `₹${Number(selected.estimatedClaimAmount).toLocaleString('en-IN')}` : '—'],
                  ['Approved Amount', selected.claimApprovedAmount ? `₹${Number(selected.claimApprovedAmount).toLocaleString('en-IN')}` : '—'],
                  ['Surveyor', selected.surveyorName], ['Survey Date', formatDate(selected.surveyDate)],
                  ['Settlement Date', formatDate(selected.claimSettlementDate)],
                ].map(([l, v]) => (
                  <div key={l} className="detail-item"><label>{l}</label><div className="value">{v || '—'}</div></div>
                ))}
              </div>
              {selected.accidentReason && (
                <div className="detail-item" style={{ marginTop: 16 }}>
                  <label>Accident Description</label>
                  <div className="value" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.accidentReason}</div>
                </div>
              )}
              {selected.remarks && (
                <div className="detail-item" style={{ marginTop: 12 }}>
                  <label>Remarks</label>
                  <div className="value">{selected.remarks}</div>
                </div>
              )}

              {/* Documents */}
              {(() => {
                const docs = [
                  { label: '📷 Accident Photos', url: selected.accidentPhotos },
                  { label: '📋 FIR Copy', url: selected.firCopy },
                  { label: '📑 Police Report', url: selected.policeReport },
                  { label: '📁 Other Document', url: selected.otherDocuments },
                ].filter(d => !!d.url);

                if (docs.length === 0) return null;
                return (
                  <div style={{ marginTop: 20, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                    <div className="form-section-header">
                      <div className="form-section-icon"><FileText size={18} /></div>
                      <div className="form-section-title">Attached Claim Documents</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {docs.map(d => {
                        const targetUrl = typeof d.url === 'object' ? d.url?.url : d.url;
                        return (
                          <button
                            key={d.label}
                            type="button"
                            onClick={() => openDocument(targetUrl, `${selected.claimNo}_doc`)}
                            className="btn btn-outline btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
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
