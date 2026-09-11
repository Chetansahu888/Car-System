// pages/Fastag.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, Plus, Search, Eye, Edit2, Trash2, CheckCircle2,
  AlertTriangle, X, Car, Shield, RefreshCw, QrCode, Building, Phone, Smartphone, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCars, getFastags, saveFastag, deleteFastag, onStoreUpdate } from '../store/dataStore';
import { formatDate, today } from '../utils/dateUtils';
import { uploadFileToDrive } from '../api/googleSheetsClient';
import { useAuth, PAGE_KEYS } from '../context/AuthContext';
import { ITEMS_PER_PAGE } from '../constants';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import FileUpload from '../components/ui/FileUpload';
import ReadOnlyNotice from '../components/shared/ReadOnlyNotice';
import SpeedingCarLoader from '../components/ui/SpeedingCarLoader';
import { openDocument } from '../utils/fileUtils';

const POPULAR_BANKS = [
  'ICICI Bank Fastag',
  'State Bank of India (SBI)',
  'HDFC Bank Fastag',
  'Paytm Payments Bank',
  'Axis Bank Fastag',
  'IDFC FIRST Bank',
  'Airtel Payments Bank',
  'Kotak Mahindra Bank',
  'Bank of Baroda',
  'IndusInd Bank',
  'Punjab National Bank (PNB)',
  'Other Bank / NPCI Provider',
];

const VEHICLE_CLASSES = [
  'VC4 - Car / Jeep / Van',
  'VC5 - Light Commercial Vehicle (LCV)',
  'VC6 - Bus 2-Axle / Truck 2-Axle',
  'VC7 - Commercial Vehicle 3-Axle',
  'VC12 - 4 to 6 Axle Vehicle',
];

const Fastag = () => {
  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.FASTAG);

  const [cars, setCars] = useState([]);
  const [fastags, setFastags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'missing' | 'low'
  const [page, setPage] = useState(1);

  // Modals
  const [formModalCar, setFormModalCar] = useState(null); // Car for adding/editing fastag
  const [viewFastag, setViewFastag] = useState(null); // Fastag for preview card
  const [balanceModal, setBalanceModal] = useState(null); // Fastag quick recharge modal
  const [newBalance, setNewBalance] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    tagId: '',
    bankName: POPULAR_BANKS[0],
    vehicleClass: VEHICLE_CLASSES[0],
    linkedMobile: '',
    walletId: '',
    balance: '500',
    lowBalanceLimit: '200',
    activationDate: today(),
    expiryDate: '',
    fastagStatus: 'Active',
    documentUrl: null,
    remarks: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [c, ft] = await Promise.all([getCars(), getFastags()]);
    setCars(c);
    setFastags(ft);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const unsub = onStoreUpdate(() => {
      loadData();
    });
    return unsub;
  }, [loadData]);

  // Fastags mapped by vehicleId
  const fastagMap = fastags.reduce((acc, ft) => {
    if (ft.vehicleId) acc[ft.vehicleId] = ft;
    if (ft.registrationNo) acc[ft.registrationNo] = ft;
    return acc;
  }, {});

  // Metrics
  const totalCars = cars.length;
  const activeCount = cars.filter(c => {
    const ft = fastagMap[c.vehicleId] || fastagMap[c.registrationNo];
    return ft && ft.fastagStatus === 'Active';
  }).length;
  const missingCount = totalCars - activeCount;
  const totalBalance = cars.reduce((sum, c) => {
    const ft = fastagMap[c.vehicleId] || fastagMap[c.registrationNo];
    return sum + (ft ? (Number(ft.balance) || 0) : 0);
  }, 0);

  // Filter cars
  const filteredCars = cars.filter(car => {
    const q = search.toLowerCase();
    const ft = fastagMap[car.vehicleId] || fastagMap[car.registrationNo];
    const isAdded = !!ft;
    const isLow = isAdded && Number(ft.balance || 0) <= Number(ft.lowBalanceLimit || 200);

    const matchesSearch = !q ||
      car.carName?.toLowerCase().includes(q) ||
      car.vehicleId?.toLowerCase().includes(q) ||
      car.registrationNo?.toLowerCase().includes(q) ||
      car.firmName?.toLowerCase().includes(q) ||
      car.nameOfOwner?.toLowerCase().includes(q) ||
      ft?.tagId?.toLowerCase().includes(q) ||
      ft?.bankName?.toLowerCase().includes(q) ||
      ft?.linkedMobile?.includes(q);

    let matchesFilter = true;
    if (statusFilter === 'active') matchesFilter = isAdded && ft.fastagStatus === 'Active';
    if (statusFilter === 'missing') matchesFilter = !isAdded || ft.fastagStatus === 'Not Added';
    if (statusFilter === 'low') matchesFilter = isLow;

    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredCars.length / ITEMS_PER_PAGE) || 1;
  const pagedCars = filteredCars.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Open Form to Add or Edit Fastag for a car
  const handleOpenForm = (car) => {
    const existing = fastagMap[car.vehicleId] || fastagMap[car.registrationNo];
    setFormModalCar(car);

    if (existing) {
      setFormData({
        tagId: existing.tagId || '',
        bankName: existing.bankName || POPULAR_BANKS[0],
        vehicleClass: existing.vehicleClass || VEHICLE_CLASSES[0],
        linkedMobile: existing.linkedMobile || '',
        walletId: existing.walletId || '',
        balance: existing.balance || '500',
        lowBalanceLimit: existing.lowBalanceLimit || '200',
        activationDate: existing.activationDate || today(),
        expiryDate: existing.expiryDate || '',
        fastagStatus: existing.fastagStatus || 'Active',
        documentUrl: existing.documentUrl || null,
        remarks: existing.remarks || '',
      });
    } else {
      // Clean form for adding new fastag
      setFormData({
        tagId: `34161FA${Date.now().toString().slice(-8)}`,
        bankName: POPULAR_BANKS[0],
        vehicleClass: VEHICLE_CLASSES[0],
        linkedMobile: '',
        walletId: `WLT-${car.registrationNo ? car.registrationNo.replace(/\s+/g, '') : Date.now()}`,
        balance: '500',
        lowBalanceLimit: '200',
        activationDate: today(),
        expiryDate: '',
        fastagStatus: 'Active',
        documentUrl: null,
        remarks: '',
      });
    }
  };

  // Submit Fastag Form
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.tagId.trim()) {
      toast.error('Tag ID / Barcode is required');
      return;
    }
    if (!formData.bankName) {
      toast.error('Issuing Bank is required');
      return;
    }

    setSubmitting(true);
    try {
      let finalDocUrl = formData.documentUrl;

      // Handle Drive file upload if local blob/data
      if (formData.documentUrl?.url && formData.documentUrl.url.startsWith('data:')) {
        const driveUrl = await uploadFileToDrive(
          formData.documentUrl.url,
          `${formModalCar.registrationNo || 'car'}_Fastag_${formData.tagId.slice(-6)}`,
          formData.documentUrl.type
        );
        if (driveUrl) finalDocUrl = driveUrl;
      } else if (typeof formData.documentUrl === 'object' && formData.documentUrl?.url) {
        finalDocUrl = formData.documentUrl.url;
      }

      const payload = {
        vehicleId: formModalCar.vehicleId,
        carName: formModalCar.carName,
        firmName: formModalCar.firmName || '',
        registrationNo: formModalCar.registrationNo,
        fuelType: formModalCar.fuelType || '',
        owner: formModalCar.nameOfOwner || '',
        tagId: formData.tagId.trim(),
        bankName: formData.bankName,
        vehicleClass: formData.vehicleClass,
        linkedMobile: formData.linkedMobile,
        walletId: formData.walletId,
        balance: formData.balance || '0',
        lowBalanceLimit: formData.lowBalanceLimit || '200',
        activationDate: formData.activationDate,
        expiryDate: formData.expiryDate,
        fastagStatus: formData.fastagStatus || 'Active',
        documentUrl: finalDocUrl,
        remarks: formData.remarks,
      };

      await saveFastag(payload);
      toast.success(`Fastag updated for ${formModalCar.registrationNo}`);
      setFormModalCar(null);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to save Fastag');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Balance Update
  const handleQuickBalanceUpdate = async (e) => {
    e.preventDefault();
    if (!balanceModal) return;
    try {
      await saveFastag({
        ...balanceModal,
        balance: String(newBalance || '0'),
      });
      toast.success('Fastag balance updated');
      setBalanceModal(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Update failed');
    }
  };

  // Remove Fastag
  const handleDelete = async (car) => {
    if (!window.confirm(`Are you sure you want to remove Fastag for ${car.registrationNo}?`)) return;
    try {
      await deleteFastag(car.vehicleId);
      toast.success('Fastag removed');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to remove');
    }
  };

  return (
    <div className="fastag-page">
      {!canEdit && <ReadOnlyNotice moduleName="Fastag Management" />}

      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 36, height: 36, borderRadius: 10, background: '#ecfdf5',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#059669'
            }}>
              <CreditCard size={20} />
            </span>
            Vehicle Fastag Management
          </h1>
          <p className="page-subtitle">
            Manage NETC Fastag RFID tags, issuing banks, wallet balances, and highway toll compliance for all fleet cars
          </p>
        </div>
      </div>

      {/* Metric Cards in Horizontal Boxes */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="stat-card" style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', borderLeftWidth: 4, borderLeftColor: '#3b82f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fleet Vehicles</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <Car size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{totalCars}</div>
          <div style={{ fontSize: 11.5, color: '#3b82f6', marginTop: 6, fontWeight: 600 }}>Total Fleet Cars</div>
        </div>

        <div className="stat-card" style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', borderLeftWidth: 4, borderLeftColor: '#059669' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fastag Active</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#059669', lineHeight: 1 }}>{activeCount}</div>
          <div style={{ fontSize: 11.5, color: '#059669', marginTop: 6, fontWeight: 700 }}>
            {((activeCount / (totalCars || 1)) * 100).toFixed(0)}% Fleet Tagged
          </div>
        </div>

        <div className="stat-card" style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', borderLeftWidth: 4, borderLeftColor: '#d97706' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fastag Not Added</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{missingCount}</div>
          <div style={{ fontSize: 11.5, color: '#d97706', marginTop: 6, fontWeight: 600 }}>Tag Pending Setup</div>
        </div>

        <div className="stat-card" style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', borderLeftWidth: 4, borderLeftColor: '#6366f1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Wallet Balance</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#4338ca', lineHeight: 1 }}>
            ₹{totalBalance.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>Active Fastag Wallets</div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="data-table-container">
        {/* Filter Bar */}
        <div className="filter-bar">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              placeholder="Search by Vehicle ID, Reg No, Bank, Tag ID..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setStatusFilter('all'); setPage(1); }}
            >
              All ({cars.length})
            </button>
            <button
              className={`btn btn-sm ${statusFilter === 'active' ? 'btn-success' : 'btn-outline'}`}
              style={statusFilter === 'active' ? { background: '#059669', borderColor: '#059669', color: '#fff' } : {}}
              onClick={() => { setStatusFilter('active'); setPage(1); }}
            >
              Active ({activeCount})
            </button>
            <button
              className={`btn btn-sm ${statusFilter === 'missing' ? 'btn-warning' : 'btn-outline'}`}
              style={statusFilter === 'missing' ? { background: '#d97706', borderColor: '#d97706', color: '#fff' } : {}}
              onClick={() => { setStatusFilter('missing'); setPage(1); }}
            >
              Not Added ({missingCount})
            </button>
          </div>

          {search && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <SpeedingCarLoader size="medium" />
            </div>
          ) : pagedCars.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No Vehicles Found"
              message="No vehicles match your search query."
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehicle ID</th>
                  <th>Car Name</th>
                  <th>Firm Name</th>
                  <th>Reg. No.</th>
                  <th>Fuel</th>
                  <th>Owner</th>
                  <th style={{ textAlign: 'center' }}>Fastag Status</th>
                  <th style={{ textAlign: 'center', minWidth: 170 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedCars.map(car => {
                  const ft = fastagMap[car.vehicleId] || fastagMap[car.registrationNo];
                  const isAdded = !!ft;
                  const isLow = isAdded && Number(ft.balance || 0) <= Number(ft.lowBalanceLimit || 200);

                  return (
                    <tr key={car.vehicleId}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#059669' }}>
                          {car.vehicleId}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{car.carName}</div>
                        {car.modelNo && <div style={{ fontSize: 11.5, color: '#64748b' }}>{car.modelNo}</div>}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>
                          {car.firmName || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          background: '#f8fafc',
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: '1px solid #e2e8f0',
                          letterSpacing: 0.5
                        }}>
                          {car.registrationNo || '—'}
                        </span>
                      </td>
                      <td>
                        <Badge label={car.fuelType || '—'} variant="info" />
                      </td>
                      <td>
                        <span style={{ color: '#475569', fontWeight: 500 }}>
                          {car.nameOfOwner || '—'}
                        </span>
                      </td>

                      {/* Fastag Status column */}
                      <td style={{ textAlign: 'center' }}>
                        {isAdded ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                              background: isLow ? '#fef3c7' : '#ecfdf5',
                              color: isLow ? '#b45309' : '#059669',
                              border: `1px solid ${isLow ? '#fde68a' : '#a7f3d0'}`
                            }}>
                              <CheckCircle2 size={13} /> {isLow ? 'Low Balance' : 'Active'}
                            </span>
                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                              {ft.bankName?.split(' ')[0] || 'Fastag'} | <strong style={{ color: '#0f172a' }}>₹{Number(ft.balance || 0).toLocaleString('en-IN')}</strong>
                            </div>
                          </div>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                            background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca'
                          }}>
                            Not Added
                          </span>
                        )}
                      </td>

                      {/* Action column */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {!isAdded ? (
                            /* When Fastag is NOT added: Prominent Add Fastag Button */
                            canEdit ? (
                              <button
                                type="button"
                                onClick={() => handleOpenForm(car)}
                                className="btn btn-primary btn-sm"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700,
                                  background: '#059669', borderColor: '#059669', padding: '5px 12px',
                                  boxShadow: '0 2px 6px rgba(5, 150, 105, 0.2)'
                                }}
                              >
                                <Plus size={14} strokeWidth={2.5} /> Add Fastag
                              </button>
                            ) : (
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>No Tag</span>
                            )
                          ) : (
                            /* When Fastag IS added: View Card, Edit, and Balance Update */
                            <>
                              <button
                                type="button"
                                onClick={() => setViewFastag({ car, ft })}
                                className="btn btn-outline btn-xs"
                                title="View Digital Fastag Card"
                                style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                              >
                                <Eye size={13} /> View Tag
                              </button>
                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenForm(car)}
                                    className="btn btn-ghost btn-xs"
                                    title="Edit Fastag Details"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setBalanceModal(ft); setNewBalance(ft.balance || '0'); }}
                                    className="btn btn-ghost btn-xs"
                                    title="Quick Balance Update"
                                    style={{ color: '#059669' }}
                                  >
                                    ₹
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(car)}
                                    className="btn btn-ghost btn-xs"
                                    style={{ color: '#ef4444' }}
                                    title="Remove Fastag"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
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
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={filteredCars.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>

      {/* ─── ADD / EDIT FASTAG MODAL ─── */}
      <Modal
        isOpen={!!formModalCar}
        onClose={() => setFormModalCar(null)}
        title={fastagMap[formModalCar?.vehicleId] ? `Edit Fastag — ${formModalCar?.registrationNo}` : `Add Fastag — ${formModalCar?.registrationNo}`}
        icon={CreditCard}
        size="lg"
      >
        {formModalCar && (
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Car Information Banner */}
            <div style={{
              background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10,
              padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10
            }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>Selected Car: </span>
                <strong style={{ fontSize: 14, color: '#064e3b', marginLeft: 4 }}>{formModalCar.carName}</strong>
                <span style={{ marginLeft: 8, background: '#d1fae5', padding: '2px 8px', borderRadius: 4, fontWeight: 800, color: '#047857' }}>
                  {formModalCar.registrationNo}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#047857', fontWeight: 600 }}>
                Owner: {formModalCar.nameOfOwner || '—'} | Vehicle ID: {formModalCar.vehicleId}
              </div>
            </div>

            <div className="form-grid-2">
              {/* Tag ID / RFID Barcode */}
              <div className="form-group">
                <label className="form-label">
                  Fastag Tag ID / RFID EPC No. <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                    <QrCode size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    className="form-input"
                    style={{ paddingLeft: 34, fontFamily: 'monospace', fontWeight: 700 }}
                    placeholder="e.g. 34161FA820938472901"
                    value={formData.tagId}
                    onChange={e => setFormData({ ...formData, tagId: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              {/* Issuing Bank */}
              <div className="form-group">
                <label className="form-label">Issuing Bank / Provider <span className="required">*</span></label>
                <select
                  className="form-select"
                  value={formData.bankName}
                  onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                >
                  {POPULAR_BANKS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              {/* Linked Mobile Number */}
              <div className="form-group">
                <label className="form-label">Linked Mobile Number (OTP & SMS Alerts)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                    <Smartphone size={16} />
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    className="form-input"
                    style={{ paddingLeft: 34 }}
                    placeholder="10-digit mobile number"
                    value={formData.linkedMobile}
                    onChange={e => setFormData({ ...formData, linkedMobile: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
              </div>

              {/* Vehicle Class */}
              <div className="form-group">
                <label className="form-label">Vehicle Class</label>
                <select
                  className="form-select"
                  value={formData.vehicleClass}
                  onChange={e => setFormData({ ...formData, vehicleClass: e.target.value })}
                >
                  {VEHICLE_CLASSES.map(vc => (
                    <option key={vc} value={vc}>{vc}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              {/* Fastag Wallet / Account ID */}
              <div className="form-group">
                <label className="form-label">Wallet / Customer Account ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. WLT-987654321"
                  value={formData.walletId}
                  onChange={e => setFormData({ ...formData, walletId: e.target.value })}
                />
              </div>

              {/* Current Balance */}
              <div className="form-group">
                <label className="form-label">Current Balance (₹)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#059669' }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    style={{ paddingLeft: 28 }}
                    value={formData.balance}
                    onChange={e => setFormData({ ...formData, balance: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="form-grid-2">
              {/* Low Balance Alert Threshold */}
              <div className="form-group">
                <label className="form-label">Low Balance Warning Threshold (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.lowBalanceLimit}
                  onChange={e => setFormData({ ...formData, lowBalanceLimit: e.target.value })}
                />
              </div>

              {/* Status */}
              <div className="form-group">
                <label className="form-label">Fastag Status</label>
                <select
                  className="form-select"
                  value={formData.fastagStatus}
                  onChange={e => setFormData({ ...formData, fastagStatus: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Low Balance">Low Balance</option>
                  <option value="Suspended">Suspended / Blacklisted</option>
                  <option value="Deactivated">Deactivated / Closed</option>
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              {/* Activation Date */}
              <div className="form-group">
                <label className="form-label">Activation / Registration Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.activationDate}
                  onChange={e => setFormData({ ...formData, activationDate: e.target.value })}
                />
              </div>

              {/* Expiry Date */}
              <div className="form-group">
                <label className="form-label">Tag Expiry / Validity Date (Optional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.expiryDate}
                  onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
            </div>

            {/* Document Upload */}
            <div className="form-group">
              <label className="form-label">Fastag Barcode / RFID Document Photo</label>
              <FileUpload
                value={formData.documentUrl}
                onChange={file => setFormData({ ...formData, documentUrl: file })}
                label="Upload Fastag Card Photo or Registration Receipt"
                accept="image/*,application/pdf"
              />
            </div>

            {/* Remarks */}
            <div className="form-group">
              <label className="form-label">Remarks / Notes</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Additional notes, toll plaza discounts, etc."
                value={formData.remarks}
                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={submitting}
                onClick={() => setFormModalCar(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ background: '#059669', borderColor: '#059669', fontWeight: 800, minWidth: 140 }}
              >
                {submitting ? 'Saving Fastag...' : 'Save Fastag Details'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── DIGITAL FASTAG CARD PREVIEW MODAL ─── */}
      <Modal
        isOpen={!!viewFastag}
        onClose={() => setViewFastag(null)}
        title="Digital Fastag Pass & Details"
        icon={CreditCard}
        size="md"
      >
        {viewFastag && (() => {
          const { car, ft } = viewFastag;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Realistic Digital Fastag Card Mockup */}
              <div style={{
                background: 'linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%)',
                borderRadius: 16,
                padding: '20px 24px',
                color: '#ffffff',
                boxShadow: '0 12px 28px rgba(5, 150, 105, 0.25)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Background watermarks */}
                <div style={{
                  position: 'absolute', right: -20, bottom: -20, opacity: 0.12,
                  fontSize: 120, fontWeight: 900, pointerEvents: 'none', lineHeight: 1
                }}>
                  NETC
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 800, opacity: 0.85, textTransform: 'uppercase' }}>
                      NETC FASTAG
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{ft.bankName || 'Fastag Service'}</div>
                  </div>
                  <div style={{
                    background: 'rgba(255,255,255,0.2)', padding: '4px 10px',
                    borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: 0.5
                  }}>
                    {ft.fastagStatus || 'Active'}
                  </div>
                </div>

                {/* RFID Barcode Simulation */}
                <div style={{
                  background: '#ffffff', borderRadius: 8, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 16, color: '#0f172a'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <QrCode size={30} color="#065f46" />
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                        RFID TAG BARCODE
                      </div>
                      <div style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 800, letterSpacing: 1 }}>
                        {ft.tagId}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vehicle & Wallet Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase' }}>Registration No.</div>
                    <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 0.5 }}>{car.registrationNo}</div>
                    <div style={{ fontSize: 11, opacity: 0.9 }}>{car.carName}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase' }}>Wallet Balance</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>₹{Number(ft.balance || 0).toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: 11, opacity: 0.9 }}>{ft.vehicleClass || 'VC4'}</div>
                  </div>
                </div>
              </div>

              {/* Detailed Specs List */}
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12,
                padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13
              }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12 }}>Firm Name:</span>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{car.firmName || '—'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12 }}>Owner Name:</span>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{car.nameOfOwner || '—'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12 }}>Linked Mobile:</span>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{ft.linkedMobile || '—'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12 }}>Wallet ID:</span>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{ft.walletId || '—'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12 }}>Activation Date:</span>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatDate(ft.activationDate) || '—'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12 }}>Expiry Date:</span>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatDate(ft.expiryDate) || '—'}</div>
                </div>
              </div>

              {ft.documentUrl && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => openDocument(ft.documentUrl, `${car.registrationNo}_Fastag_Receipt`)}
                    className="btn btn-outline btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                  >
                    <FileText size={14} /> View Uploaded Fastag Document
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-outline" onClick={() => setViewFastag(null)}>
                  Close
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: '#059669', borderColor: '#059669' }}
                    onClick={() => {
                      const c = car;
                      setViewFastag(null);
                      handleOpenForm(c);
                    }}
                  >
                    <Edit2 size={14} /> Edit Fastag
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ─── QUICK RECHARGE / BALANCE MODAL ─── */}
      <Modal
        isOpen={!!balanceModal}
        onClose={() => setBalanceModal(null)}
        title="Update Fastag Balance"
        icon={CreditCard}
        size="sm"
      >
        {balanceModal && (
          <form onSubmit={handleQuickBalanceUpdate}>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
              Update current wallet balance for Fastag ID: <strong>{balanceModal.tagId}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">New Wallet Balance (₹)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#059669' }}>₹</span>
                <input
                  type="number"
                  min="0"
                  required
                  className="form-input"
                  style={{ paddingLeft: 28, fontSize: 16, fontWeight: 700 }}
                  value={newBalance}
                  onChange={e => setNewBalance(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[200, 500, 1000, 2000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() => setNewBalance(String((Number(newBalance) || 0) + amt))}
                >
                  +{amt}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-outline" onClick={() => setBalanceModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ background: '#059669', borderColor: '#059669' }}>
                Save Balance
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default Fastag;
