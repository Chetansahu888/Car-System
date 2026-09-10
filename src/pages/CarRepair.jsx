// pages/CarRepair.jsx
import { useState, useEffect, useCallback } from 'react';
import { Wrench, Plus, Search, Edit2, Trash2, Eye, X, AlertTriangle, Store, ChevronRight, Car, FileText, CheckCircle, Building, User, HelpCircle, Hash, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCars, getRepairs, addRepair, updateRepair, deleteRepair, getVendorOffers, addVendorOffer, getClaims, onStoreUpdate } from '../store/dataStore';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import { generateRepairNo, generateId } from '../utils/idGenerator';
import { formatDate, today } from '../utils/dateUtils';
import { validateForm, required } from '../utils/validators';
import { DEPARTMENTS, ITEMS_PER_PAGE, TYPES_OF_REPAIR } from '../constants';
import { useAuth, PAGE_KEYS } from '../context/AuthContext';
import ReadOnlyNotice from '../components/shared/ReadOnlyNotice';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import FileUpload from '../components/ui/FileUpload';
import WorkflowTimeline from '../components/shared/WorkflowTimeline';
import SpeedingCarLoader from '../components/ui/SpeedingCarLoader';

const EMPTY_REPAIR = {
  vehicleId: '', carName: '', reasonForRepair: '',
  garage: '', whoTakingCar: '', insuranceToBeClaimed: 'No', department: ''
};

const REPAIR_RULES = { vehicleId: [required], reasonForRepair: [required], garage: [required] };

const EMPTY_OFFER = { photoOfOffer: null, insurance: 'No', typesOfRepair: [] };

// ─── Car Repair Form ──────────────────────────────────────────────────────────
const RepairForm = ({ repair, cars, repairs, onClose, onSaved }) => {
  const isEdit = !!repair;
  const autoRepairNo = isEdit ? repair.repairNo : generateRepairNo(repairs);
  const [form, setForm] = useState(isEdit ? { ...repair } : { ...EMPTY_REPAIR, timestamp: today() });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleCarSelect = (vehicleId) => {
    const car = cars.find(c => c.vehicleId === vehicleId);
    set('vehicleId', vehicleId);
    set('carName', car?.carName || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm(form, REPAIR_RULES);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await updateRepair(repair.repairNo, { ...form, updatedAt: new Date().toISOString() });
        toast.success(`Repair ${repair.repairNo} updated successfully`);
      } else {
        await addRepair({
          ...form, repairNo: autoRepairNo, id: generateId(),
          repairStatus: 'Created', timestamp: new Date().toISOString(), createdAt: new Date().toISOString()
        });
        toast.success(`Repair ${autoRepairNo} created successfully`);
      }
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to save repair');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <LoadingOverlay isVisible={saving} message={isEdit ? "Updating Repair in Google Sheet..." : "Saving Repair to Google Sheet..."} />
      <div className="form-section-header">
        <div className="form-section-icon"><Wrench size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Car Repair Entry Details</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
        {/* 1. Car Repair No. */}
        <div className="form-group">
          <label className="form-label">Car Repair No. <span className="required">*</span></label>
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              value={autoRepairNo}
              readOnly
              style={{
                background: '#f8fafc', fontWeight: 800, color: '#059669',
                fontFamily: 'monospace', fontSize: 14.5, letterSpacing: 0.5,
                border: '1.5px solid #d1fae5'
              }}
            />
          </div>
        </div>

        {/* 2. Car Name */}
        <div className="form-group">
          <label className="form-label">Car Name <span className="required">*</span></label>
          <select
            className={`form-select ${errors.vehicleId ? 'error' : ''}`}
            value={form.vehicleId}
            onChange={e => handleCarSelect(e.target.value)}
            disabled={isEdit}
          >
            <option value="">Select Car Name</option>
            {cars.map(c => (
              <option key={c.vehicleId} value={c.vehicleId}>
                {c.carName} ({c.vehicleId} - {c.registrationNo})
              </option>
            ))}
          </select>
          {errors.vehicleId && <span className="form-error">{errors.vehicleId}</span>}
        </div>

        {/* 3. Reason For Repair */}
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Reason For Repair <span className="required">*</span></label>
          <textarea
            className={`form-textarea ${errors.reasonForRepair ? 'error' : ''}`}
            rows={3}
            value={form.reasonForRepair}
            onChange={e => set('reasonForRepair', e.target.value)}
            placeholder="Describe the issue or reason for repair..."
            style={{ resize: 'vertical' }}
          />
          {errors.reasonForRepair && <span className="form-error">{errors.reasonForRepair}</span>}
        </div>

        {/* 4. Which Garage Is It Going For Repair */}
        <div className="form-group">
          <label className="form-label">Which Garage Is It Going For Repair <span className="required">*</span></label>
          <input
            className={`form-input ${errors.garage ? 'error' : ''}`}
            value={form.garage}
            onChange={e => set('garage', e.target.value)}
            placeholder="Enter garage / workshop name & address"
          />
          {errors.garage && <span className="form-error">{errors.garage}</span>}
        </div>

        {/* 5. Who Is Taking The Car */}
        <div className="form-group">
          <label className="form-label">Who Is Taking The Car</label>
          <input
            className="form-input"
            value={form.whoTakingCar}
            onChange={e => set('whoTakingCar', e.target.value)}
            placeholder="Driver or person name"
          />
        </div>

        {/* 6. Insurance to be claimed */}
        <div className="form-group">
          <label className="form-label">Insurance to be claimed <span className="required">*</span></label>
          <select
            className="form-select"
            value={form.insuranceToBeClaimed}
            onChange={e => set('insuranceToBeClaimed', e.target.value)}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        {/* 7. Department */}
        <div className="form-group">
          <label className="form-label">Department</label>
          <select
            className="form-select"
            value={form.department}
            onChange={e => set('department', e.target.value)}
          >
            <option value="">Select Department</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="modal-footer" style={{ padding: '20px 0 0' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? (
            <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving...</>
          ) : isEdit ? (
            '✓ Update Repair'
          ) : (
            '+ Create Repair'
          )}
        </button>
      </div>
    </form>
  );
};

// ─── Car Repair Main Component ────────────────────────────────────────────────
const CarRepair = ({ onNavigateToAccident }) => {
  const [cars, setCars] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [vendorOffers, setVendorOffers] = useState([]);
  const [claims, setClaims] = useState([]);
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
    const [c, r, v, cl] = await Promise.all([getCars(), getRepairs(), getVendorOffers(), getClaims()]);
    setCars(c); setRepairs(r); setVendorOffers(v); setClaims(cl);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const unsub = onStoreUpdate(() => {
      load();
    });
    return unsub;
  }, [load]);

  const filtered = repairs.filter(r => {
    const q = search.toLowerCase();
    const match = !q || r.repairNo?.toLowerCase().includes(q) || r.carName?.toLowerCase().includes(q) || r.vehicleId?.toLowerCase().includes(q);
    const st = !statusFilter || r.repairStatus === statusFilter;
    return match && st;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteRepair(deleteDialog.repairNo);
      toast.success('Repair deleted');
      setDeleteDialog(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally { setDeleting(false); }
  };

  const repairStatuses = [...new Set(repairs.map(r => r.repairStatus))];
  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.CAR_REPAIR);
  const hasOfferForRepair = (repairNo) => vendorOffers.some(v => v.repairNo === repairNo);
  const hasClaimForRepair = (repairNo) => claims.some(c => c.repairNo === repairNo);

  return (
    <div>
      {!canEdit && <ReadOnlyNotice moduleName="Car Repair Records" />}
      <div className="page-header">
        <div>
          <h1 className="page-title">Car Repair</h1>
          <p className="page-subtitle">{repairs.length} repair job{repairs.length !== 1 ? 's' : ''} recorded</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { setSelected(null); setModal('add'); }}>
            <Plus size={16} strokeWidth={2.5} /> New Repair
          </button>
        )}
      </div>

      <div className="data-table-container">
        <div className="filter-bar">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input className="search-input" placeholder="Search repairs by no, vehicle ID, car name, garage..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-select" style={{ width: 180 }} value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {repairStatuses.map(s => <option key={s} value={s}>{s}</option>)}
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
            <EmptyState icon={Wrench} title="No repairs found"
              message="Create a new repair record to get started."
              action={canEdit ? <button className="btn btn-primary" onClick={() => setModal('add')}><Plus size={14} /> New Repair</button> : null}
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Car Repair No.</th>
                  <th>Vehicle ID</th>
                  <th>Car Name</th>
                  <th>Reason For Repair</th>
                  <th>Which Garage Is It Going</th>
                  <th>Who Is Taking</th>
                  <th>Department</th>
                  <th>Insurance Claimed?</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(repair => (
                  <tr key={repair.repairNo}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{repair.repairNo}</span></td>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>{repair.vehicleId || '—'}</span></td>
                    <td><div style={{ fontWeight: 700, color: '#0f172a' }}>{repair.carName}</div></td>
                    <td><div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={repair.reasonForRepair}>{repair.reasonForRepair}</div></td>
                    <td><div style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repair.garage}</div></td>
                    <td>{repair.whoTakingCar || '—'}</td>
                    <td>{repair.department || '—'}</td>
                    <td><Badge label={repair.insuranceToBeClaimed === 'Yes' ? 'Yes' : 'No'} variant={repair.insuranceToBeClaimed === 'Yes' ? 'warning' : 'gray'} /></td>
                    <td><Badge label={repair.repairStatus} /></td>
                    <td style={{ fontSize: 12.5, color: '#64748b' }}>{formatDate(repair.timestamp)}</td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          title="View Details & Timeline"
                          onClick={() => { setSelected(repair); setModal('view'); }}
                          style={{ color: '#059669', background: '#ecfdf5', padding: '6px 8px', borderRadius: 8 }}
                        >
                          <Eye size={15} />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              title="Edit Repair"
                              onClick={() => { setSelected(repair); setModal('edit'); }}
                              style={{ color: '#0284c7', background: '#f0f9ff', padding: '6px 8px', borderRadius: 8 }}
                            >
                              <Edit2 size={15} />
                            </button>
                            {repair.insuranceToBeClaimed === 'Yes' && !hasClaimForRepair(repair.repairNo) && (
                              <button
                                type="button"
                                className="btn btn-xs"
                                title="Accident / Insurance Claim"
                                style={{ background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: 8, padding: '5px 8px', fontSize: 11.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                onClick={() => { if (onNavigateToAccident) onNavigateToAccident(repair); }}
                              >
                                <AlertTriangle size={12} /> Claim
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              title="Delete Repair"
                              style={{ color: '#ef4444', background: '#fef2f2', padding: '6px 8px', borderRadius: 8 }}
                              onClick={() => setDeleteDialog(repair)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage}
          totalItems={filtered.length} itemsPerPage={ITEMS_PER_PAGE} />
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'edit' ? `Edit Repair — ${selected?.repairNo}` : 'New Repair Record'} icon={Wrench} size="lg">
        <RepairForm repair={selected} cars={cars} repairs={repairs} onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }} />
      </Modal>

      {/* View / Timeline Modal */}
      <Modal isOpen={modal === 'view'} onClose={() => setModal(null)}
        title={`Repair Details — ${selected?.repairNo}`} icon={Wrench} size="lg">
        {selected && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div className="form-section-header">
                <div className="form-section-icon"><Wrench size={18} /></div>
                <div className="form-section-title">Repair Information</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  ['Car Repair No.', selected.repairNo],
                  ['Car Name', selected.carName],
                  ['Vehicle ID', selected.vehicleId],
                  ['Reason For Repair', selected.reasonForRepair],
                  ['Which Garage Is It Going For Repair', selected.garage],
                  ['Who Is Taking The Car', selected.whoTakingCar],
                  ['Department', selected.department],
                  ['Insurance to be claimed', selected.insuranceToBeClaimed]
                ].map(([l, v]) => (
                  <div key={l} className="detail-item"><label>{l}</label><div className="value">{v || '—'}</div></div>
                ))}
              </div>
            </div>
            <div>
              <div className="form-section-header">
                <div className="form-section-icon"><CheckCircle size={18} /></div>
                <div className="form-section-title">Workflow Progress</div>
              </div>
              <WorkflowTimeline repairStatus={selected.repairStatus} />
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog isOpen={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
        loading={deleting} title="Delete Repair"
        message={`Delete repair ${deleteDialog?.repairNo}? This cannot be undone.`}
        confirmLabel="Delete" confirmClass="btn btn-danger" />
    </div>
  );
};

export default CarRepair;
