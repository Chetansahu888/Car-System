// pages/Approvals.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, Search, X, XCircle, Eye, ShieldCheck, Clock,
  Car, Wrench, AlertCircle, FileText, CheckCircle2, Shield, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getVendorOffers, getRepairs, approveVendorOffer, rejectVendorOffer,
  syncAllFromSheets, onStoreUpdate
} from '../store/dataStore';
import { formatDate } from '../utils/dateUtils';
import { openDocument } from '../utils/fileUtils';
import { ITEMS_PER_PAGE } from '../constants';
import { useAuth, PAGE_KEYS } from '../context/AuthContext';
import ReadOnlyNotice from '../components/shared/ReadOnlyNotice';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import SpeedingCarLoader from '../components/ui/SpeedingCarLoader';

// ─── Approval Form Modal ───────────────────────────────────────────────────────
const ApprovalFormModal = ({ offer, onClose, onSaved }) => {
  const [submitting, setSubmitting] = useState(false);

  if (!offer) return null;

  const photoUrl = typeof offer.photoOfOffer === 'object' ? offer.photoOfOffer?.url : offer.photoOfOffer;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await approveVendorOffer(offer.id || offer.repairNo);
      toast.success(`Repair ${offer.repairNo} approved successfully!`);
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Approval action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <LoadingOverlay isVisible={submitting} message="Submitting Approval to Google Sheets..." />

      {/* Header Info Box */}
      <div style={{
        padding: '16px 20px', background: '#ecfdf5', borderRadius: 14,
        border: '1.5px solid #a7f3d0', marginBottom: 20, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
            Selected Repair for Approval
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
            <span style={{ color: '#059669' }}>{offer.repairNo}</span> — {offer.carName || 'Vehicle'}
          </div>
          <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span><strong>Vehicle ID:</strong> {offer.vehicleId || '—'}</span>
            <span><strong>Garage:</strong> {offer.garageName || offer.garage || '—'}</span>
            <span><strong>Insurance:</strong> {offer.insurance || 'No'}</span>
          </div>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: '#10b981',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
        }}>
          <ShieldCheck size={24} />
        </div>
      </div>

      {/* Offer Details Review Card */}
      <div style={{
        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12,
        padding: 16, marginBottom: 20
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
          Quotation / Offer Summary
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <span style={{ fontSize: 11.5, color: '#64748b' }}>Garage Name:</span>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
              {offer.garageName || offer.garage || '—'}
            </div>
          </div>
          <div>
            <span style={{ fontSize: 11.5, color: '#64748b' }}>Expected Completion:</span>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#7c3aed', marginTop: 2 }}>
              📅 {offer.expectedCompletionDate || '—'}
            </div>
          </div>
          <div>
            <span style={{ fontSize: 11.5, color: '#64748b' }}>Offer Submitted:</span>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#059669', marginTop: 2 }}>
              ⏱️ {offer.actualDate || formatDate(offer.timestamp) || '—'}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, color: '#64748b', display: 'block', marginBottom: 5 }}>Selected Repair Types:</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(offer.typesOfRepair || []).map(t => (
              <span key={t} className="badge badge-info" style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px' }}>
                <Wrench size={11} style={{ marginRight: 4 }} /> {t}
              </span>
            ))}
          </div>
        </div>

        {photoUrl && (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 11.5, color: '#64748b', display: 'block', marginBottom: 4 }}>Quotation Photo:</span>
            <button
              type="button"
              onClick={() => openDocument(photoUrl, `${offer.repairNo}_Offer`)}
              className="btn btn-outline btn-xs"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
            >
              <Eye size={13} /> View Quotation Document (Drive)
            </button>
          </div>
        )}
      </div>

      {/* Buttons */}
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
            <><span className="spinner" style={{ width: 15, height: 15 }} /> Submitting Approval...</>
          ) : (
            '✓ Confirm & Approve Offer'
          )}
        </button>
      </div>
    </form>
  );
};

// ─── View Approval Details Modal ───────────────────────────────────────────────
const ViewApprovalModal = ({ offer, onClose }) => {
  if (!offer) return null;
  const photoUrl = typeof offer.photoOfOffer === 'object' ? offer.photoOfOffer?.url : offer.photoOfOffer;

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{
        padding: '16px 20px', background: offer.approvalStatus === 'Approved' ? '#ecfdf5' : (offer.approvalStatus === 'Rejected' ? '#fef2f2' : '#f8fafc'),
        borderRadius: 14, border: `1.5px solid ${offer.approvalStatus === 'Approved' ? '#a7f3d0' : (offer.approvalStatus === 'Rejected' ? '#fecaca' : '#e2e8f0')}`,
        marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: offer.approvalStatus === 'Approved' ? '#059669' : '#dc2626', textTransform: 'uppercase' }}>
            Approval Status
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
            {offer.repairNo} — <span style={{ color: offer.approvalStatus === 'Approved' ? '#059669' : '#dc2626' }}>{offer.approvalStatus}</span>
          </div>
        </div>
        <Badge
          label={offer.approvalStatus}
          variant={offer.approvalStatus === 'Approved' ? 'success' : (offer.approvalStatus === 'Rejected' ? 'danger' : 'warning')}
          style={{ fontSize: 13, padding: '6px 14px' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
          <span style={{ fontSize: 11.5, color: '#64748b' }}>Vehicle ID:</span>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{offer.vehicleId || '—'}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
          <span style={{ fontSize: 11.5, color: '#64748b' }}>Car Name:</span>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{offer.carName || '—'}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
          <span style={{ fontSize: 11.5, color: '#64748b' }}>Garage Name:</span>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{offer.garageName || offer.garage || '—'}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
          <span style={{ fontSize: 11.5, color: '#64748b' }}>Expected Completion:</span>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#7c3aed' }}>{offer.expectedCompletionDate || '—'}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
          <span style={{ fontSize: 11.5, color: '#64748b' }}>Planned Date (Col Q / Q7):</span>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0369a1' }}>{offer.plannedDate2 || '—'}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10 }}>
          <span style={{ fontSize: 11.5, color: '#64748b' }}>Actual Approval Date (Col R):</span>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#059669' }}>{offer.actualDate2 || offer.approvedAt || '—'}</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Types of Repair:</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(offer.typesOfRepair || []).map(t => (
            <span key={t} className="badge badge-info" style={{ fontSize: 12, fontWeight: 700 }}>{t}</span>
          ))}
        </div>
      </div>

      {photoUrl && (
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Quotation / Offer Photo:</span>
          <button
            type="button"
            onClick={() => openDocument(photoUrl, `${offer.repairNo}_Offer`)}
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Eye size={14} /> Open Quotation Document
          </button>
        </div>
      )}

      {offer.approvalRemarks && (
        <div style={{ background: '#f1f5f9', padding: 14, borderRadius: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>Remarks:</span>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#1e293b' }}>{offer.approvalRemarks}</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
        <button className="btn btn-outline" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

// ─── MAIN APPROVALS PAGE ───────────────────────────────────────────────────────
const Approvals = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [approvalModalOffer, setApprovalModalOffer] = useState(null);
  const [viewModalOffer, setViewModalOffer] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [data, repairsList] = await Promise.all([
      getVendorOffers(),
      getRepairs()
    ]);
    const enrichedOffers = data.map(o => {
      const rep = repairsList.find(r => r.repairNo === o.repairNo);
      return {
        ...o,
        plannedDate2: o.plannedDate2 || rep?.plannedDate2 || '',
        vehicleId: o.vehicleId || rep?.vehicleId || '',
        carName: o.carName || rep?.carName || '',
        garageName: o.garageName || rep?.garageName || rep?.garage || '',
        expectedCompletionDate: o.expectedCompletionDate || rep?.expectedCompletionDate || '',
      };
    });
    setOffers(enrichedOffers);
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

  // Tab filtering
  const pendingList = offers.filter(o => o.approvalStatus === 'Pending');
  const historyList = offers.filter(o => o.approvalStatus !== 'Pending');

  const filteredPending = pendingList.filter(o => {
    const q = search.toLowerCase();
    return !q || o.repairNo?.toLowerCase().includes(q) || o.carName?.toLowerCase().includes(q) || o.vehicleId?.toLowerCase().includes(q);
  });

  const filteredHistory = historyList.filter(o => {
    const q = search.toLowerCase();
    const match = !q || o.repairNo?.toLowerCase().includes(q) || o.carName?.toLowerCase().includes(q) || o.vehicleId?.toLowerCase().includes(q);
    const st = !statusFilter || o.approvalStatus === statusFilter;
    return match && st;
  });

  const currentList = activeTab === 'pending' ? filteredPending : filteredHistory;
  const totalPages = Math.ceil(currentList.length / ITEMS_PER_PAGE);
  const pagedList = currentList.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.APPROVALS);

  return (
    <div>
      {!canEdit && <ReadOnlyNotice moduleName="Management Approvals" />}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-subtitle">Review and approve vendor repair quotations & authorizations</p>
        </div>
      </div>

      {/* 2 Tabs: Pending vs History */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => { setActiveTab('pending'); setPage(1); }}
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
          Pending Approvals
          <span style={{
            background: activeTab === 'pending' ? 'rgba(255,255,255,0.25)' : '#ecfdf5',
            color: activeTab === 'pending' ? '#ffffff' : '#059669',
            padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 800
          }}>
            {pendingList.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('history'); setPage(1); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13.5,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'history' ? '#059669' : '#ffffff',
            color: activeTab === 'history' ? '#ffffff' : '#475569',
            border: activeTab === 'history' ? '1.5px solid #059669' : '1.5px solid #e2e8f0',
            boxShadow: activeTab === 'history' ? '0 4px 12px rgba(5, 150, 105, 0.25)' : 'none',
          }}
        >
          <FileText size={16} />
          Approvals History
          <span style={{
            background: activeTab === 'history' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
            color: activeTab === 'history' ? '#ffffff' : '#64748b',
            padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 800
          }}>
            {historyList.length}
          </span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="data-table-container">
        {/* Search & Filters */}
        <div className="filter-bar">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              placeholder={`Search ${activeTab === 'pending' ? 'pending approvals' : 'approval history'}...`}
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

        {/* Tables */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <SpeedingCarLoader size="medium" />
            </div>
          ) : pagedList.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title={activeTab === 'pending' ? 'No pending approvals' : 'No approval history found'}
              message={activeTab === 'pending' ? 'All caught up! No vendor offers waiting for management approval.' : 'No approved or rejected records match your search.'}
            />
          ) : activeTab === 'pending' ? (
            /* ─── TAB 1: PENDING APPROVALS TABLE ─── */
            <table className="data-table">
              <thead>
                <tr>
                  <th>Repair No.</th>
                  <th>Vehicle ID</th>
                  <th>Planned Date</th>
                  <th>Car Name</th>
                  <th>Garage Name</th>
                  <th>Expected Delivery Date</th>
                  <th>Types of Repair</th>
                  <th>Insurance</th>
                  <th>Photo of Offer</th>
                  <th>Offer Submitted</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedList.map(offer => {
                  const photoUrl = typeof offer.photoOfOffer === 'object' ? offer.photoOfOffer?.url : offer.photoOfOffer;
                  const plannedDateColP = offer.plannedDate2 || '';
                  return (
                    <tr key={offer.id || offer.repairNo}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{offer.repairNo}</span></td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>{offer.vehicleId || '—'}</span></td>
                      <td>
                        {plannedDateColP ? (
                          <span style={{ fontWeight: 700, color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '4px 8px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>
                            📅 {plannedDateColP}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>{offer.carName || '—'}</td>
                      <td><span style={{ color: '#475569', fontWeight: 600, fontSize: 12.5 }}>{offer.garageName || offer.garage || '—'}</span></td>
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
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
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
                      <td style={{ fontSize: 12.5, color: '#64748b' }}>{offer.actualDate || formatDate(offer.timestamp)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {canEdit ? (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setApprovalModalOffer(offer)}
                            style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8 }}
                          >
                            <ShieldCheck size={15} /> Approve
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Approval Restricted</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* ─── TAB 2: APPROVALS HISTORY TABLE ─── */
            <table className="data-table">
              <thead>
                <tr>
                  <th>Repair No.</th>
                  <th>Vehicle ID</th>
                  <th>Planned Date</th>
                  <th>Actual Approval Date</th>
                  <th>Garage Name</th>
                  <th>Expected Delivery Date</th>
                  <th>Types of Repair</th>
                  <th>Insurance</th>
                  <th>Photo of Offer</th>
                  <th>Approval Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedList.map(offer => {
                  const photoUrl = typeof offer.photoOfOffer === 'object' ? offer.photoOfOffer?.url : offer.photoOfOffer;
                  const plannedDateColP = offer.plannedDate2 || '';
                  const actualDateColQ = offer.actualDate2 || offer.approvedAt || '';
                  return (
                    <tr key={offer.id || offer.repairNo}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{offer.repairNo}</span></td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>{offer.vehicleId || '—'}</span></td>
                      <td>
                        {plannedDateColP ? (
                          <span style={{ fontWeight: 700, color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '4px 8px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>
                            📅 {plannedDateColP}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        {actualDateColQ ? (
                          <span style={{ fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '4px 8px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap' }}>
                            ⏱️ {actualDateColQ}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td><span style={{ color: '#475569', fontWeight: 600, fontSize: 12.5 }}>{offer.garageName || offer.garage || '—'}</span></td>
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
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
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
                          variant={offer.approvalStatus === 'Approved' ? 'success' : (offer.approvalStatus === 'Rejected' ? 'danger' : 'warning')}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => setViewModalOffer(offer)}
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

      {/* Approval Form Modal */}
      <Modal
        isOpen={!!approvalModalOffer}
        onClose={() => setApprovalModalOffer(null)}
        title={`Approve Vendor Offer — ${approvalModalOffer?.repairNo}`}
        icon={ShieldCheck}
        size="md"
      >
        <ApprovalFormModal
          offer={approvalModalOffer}
          onClose={() => setApprovalModalOffer(null)}
          onSaved={() => {
            setApprovalModalOffer(null);
            load();
          }}
        />
      </Modal>

      {/* View Details Modal */}
      <Modal
        isOpen={!!viewModalOffer}
        onClose={() => setViewModalOffer(null)}
        title={`Approval Details — ${viewModalOffer?.repairNo}`}
        icon={Eye}
        size="md"
      >
        <ViewApprovalModal
          offer={viewModalOffer}
          onClose={() => setViewModalOffer(null)}
        />
      </Modal>
    </div>
  );
};

export default Approvals;
