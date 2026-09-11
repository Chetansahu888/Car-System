// pages/Challans.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Search, Plus, Eye, CheckCircle2, Clock,
  FileText, X, Car, CreditCard, Shield, ExternalLink, Trash2, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCars, getChallans, addChallan, updateChallan, deleteChallan, onStoreUpdate } from '../store/dataStore';
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

const COMMON_CHALLAN_REASONS = [
  'Over Speeding',
  'Red Light Jumping / Signal Violation',
  'Wrong Parking / No Parking Zone',
  'Driving Without Seatbelt',
  'Expired Pollution / PUCC',
  'Driving Without Valid Documents',
  'Mobile Phone Usage While Driving',
  'Dangerous / Reckless Driving',
  'No Entry Zone Violation',
  'Overloading / Capacity Violation',
  'Dark Tinted Glass / Sunfilm Violation',
  'Other Traffic Violation',
];

const Challans = () => {
  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.CHALLANS);

  const [cars, setCars] = useState([]);
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'clear' | 'paid'
  const [page, setPage] = useState(1);

  // Dialog & Modal States
  const [confirmCar, setConfirmCar] = useState(null); // Car for confirmation dialog
  const [formModalCar, setFormModalCar] = useState(null); // Car for which form is open
  const [editChallan, setEditChallan] = useState(null); // Challan being edited
  const [viewCarHistory, setViewCarHistory] = useState(null); // Car for which history is viewed
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    dateOfChallan: today(),
    reasonCategory: COMMON_CHALLAN_REASONS[0],
    reasonDetails: '',
    driverName: '',
    driverMobile: '',
    challanNo: '',
    challanAmount: '',
    location: '',
    paymentStatus: 'Pending',
    paymentDate: '',
    transactionId: '',
    documentUrl: null,
    remarks: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [c, ch] = await Promise.all([getCars(), getChallans()]);
    setCars(c);
    setChallans(ch);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const unsub = onStoreUpdate(() => {
      loadData();
    });
    return unsub;
  }, [loadData]);

  // Group challans by vehicleId
  const challansByVehicle = cars.reduce((acc, car) => {
    const list = challans.filter(ch => ch.vehicleId === car.vehicleId || (car.registrationNo && ch.registrationNo === car.registrationNo));
    acc[car.vehicleId] = list;
    return acc;
  }, {});

  // Stats calculation
  const totalFleet = cars.length;
  const vehiclesWithChallans = Object.values(challansByVehicle).filter(list => list.length > 0).length;
  const pendingChallans = challans.filter(ch => ch.paymentStatus === 'Pending');
  const totalPendingAmount = pendingChallans.reduce((sum, ch) => sum + (Number(ch.challanAmount) || 0), 0);
  const paidChallans = challans.filter(ch => ch.paymentStatus === 'Paid');

  // Filter cars based on search and status
  const filteredCars = cars.filter(car => {
    const q = search.toLowerCase();
    const carChallans = challansByVehicle[car.vehicleId] || [];
    const hasPending = carChallans.some(ch => ch.paymentStatus === 'Pending');
    const hasPaidOnly = carChallans.length > 0 && !hasPending;
    const isClear = carChallans.length === 0;

    const matchesSearch = !q ||
      car.carName?.toLowerCase().includes(q) ||
      car.vehicleId?.toLowerCase().includes(q) ||
      car.registrationNo?.toLowerCase().includes(q) ||
      car.firmName?.toLowerCase().includes(q) ||
      car.nameOfOwner?.toLowerCase().includes(q) ||
      carChallans.some(ch => ch.driverName?.toLowerCase().includes(q) || ch.challanNo?.toLowerCase().includes(q));

    let matchesStatus = true;
    if (statusFilter === 'pending') matchesStatus = hasPending;
    if (statusFilter === 'clear') matchesStatus = isClear;
    if (statusFilter === 'paid') matchesStatus = hasPaidOnly;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredCars.length / ITEMS_PER_PAGE) || 1;
  const pagedCars = filteredCars.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Trigger Action button on table row
  const handleActionClick = (car) => {
    setConfirmCar(car);
  };

  // After user confirms "हाँ सच में चालान कटा है"
  const handleConfirmYes = () => {
    const targetCar = confirmCar;
    setConfirmCar(null);
    setEditChallan(null);
    setFormData({
      dateOfChallan: today(),
      reasonCategory: COMMON_CHALLAN_REASONS[0],
      reasonDetails: '',
      driverName: '',
      driverMobile: '',
      challanNo: `CH-${Date.now().toString().slice(-6)}`,
      challanAmount: '',
      location: '',
      paymentStatus: 'Pending',
      paymentDate: '',
      transactionId: '',
      documentUrl: null,
      remarks: '',
    });
    setFormModalCar(targetCar);
  };

  // Open edit for an existing challan
  const handleEditChallan = (challan, car) => {
    setEditChallan(challan);
    setFormModalCar(car);
    const isStandardReason = COMMON_CHALLAN_REASONS.includes(challan.reasonOfChallan);
    setFormData({
      dateOfChallan: challan.dateOfChallan || today(),
      reasonCategory: isStandardReason ? challan.reasonOfChallan : 'Other Traffic Violation (अन्य उल्लंघन)',
      reasonDetails: isStandardReason ? '' : (challan.reasonOfChallan || ''),
      driverName: challan.driverName || '',
      driverMobile: challan.driverMobile || '',
      challanNo: challan.challanNo || '',
      challanAmount: challan.challanAmount || '',
      location: challan.location || '',
      paymentStatus: challan.paymentStatus || 'Pending',
      paymentDate: challan.paymentDate || '',
      transactionId: challan.transactionId || '',
      documentUrl: challan.documentUrl || null,
      remarks: challan.remarks || '',
    });
    setViewCarHistory(null);
  };

  // Submit Challan Form
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.dateOfChallan) {
      toast.error('Date of Challan is required');
      return;
    }
    if (!formData.driverName) {
      toast.error('Driver Name is required');
      return;
    }
    if (!formData.challanAmount || Number(formData.challanAmount) <= 0) {
      toast.error('Please enter a valid Challan Amount');
      return;
    }

    setSubmitting(true);
    try {
      let finalDocUrl = formData.documentUrl;

      // Handle Drive file upload if local blob/data
      if (formData.documentUrl?.url && formData.documentUrl.url.startsWith('data:')) {
        const driveUrl = await uploadFileToDrive(
          formData.documentUrl.url,
          `${formModalCar.registrationNo || 'vehicle'}_Challan_${formData.challanNo || Date.now()}`,
          formData.documentUrl.type
        );
        if (driveUrl) finalDocUrl = driveUrl;
      } else if (typeof formData.documentUrl === 'object' && formData.documentUrl?.url) {
        finalDocUrl = formData.documentUrl.url;
      }

      const combinedReason = formData.reasonCategory === 'Other Traffic Violation (अन्य उल्लंघन)' && formData.reasonDetails.trim()
        ? formData.reasonDetails.trim()
        : formData.reasonCategory + (formData.reasonDetails.trim() ? ` - ${formData.reasonDetails.trim()}` : '');

      const payload = {
        vehicleId: formModalCar.vehicleId,
        carName: formModalCar.carName,
        firmName: formModalCar.firmName || '',
        registrationNo: formModalCar.registrationNo,
        fuelType: formModalCar.fuelType || '',
        owner: formModalCar.nameOfOwner || '',
        dateOfChallan: formData.dateOfChallan,
        reasonOfChallan: combinedReason,
        driverName: formData.driverName,
        driverMobile: formData.driverMobile,
        challanNo: formData.challanNo,
        challanAmount: formData.challanAmount,
        location: formData.location,
        paymentStatus: formData.paymentStatus,
        paymentDate: formData.paymentStatus === 'Paid' ? (formData.paymentDate || today()) : '',
        transactionId: formData.transactionId,
        documentUrl: finalDocUrl,
        remarks: formData.remarks,
      };

      if (editChallan) {
        await updateChallan(editChallan.id, payload);
        toast.success('Challan updated successfully');
      } else {
        await addChallan(payload);
        toast.success(`Challan recorded for ${formModalCar.registrationNo}`);
      }

      setFormModalCar(null);
      setEditChallan(null);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to save Challan');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick mark as Paid
  const handleMarkAsPaid = async (challan) => {
    try {
      await updateChallan(challan.id, {
        paymentStatus: 'Paid',
        paymentDate: today(),
      });
      toast.success('Challan marked as Paid');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  // Delete challan
  const handleDeleteChallan = async (challanId) => {
    if (!window.confirm('Are you sure you want to delete this Challan record?')) return;
    try {
      await deleteChallan(challanId);
      toast.success('Challan record deleted');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="challans-page">
      {!canEdit && <ReadOnlyNotice moduleName="Challan Management" />}

      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 36, height: 36, borderRadius: 10, background: '#fee2e2',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626'
            }}>
              <AlertTriangle size={20} />
            </span>
            Vehicle Challan Management
          </h1>
          <p className="page-subtitle">
            Track traffic challans, driver liabilities, violations, and fine settlement status for fleet vehicles
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
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{totalFleet}</div>
          <div style={{ fontSize: 11.5, color: '#3b82f6', marginTop: 6, fontWeight: 600 }}>Active Fleet Database</div>
        </div>

        <div className="stat-card" style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', borderLeftWidth: 4, borderLeftColor: '#f97316' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Vehicles with Challans</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#ea580c', lineHeight: 1 }}>{vehiclesWithChallans}</div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>
            {((vehiclesWithChallans / (totalFleet || 1)) * 100).toFixed(0)}% of fleet impacted
          </div>
        </div>

        <div className="stat-card" style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', borderLeftWidth: 4, borderLeftColor: '#ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pending Challans</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{pendingChallans.length}</div>
          <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 6, fontWeight: 700 }}>
            ₹{totalPendingAmount.toLocaleString('en-IN')} Unpaid Fine
          </div>
        </div>

        <div className="stat-card" style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', borderLeftWidth: 4, borderLeftColor: '#059669' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Settled / Paid</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#059669', lineHeight: 1 }}>{paidChallans.length}</div>
          <div style={{ fontSize: 11.5, color: '#059669', marginTop: 6, fontWeight: 600 }}>Receipts Verified</div>
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
              placeholder="Search by Vehicle ID, Reg No, Car Name, Driver..."
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
              className={`btn btn-sm ${statusFilter === 'pending' ? 'btn-danger' : 'btn-outline'}`}
              style={statusFilter === 'pending' ? { background: '#ef4444', borderColor: '#ef4444', color: '#fff' } : {}}
              onClick={() => { setStatusFilter('pending'); setPage(1); }}
            >
              Pending ({pendingChallans.length})
            </button>
            <button
              className={`btn btn-sm ${statusFilter === 'clear' ? 'btn-success' : 'btn-outline'}`}
              style={statusFilter === 'clear' ? { background: '#059669', borderColor: '#059669', color: '#fff' } : {}}
              onClick={() => { setStatusFilter('clear'); setPage(1); }}
            >
              No Challans
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
              icon={AlertTriangle}
              title="No Vehicles Found"
              message="Adjust your search filters or ensure vehicles are added in Purchase Car."
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
                  <th style={{ textAlign: 'center' }}>Challan Status</th>
                  <th style={{ textAlign: 'center', minWidth: 160 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedCars.map(car => {
                  const carChallans = challansByVehicle[car.vehicleId] || [];
                  const pendingList = carChallans.filter(c => c.paymentStatus === 'Pending');
                  const hasChallan = carChallans.length > 0;

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
                      <td style={{ textAlign: 'center' }}>
                        {pendingList.length > 0 ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                              background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca'
                            }}>
                              <AlertTriangle size={12} /> {pendingList.length} Pending
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#b91c1c' }}>
                              ₹{pendingList.reduce((s, c) => s + (Number(c.challanAmount) || 0), 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                        ) : hasChallan ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                            background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0'
                          }}>
                            <CheckCircle2 size={12} /> All Paid ({carChallans.length})
                          </span>
                        ) : (
                          <span style={{
                            padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            background: '#f1f5f9', color: '#64748b'
                          }}>
                            Clean / No Challan
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {/* Primary Action Button: Confirm & Open Form */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleActionClick(car)}
                              className="btn btn-danger btn-sm"
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700,
                                background: '#dc2626', borderColor: '#dc2626', padding: '5px 11px',
                                boxShadow: '0 2px 5px rgba(220, 38, 38, 0.2)'
                              }}
                              title="Record a new challan for this vehicle"
                            >
                              <Plus size={14} strokeWidth={2.5} /> Issue Challan
                            </button>
                          )}

                          {/* View Past Challans History if any */}
                          {hasChallan && (
                            <button
                              type="button"
                              onClick={() => setViewCarHistory(car)}
                              className="btn btn-outline btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, padding: '5px 9px' }}
                              title="View all challans for this vehicle"
                            >
                              <Eye size={14} /> History ({carChallans.length})
                            </button>
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

      {/* ─── 1. POPUP CONFIRMATION MODAL ─── */}
      <Modal
        isOpen={!!confirmCar}
        onClose={() => setConfirmCar(null)}
        title="Challan Verification Confirmation"
        icon={AlertTriangle}
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setConfirmCar(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              style={{ background: '#dc2626', borderColor: '#dc2626', fontWeight: 800 }}
              onClick={handleConfirmYes}
            >
              Yes, Proceed
            </button>
          </div>
        }
      >
        <div style={{ padding: '8px 0', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#fee2e2',
            color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)'
          }}>
            <AlertTriangle size={28} />
          </div>

          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
            Has a challan been issued for this car?
          </h3>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
            Confirm to open the official traffic challan entry form for this fleet vehicle.
          </p>

          {confirmCar && (
            <div style={{
              background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: 12,
              padding: '12px 16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Vehicle:</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{confirmCar.carName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Registration No:</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>{confirmCar.registrationNo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Vehicle ID:</span>
                <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{confirmCar.vehicleId}</span>
              </div>
              {confirmCar.firmName && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Firm Name:</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{confirmCar.firmName}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ─── 2. CHALLAN ENTRY / EDIT FORM MODAL ─── */}
      <Modal
        isOpen={!!formModalCar}
        onClose={() => { setFormModalCar(null); setEditChallan(null); }}
        title={editChallan ? `Edit Challan — ${editChallan.challanNo}` : `New Traffic Challan — ${formModalCar?.registrationNo}`}
        icon={AlertTriangle}
        size="lg"
      >
        {formModalCar && (
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Car Summary Strip */}
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
              padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10
            }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>Target Vehicle: </span>
                <strong style={{ fontSize: 14, color: '#7f1d1d', marginLeft: 4 }}>{formModalCar.carName}</strong>
                <span style={{ marginLeft: 8, background: '#fee2e2', padding: '2px 8px', borderRadius: 4, fontWeight: 800, color: '#b91c1c' }}>
                  {formModalCar.registrationNo}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#7f1d1d', fontWeight: 600 }}>
                Owner: {formModalCar.nameOfOwner || '—'} | Firm: {formModalCar.firmName || '—'}
              </div>
            </div>

            <div className="form-grid-2">
              {/* Date of Challan */}
              <div className="form-group">
                <label className="form-label">Date of Challan <span className="required">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={formData.dateOfChallan}
                  onChange={e => setFormData({ ...formData, dateOfChallan: e.target.value })}
                />
              </div>

              {/* Challan Number */}
              <div className="form-group">
                <label className="form-label">Challan / Notice No.</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. DL1234567890"
                  value={formData.challanNo}
                  onChange={e => setFormData({ ...formData, challanNo: e.target.value })}
                />
              </div>
            </div>

            {/* Reason of Challan */}
            <div className="form-group">
              <label className="form-label">Reason of Challan / Violation <span className="required">*</span></label>
              <select
                className="form-select"
                value={formData.reasonCategory}
                onChange={e => setFormData({ ...formData, reasonCategory: e.target.value })}
              >
                {COMMON_CHALLAN_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Additional Reason Details if any */}
            <div className="form-group">
              <label className="form-label">Reason Details / Location Specifics</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Near Ashram Flyover, 85 km/h in 50 zone"
                value={formData.reasonDetails}
                onChange={e => setFormData({ ...formData, reasonDetails: e.target.value })}
              />
            </div>

            <div className="form-grid-2">
              {/* Who is Driver */}
              <div className="form-group">
                <label className="form-label">Driver Name <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="Name of person driving at the time"
                  value={formData.driverName}
                  onChange={e => setFormData({ ...formData, driverName: e.target.value })}
                />
              </div>

              {/* Driver Mobile */}
              <div className="form-group">
                <label className="form-label">Driver Mobile Number</label>
                <input
                  type="tel"
                  maxLength={10}
                  className="form-input"
                  placeholder="10-digit phone number"
                  value={formData.driverMobile}
                  onChange={e => setFormData({ ...formData, driverMobile: e.target.value.replace(/\D/g, '') })}
                />
              </div>
            </div>

            <div className="form-grid-2">
              {/* Challan Amount */}
              <div className="form-group">
                <label className="form-label">Challan Amount (₹) <span className="required">*</span></label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#64748b' }}>₹</span>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    style={{ paddingLeft: 28 }}
                    required
                    placeholder="e.g. 1000"
                    value={formData.challanAmount}
                    onChange={e => setFormData({ ...formData, challanAmount: e.target.value })}
                  />
                </div>
              </div>

              {/* Location / Traffic Authority */}
              <div className="form-group">
                <label className="form-label">Traffic Authority / City / State</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Delhi Traffic Police / Noida RTO"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid-2">
              {/* Payment Status */}
              <div className="form-group">
                <label className="form-label">Payment Status <span className="required">*</span></label>
                <select
                  className="form-select"
                  value={formData.paymentStatus}
                  onChange={e => setFormData({ ...formData, paymentStatus: e.target.value })}
                >
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Disputed">Disputed / In Court</option>
                </select>
              </div>

              {/* Payment Date (if Paid) */}
              {formData.paymentStatus === 'Paid' ? (
                <div className="form-group">
                  <label className="form-label">Payment Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.paymentDate}
                    onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Responsible for Payment</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Driver Ramesh / Company"
                    value={formData.remarks}
                    onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  />
                </div>
              )}
            </div>

            {formData.paymentStatus === 'Paid' && (
              <div className="form-group">
                <label className="form-label">Payment Transaction ID / Receipt No.</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. TXN987654321"
                  value={formData.transactionId}
                  onChange={e => setFormData({ ...formData, transactionId: e.target.value })}
                />
              </div>
            )}

            {/* Document Upload (Copy of Challan / Receipt) */}
            <div className="form-group">
              <label className="form-label">Copy of Challan / Notice / Receipt</label>
              <FileUpload
                value={formData.documentUrl}
                onChange={file => setFormData({ ...formData, documentUrl: file })}
                label="Upload Challan Notice or Payment Receipt"
                accept="image/*,application/pdf"
              />
            </div>

            {/* Footer buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={submitting}
                onClick={() => { setFormModalCar(null); setEditChallan(null); }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={submitting}
                style={{ background: '#dc2626', borderColor: '#dc2626', fontWeight: 800, minWidth: 140 }}
              >
                {submitting ? 'Saving Challan...' : (editChallan ? 'Update Challan' : 'Save Challan')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── 3. VEHICLE CHALLAN HISTORY MODAL ─── */}
      <Modal
        isOpen={!!viewCarHistory}
        onClose={() => setViewCarHistory(null)}
        title={`Challan History — ${viewCarHistory?.carName} (${viewCarHistory?.registrationNo})`}
        icon={AlertTriangle}
        size="lg"
      >
        {viewCarHistory && (() => {
          const list = challansByVehicle[viewCarHistory.vehicleId] || [];
          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  Total {list.length} Challan record{list.length !== 1 ? 's' : ''} found
                </span>
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ background: '#dc2626', borderColor: '#dc2626', fontWeight: 700 }}
                    onClick={() => {
                      const car = viewCarHistory;
                      setViewCarHistory(null);
                      handleActionClick(car);
                    }}
                  >
                    <Plus size={14} /> Add Another Challan
                  </button>
                )}
              </div>

              {list.length === 0 ? (
                <EmptyState title="No Challans" message="This vehicle has a clean record with no challans." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {list.map((ch, idx) => {
                    const isPaid = ch.paymentStatus === 'Paid';
                    return (
                      <div
                        key={ch.id || idx}
                        style={{
                          background: isPaid ? '#f0fdf4' : '#fef2f2',
                          border: `1.5px solid ${isPaid ? '#bbf7d0' : '#fecaca'}`,
                          borderRadius: 12,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{
                              fontSize: 11, fontWeight: 800, fontFamily: 'monospace',
                              background: isPaid ? '#dcfce7' : '#fee2e2',
                              color: isPaid ? '#15803d' : '#b91c1c',
                              padding: '2px 8px', borderRadius: 4
                            }}>
                              {ch.challanNo || `CHALLAN #${idx + 1}`}
                            </span>
                            <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>
                              Date: <strong>{formatDate(ch.dateOfChallan)}</strong>
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              fontSize: 15, fontWeight: 900,
                              color: isPaid ? '#15803d' : '#dc2626'
                            }}>
                              ₹{Number(ch.challanAmount || 0).toLocaleString('en-IN')}
                            </span>
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              padding: '3px 8px', borderRadius: 20,
                              background: isPaid ? '#15803d' : '#dc2626',
                              color: '#ffffff'
                            }}>
                              {ch.paymentStatus || 'Pending'}
                            </span>
                          </div>
                        </div>

                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                          Violation: <span style={{ color: '#0f172a' }}>{ch.reasonOfChallan}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6, fontSize: 12, color: '#475569' }}>
                          <div>Driver: <strong>{ch.driverName || '—'}</strong></div>
                          {ch.driverMobile && <div>Mobile: <strong>{ch.driverMobile}</strong></div>}
                          {ch.location && <div>Authority: <strong>{ch.location}</strong></div>}
                          {isPaid && ch.paymentDate && <div>Paid on: <strong>{formatDate(ch.paymentDate)}</strong></div>}
                        </div>

                        {ch.remarks && (
                          <div style={{ fontSize: 11.5, color: '#64748b', fontStyle: 'italic' }}>
                            Note: {ch.remarks}
                          </div>
                        )}

                        {/* Card actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4, paddingTop: 8, borderTop: '1px dashed #cbd5e1' }}>
                          {ch.documentUrl && (
                            <button
                              type="button"
                              onClick={() => openDocument(ch.documentUrl, `Challan_${ch.challanNo}`)}
                              className="btn btn-outline btn-xs"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                            >
                              <FileText size={13} /> View Receipt / Notice
                            </button>
                          )}
                          {canEdit && !isPaid && (
                            <button
                              type="button"
                              onClick={() => handleMarkAsPaid(ch)}
                              className="btn btn-success btn-xs"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, background: '#059669', color: '#fff' }}
                            >
                              <CheckCircle2 size={13} /> Mark Paid
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleEditChallan(ch, viewCarHistory)}
                              className="btn btn-ghost btn-xs"
                              title="Edit Challan Details"
                            >
                              Edit
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleDeleteChallan(ch.id)}
                              className="btn btn-ghost btn-xs"
                              style={{ color: '#ef4444' }}
                              title="Delete Challan"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default Challans;
