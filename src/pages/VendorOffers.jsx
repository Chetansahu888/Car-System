// pages/VendorOffers.jsx
import { useState, useEffect, useCallback } from 'react';
import { Store, Search, Eye, CheckCircle, X, XCircle, Clock, CheckCircle2, AlertCircle, FileText, Wrench, Plus, HardDrive, Shield, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getVendorOffers, getRepairs, addVendorOffer, updateRepair, approveVendorOffer, rejectVendorOffer, getMasterRepairTypes, syncAllFromSheets, onStoreUpdate } from '../store/dataStore';
import { generateId } from '../utils/idGenerator';
import { formatDate, today, createTimestamp } from '../utils/dateUtils';
import { openDocument } from '../utils/fileUtils';
import { uploadFileToDrive } from '../api/googleSheetsClient';
import { ITEMS_PER_PAGE } from '../constants';
import { useAuth, PAGE_KEYS } from '../context/AuthContext';
import ReadOnlyNotice from '../components/shared/ReadOnlyNotice';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import FileUpload from '../components/ui/FileUpload';
import LoadingOverlay from '../components/ui/LoadingOverlay';

// ─── Vendor Offer Creation Form Modal ─────────────────────────────────────────
const CreateOfferModal = ({ repair, repairTypes, onClose, onSaved }) => {
  const [form, setForm] = useState({
    garageName: repair?.garage || '',
    expectedCompletionDate: '',
    photoOfOffer: null,
    insurance: repair?.insuranceToBeClaimed || 'No',
    typesOfRepair: [],
  });
  const [saving, setSaving] = useState(false);

  const toggleType = (t) => {
    setForm(f => ({
      ...f,
      typesOfRepair: f.typesOfRepair.includes(t)
        ? f.typesOfRepair.filter(x => x !== t)
        : [...f.typesOfRepair, t]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.expectedCompletionDate) {
      toast.error('Please select Expected Repair Completion Date');
      return;
    }
    if (form.typesOfRepair.length === 0) {
      toast.error('Please select at least one Type of Repair');
      return;
    }

    setSaving(true);
    try {
      let offerPhotoUrl = form.photoOfOffer;

      // Ensure file upload to Google Drive
      if (offerPhotoUrl?.url && offerPhotoUrl.url.startsWith('data:')) {
        const driveUrl = await uploadFileToDrive(offerPhotoUrl.url, `${repair.repairNo}_VendorOffer`, offerPhotoUrl.type);
        if (driveUrl) {
          offerPhotoUrl = driveUrl;
        }
      } else if (typeof offerPhotoUrl === 'object' && offerPhotoUrl?.url) {
        offerPhotoUrl = offerPhotoUrl.url;
      }

      const nowTs = createTimestamp();
      const offerRecord = {
        id: generateId(),
        repairNo: repair.repairNo,
        vehicleId: repair.vehicleId,
        carName: repair.carName,
        garageName: form.garageName || repair.garage || '',
        expectedCompletionDate: form.expectedCompletionDate,
        plannedDate: repair.plannedDate || '',
        actualDate: nowTs,
        photoOfOffer: offerPhotoUrl,
        insurance: form.insurance,
        typesOfRepair: form.typesOfRepair,
        approvalStatus: 'Pending',
        timestamp: nowTs,
      };

      await addVendorOffer(offerRecord);
      await updateRepair(repair.repairNo, { repairStatus: 'Offer Received', actualDate: nowTs });

      toast.success(`Vendor Offer for ${repair.repairNo} submitted successfully!`);
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to submit offer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <LoadingOverlay isVisible={saving} message="Submitting Vendor Offer to Google Sheets & Drive..." />

      {/* Repair Info Card */}
      <div style={{
        padding: '14px 18px', background: '#ecfdf5', borderRadius: 14,
        border: '1.5px solid #a7f3d0', marginBottom: 20, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 11.5, color: '#059669', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Selected Repair Record
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
            <span style={{ color: '#059669', fontFamily: 'monospace' }}>{repair.repairNo}</span> — {repair.carName}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Garage: <strong>{repair.garage || '—'}</strong> | Dept: <strong>{repair.department || '—'}</strong>
          </div>
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 12, background: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#059669', boxShadow: '0 2px 6px rgba(5,150,105,0.15)'
        }}>
          <Wrench size={22} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 1. Repair No. */}
        <div className="form-group">
          <label className="form-label">Repair No. <span className="required">*</span></label>
          <input
            className="form-input"
            value={repair.repairNo}
            readOnly
            style={{
              background: '#f8fafc', fontWeight: 800, color: '#059669',
              fontFamily: 'monospace', fontSize: 14
            }}
          />
        </div>

        {/* 2. Garage Name */}
        <div className="form-group">
          <label className="form-label">Garage Name</label>
          <input
            type="text"
            className="form-input"
            value={form.garageName}
            onChange={e => setForm(f => ({ ...f, garageName: e.target.value }))}
            placeholder="Enter or confirm garage name..."
          />
        </div>

        {/* 3. Expected Repair Completion Date */}
        <div className="form-group">
          <label className="form-label">
            Expected Repair Completion Date <span className="required">*</span>
          </label>
          <input
            type="date"
            className="form-input"
            value={form.expectedCompletionDate}
            onChange={e => setForm(f => ({ ...f, expectedCompletionDate: e.target.value }))}
            required
          />
        </div>

        {/* 4. Insurance */}
        <div className="form-group">
          <label className="form-label">Insurance <span className="required">*</span></label>
          <select
            className="form-select"
            value={form.insurance}
            onChange={e => setForm(f => ({ ...f, insurance: e.target.value }))}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        {/* 3. Types Of Repair (Dynamic from Master Sheet Column B) */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>
              Types Of Repair <span className="required">*</span>
            </label>
            <span style={{ fontSize: 11.5, color: '#059669', fontWeight: 700 }}>
              ✓ Loaded from Master Sheet (Col B)
            </span>
          </div>

          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 10,
            padding: '14px', background: '#f8fafc', borderRadius: 12,
            border: '1.5px solid #e2e8f0', minHeight: 60
          }}>
            {repairTypes.map(t => {
              const isSelected = form.typesOfRepair.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  style={{
                    padding: '7px 16px', borderRadius: 24, fontSize: 13,
                    fontWeight: 700, cursor: 'pointer', border: '1.5px solid',
                    background: isSelected ? '#059669' : '#ffffff',
                    borderColor: isSelected ? '#059669' : '#cbd5e1',
                    color: isSelected ? '#ffffff' : '#334155',
                    boxShadow: isSelected ? '0 3px 10px rgba(5,150,105,0.25)' : 'none',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: 4,
                    border: isSelected ? '2px solid #ffffff' : '1.5px solid #94a3b8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 900
                  }}>
                    {isSelected ? '✓' : ''}
                  </span>
                  {t}
                </button>
              );
            })}
          </div>
          {form.typesOfRepair.length === 0 && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4, fontWeight: 600 }}>
              Please select at least one repair type.
            </div>
          )}
        </div>

        {/* 4. Photo Of Offer */}
        <div className="form-group">
          <label className="form-label">Photo Of Offer</label>
          <FileUpload
            value={form.photoOfOffer}
            onChange={v => setForm(f => ({ ...f, photoOfOffer: v }))}
            accept="image/*,.pdf"
            label="Upload Quotation / Offer Photo"
            id="offer-photo"
          />
        </div>
      </div>

      <div className="modal-footer" style={{ padding: '24px 0 0' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Submitting Offer...</> : '✓ Submit Vendor Offer'}
        </button>
      </div>
    </form>
  );
};

// ─── Vendor Offers Page ───────────────────────────────────────────────────────
const VendorOffers = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [repairs, setRepairs] = useState([]);
  const [offers, setOffers] = useState([]);
  const [masterTypes, setMasterTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [offerModalRepair, setOfferModalRepair] = useState(null);
  const [viewModal, setViewModal] = useState(null);
  const [approveDialog, setApproveDialog] = useState(null);
  const [rejectDialog, setRejectDialog] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actioning, setActioning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, o, types] = await Promise.all([
      getRepairs(),
      getVendorOffers(),
      getMasterRepairTypes()
    ]);
    const enrichedOffers = o.map(offer => {
      const rep = r.find(rep => rep.repairNo === offer.repairNo);
      return {
        ...offer,
        garageName: offer.garageName || rep?.garageName || rep?.garage || '',
        expectedCompletionDate: offer.expectedCompletionDate || rep?.expectedCompletionDate || '',
      };
    });
    setRepairs(r);
    setOffers(enrichedOffers);
    setMasterTypes(types);
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

  // Derived pending repairs (Repairs that don't have an offer yet)
  const submittedRepairNos = new Set(offers.map(o => o.repairNo));
  const pendingRepairs = repairs.filter(r => !submittedRepairNos.has(r.repairNo));

  // Filters
  const filteredPending = pendingRepairs.filter(r => {
    const q = search.toLowerCase();
    return !q || r.repairNo?.toLowerCase().includes(q) || r.carName?.toLowerCase().includes(q) || r.garage?.toLowerCase().includes(q);
  });

  const filteredHistory = offers.filter(o => {
    const q = search.toLowerCase();
    const match = !q || o.repairNo?.toLowerCase().includes(q) || o.carName?.toLowerCase().includes(q);
    const st = !statusFilter || o.approvalStatus === statusFilter;
    return match && st;
  });

  const currentList = activeTab === 'pending' ? filteredPending : filteredHistory;
  const totalPages = Math.ceil(currentList.length / ITEMS_PER_PAGE);
  const pagedList = currentList.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleApprove = async () => {
    setActioning(true);
    try {
      await approveVendorOffer(approveDialog.id);
      toast.success(`Repair ${approveDialog.repairNo} approved successfully`);
      setApproveDialog(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Approval failed');
    } finally { setActioning(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Please provide a rejection reason'); return; }
    setActioning(true);
    try {
      await rejectVendorOffer(rejectDialog.id, rejectReason);
      toast.success('Offer rejected');
      setRejectDialog(null);
      setRejectReason('');
      load();
    } catch (err) {
      toast.error(err.message || 'Rejection failed');
    } finally { setActioning(false); }
  };

  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.VENDOR_OFFERS);

  return (
    <div>
      {!canEdit && <ReadOnlyNotice moduleName="Vendor Offers & Quotes" />}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendor Offers</h1>
          <p className="page-subtitle">
            Manage vendor quotes, repair types, and expected completion dates.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => { setActiveTab('pending'); setPage(1); setSearch(''); }}
          style={{
            padding: '10px 20px', borderRadius: 12, fontWeight: 800, fontSize: 14,
            cursor: 'pointer', border: '1.5px solid', display: 'flex', alignItems: 'center', gap: 8,
            background: activeTab === 'pending' ? '#059669' : '#ffffff',
            borderColor: activeTab === 'pending' ? '#059669' : '#e2e8f0',
            color: activeTab === 'pending' ? '#ffffff' : '#475569',
            boxShadow: activeTab === 'pending' ? '0 4px 14px rgba(5, 150, 105, 0.25)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <Clock size={16} />
          Pending Offers
          <span style={{
            padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 900,
            background: activeTab === 'pending' ? 'rgba(255,255,255,0.25)' : '#ecfdf5',
            color: activeTab === 'pending' ? '#ffffff' : '#059669'
          }}>
            {pendingRepairs.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('history'); setPage(1); setSearch(''); }}
          style={{
            padding: '10px 20px', borderRadius: 12, fontWeight: 800, fontSize: 14,
            cursor: 'pointer', border: '1.5px solid', display: 'flex', alignItems: 'center', gap: 8,
            background: activeTab === 'history' ? '#059669' : '#ffffff',
            borderColor: activeTab === 'history' ? '#059669' : '#e2e8f0',
            color: activeTab === 'history' ? '#ffffff' : '#475569',
            boxShadow: activeTab === 'history' ? '0 4px 14px rgba(5, 150, 105, 0.25)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <FileText size={16} />
          Offers History
          <span style={{
            padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 900,
            background: activeTab === 'history' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
            color: activeTab === 'history' ? '#ffffff' : '#475569'
          }}>
            {offers.length}
          </span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="data-table-container">
        <div className="filter-bar">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              placeholder={activeTab === 'pending' ? "Search pending repairs by no, car, garage..." : "Search offers by repair no..."}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {activeTab === 'history' && (
            <select
              className="form-select"
              style={{ width: 160 }}
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
              <span className="spinner" /> <span style={{ color: '#64748b', fontWeight: 600 }}>Loading vendor offers...</span>
            </div>
          ) : currentList.length === 0 ? (
            <EmptyState
              icon={Store}
              title={activeTab === 'pending' ? "No pending repair offers" : "No offer history found"}
              message={activeTab === 'pending' ? "All repairs have vendor offers submitted." : "Submitted vendor offers will appear here."}
            />
          ) : activeTab === 'pending' ? (
            /* ─── TAB 1: PENDING OFFERS TABLE ─── */
            <table className="data-table">
              <thead>
                <tr>
                  <th>Repair No.</th>
                  <th>Vehicle ID</th>
                  <th>Planned Date</th>
                  <th>Car Name</th>
                  <th>Reason For Repair</th>
                  <th>Garage / Workshop</th>
                  <th>Insurance Claimed?</th>
                  <th>Department</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedList.map(repair => (
                  <tr key={repair.repairNo}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{repair.repairNo}</span></td>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>{repair.vehicleId || '—'}</span></td>
                    <td>
                      {repair.plannedDate ? (
                        <span style={{ fontWeight: 700, color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '4px 10px', borderRadius: 8, fontSize: 12.5, whiteSpace: 'nowrap' }}>
                          📅 {repair.plannedDate}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td><div style={{ fontWeight: 700, color: '#0f172a' }}>{repair.carName}</div></td>
                    <td><div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={repair.reasonForRepair}>{repair.reasonForRepair}</div></td>
                    <td><div style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repair.garage}</div></td>
                    <td><Badge label={repair.insuranceToBeClaimed === 'Yes' ? 'Yes' : 'No'} variant={repair.insuranceToBeClaimed === 'Yes' ? 'warning' : 'gray'} /></td>
                    <td>{repair.department || '—'}</td>
                    <td style={{ fontSize: 12.5, color: '#64748b' }}>{formatDate(repair.timestamp)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {canEdit ? (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setOfferModalRepair(repair)}
                          style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}
                        >
                          <Store size={14} /> Offer
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>View Only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* ─── TAB 2: OFFERS HISTORY TABLE ─── */
            <table className="data-table">
              <thead>
                <tr>
                  <th>Repair No.</th>
                  <th>Vehicle ID</th>
                  <th>Planned Date</th>
                  <th>Actual Date</th>
                  <th>Garage Name</th>
                  <th>Expected Completion Date</th>
                  <th>Types of Repair</th>
                  <th>Insurance</th>
                  <th>Photo of Offer</th>
                  <th>Approval Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedList.map(offer => {
                  const photoUrl = typeof offer.photoOfOffer === 'object' ? offer.photoOfOffer?.url : offer.photoOfOffer;
                  return (
                    <tr key={offer.id}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{offer.repairNo}</span></td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>{offer.vehicleId || '—'}</span></td>
                      <td>
                        {offer.plannedDate ? (
                          <span style={{ fontWeight: 700, color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '4px 8px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>
                            📅 {offer.plannedDate}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        {offer.actualDate ? (
                          <span style={{ fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '4px 8px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>
                            ⏱️ {offer.actualDate}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 12.5 }}>
                          {offer.garageName || offer.garage || '—'}
                        </span>
                      </td>
                      <td>
                        {offer.expectedCompletionDate ? (
                          <span style={{ fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '4px 8px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>
                            📅 {offer.expectedCompletionDate}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {(offer.typesOfRepair || []).map(t => (
                            <span key={t} className="badge badge-info" style={{ fontSize: 11.5, fontWeight: 700 }}>{t}</span>
                          ))}
                        </div>
                      </td>
                      <td><Badge label={offer.insurance === 'Yes' ? 'Yes' : 'No'} variant={offer.insurance === 'Yes' ? 'warning' : 'gray'} /></td>
                      <td>
                        {photoUrl ? (
                          <button
                            type="button"
                            onClick={() => openDocument(photoUrl, `${offer.repairNo}_Offer`)}
                            className="btn btn-outline btn-xs"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                          >
                            <Eye size={13} /> View Photo
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>No photo</span>
                        )}
                      </td>
                      <td>
                        <Badge
                          label={offer.approvalStatus}
                          variant={offer.approvalStatus === 'Approved' ? 'success' : offer.approvalStatus === 'Rejected' ? 'danger' : 'warning'}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => setViewModal(offer)}
                          title="View Offer Details"
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

      {/* Create Offer Modal */}
      <Modal
        isOpen={!!offerModalRepair}
        onClose={() => setOfferModalRepair(null)}
        title={`Submit Vendor Offer — ${offerModalRepair?.repairNo}`}
        icon={Store}
        size="lg"
      >
        {offerModalRepair && (
          <CreateOfferModal
            repair={offerModalRepair}
            repairTypes={masterTypes}
            onClose={() => setOfferModalRepair(null)}
            onSaved={() => { setOfferModalRepair(null); load(); }}
          />
        )}
      </Modal>

      {/* View Modal */}
      <Modal isOpen={!!viewModal} onClose={() => setViewModal(null)} title="Vendor Offer Details" icon={Store} size="md">
        {viewModal && (
          <div>
            <div className="detail-grid">
              {[
                ['Repair No.', viewModal.repairNo],
                ['Garage Name', viewModal.garageName || viewModal.garage],
                ['Expected Completion Date', viewModal.expectedCompletionDate],
                ['Insurance', viewModal.insurance],
                ['Approval Status', viewModal.approvalStatus],
                ['Submitted Date', formatDate(viewModal.timestamp)],
                ['Approved At', viewModal.approvedAt ? formatDate(viewModal.approvedAt) : '—'],
              ].map(([l, v]) => (
                <div key={l} className="detail-item"><label>{l}</label><div className="value">{v || '—'}</div></div>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Types of Repair</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(viewModal.typesOfRepair || []).map(t => <span key={t} className="badge badge-info">{t}</span>)}
              </div>
            </div>

            {viewModal.photoOfOffer && (
              <div style={{ marginTop: 16 }}>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Offer Photo</label>
                <button
                  type="button"
                  onClick={() => openDocument(typeof viewModal.photoOfOffer === 'object' ? viewModal.photoOfOffer?.url : viewModal.photoOfOffer, `${viewModal.repairNo}_Offer`)}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  <Eye size={14} /> Open Offer Photo
                </button>
              </div>
            )}

            {viewModal.rejectionReason && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: '#fee2e2', borderRadius: 12, border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700, marginBottom: 4 }}>Rejection Reason</div>
                <div style={{ fontSize: 13.5, color: '#991b1b' }}>{viewModal.rejectionReason}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Approve Confirm */}
      <ConfirmDialog
        isOpen={!!approveDialog}
        onClose={() => setApproveDialog(null)}
        onConfirm={handleApprove}
        loading={actioning}
        title="Confirm Approval"
        variant="success"
        message={`Are you sure you want to approve the vendor offer for Repair No. ${approveDialog?.repairNo}? This will unlock delivery planning.`}
        confirmLabel="Confirm Approval"
        confirmClass="btn btn-primary"
      />

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectDialog}
        onClose={() => { setRejectDialog(null); setRejectReason(''); }}
        title="Reject Vendor Offer"
        icon={XCircle}
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => { setRejectDialog(null); setRejectReason(''); }} disabled={actioning}>Cancel</button>
            <button className="btn btn-danger" onClick={handleReject} disabled={actioning}>
              {actioning ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Reject Offer'}
            </button>
          </>
        }
      >
        {rejectDialog && (
          <div>
            <p style={{ color: '#475569', fontSize: 14, marginBottom: 16 }}>
              Rejecting offer for <strong style={{ color: '#0f172a' }}>{rejectDialog.repairNo}</strong>.
            </p>
            <div className="form-group">
              <label className="form-label">Rejection Reason <span className="required">*</span></label>
              <textarea
                className="form-textarea"
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VendorOffers;
