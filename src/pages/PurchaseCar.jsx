// pages/PurchaseCar.jsx
import { useState, useEffect, useCallback } from 'react';
import { Car, Plus, Search, Edit2, Trash2, Eye, X, Filter, CreditCard, User, Shield, FileText, CheckCircle, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCars, addCar, updateCar, deleteCar, getInsurance, getMasterFirmNames, onStoreUpdate } from '../store/dataStore';
import { generateVehicleId } from '../utils/idGenerator';
import { formatDate, today } from '../utils/dateUtils';
import { validateForm, required, phone, positiveNumber } from '../utils/validators';
import { FUEL_TYPES, ITEMS_PER_PAGE } from '../constants';
import { uploadFileToDrive } from '../api/googleSheetsClient';
import { useAuth, PAGE_KEYS } from '../context/AuthContext';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import FileUpload from '../components/ui/FileUpload';
import ReadOnlyNotice from '../components/shared/ReadOnlyNotice';
import SpeedingCarLoader from '../components/ui/SpeedingCarLoader';
import { openDocument } from '../utils/fileUtils';

const EMPTY_FORM = {
  firmName: '', carName: '', dateOfPurchase: '', modelNo: '', companyPurchasedFrom: '',
  fuelType: '', registrationNo: '', chassisNo: '', engineNo: '',
  hypothecationBank: '', lastEmiDate: '', dateOfReleaseHypothecation: '',
  valueOfCar: '', emiAmount: '', insuranceAmount: '', rtoAmount: '',
  companyMobileNo: '', servicePersonName: '', servicePersonMobileNo: '',
  copyOfInsurance: null, copyOfRegistration: null,
  nameOfCompany: '', nameOfOwner: '', agentName: '',
  dateOfInsurance: '', pollutionDate: ''
};

const FORM_RULES = {
  carName: [required],
  dateOfPurchase: [required],
  registrationNo: [required],
  fuelType: [required],
};

const FormField = ({ label, required: req, error, children }) => (
  <div className="form-group">
    <label className="form-label">{label}{req && <span className="required">*</span>}</label>
    {children}
    {error && <span className="form-error">{error}</span>}
  </div>
);

const CarForm = ({ car, cars, onClose, onSaved }) => {
  const isEdit = !!car;
  const [form, setForm] = useState(isEdit ? { ...EMPTY_FORM, ...car } : { ...EMPTY_FORM });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [firmNames, setFirmNames] = useState([]);

  useEffect(() => {
    const fetchFirms = async () => {
      const firms = await getMasterFirmNames();
      setFirmNames(firms);
    };
    fetchFirms();
  }, []);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm(form, FORM_RULES);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const processedForm = { ...form };

      if (processedForm.copyOfInsurance?.url && processedForm.copyOfInsurance.url.startsWith('data:')) {
        const driveUrl = await uploadFileToDrive(processedForm.copyOfInsurance.url, `${processedForm.registrationNo || 'car'}_Insurance`, processedForm.copyOfInsurance.type);
        if (driveUrl) {
          processedForm.copyOfInsurance = driveUrl;
        }
      } else if (typeof processedForm.copyOfInsurance === 'object' && processedForm.copyOfInsurance?.url) {
        processedForm.copyOfInsurance = processedForm.copyOfInsurance.url;
      }

      if (processedForm.copyOfRegistration?.url && processedForm.copyOfRegistration.url.startsWith('data:')) {
        const driveUrl = await uploadFileToDrive(processedForm.copyOfRegistration.url, `${processedForm.registrationNo || 'car'}_RC`, processedForm.copyOfRegistration.type);
        if (driveUrl) {
          processedForm.copyOfRegistration = driveUrl;
        }
      } else if (typeof processedForm.copyOfRegistration === 'object' && processedForm.copyOfRegistration?.url) {
        processedForm.copyOfRegistration = processedForm.copyOfRegistration.url;
      }

      if (isEdit) {
        await updateCar(car.vehicleId, { ...processedForm, updatedAt: new Date().toISOString() });
        toast.success('Vehicle updated successfully');
      } else {
        const vehicleId = generateVehicleId(cars);
        await addCar({ ...processedForm, vehicleId, createdAt: new Date().toISOString() });
        toast.success(`Vehicle ${vehicleId} added successfully`);
      }
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to save vehicle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <LoadingOverlay isVisible={saving} message={isEdit ? "Updating Vehicle in Google Sheet..." : "Saving Vehicle to Google Sheet..."} />
      {isEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 12, background: '#ecfdf5', border: '1px solid #d1fae5', marginBottom: 24, fontSize: 13.5, color: '#059669', fontWeight: 700 }}>
          🚗 Vehicle ID: <span style={{ color: '#0f172a' }}>{car.vehicleId}</span>
        </div>
      )}

      {/* Vehicle Information */}
      <div className="form-section-header">
        <div className="form-section-icon"><Car size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Vehicle Information</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
        <FormField label="Firm Name" error={errors.firmName}>
          <select
            className={`form-select ${errors.firmName ? 'error' : ''}`}
            value={form.firmName || ''}
            onChange={e => set('firmName', e.target.value)}
          >
            <option value="">Select Firm Name</option>
            {firmNames.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Name of Car / Vehicle" required error={errors.carName}>
          <input className={`form-input ${errors.carName ? 'error' : ''}`} value={form.carName}
            onChange={e => set('carName', e.target.value)} placeholder="e.g. Toyota Fortuner" />
        </FormField>
        <FormField label="Date of Purchase" required error={errors.dateOfPurchase}>
          <input type="date" className={`form-input ${errors.dateOfPurchase ? 'error' : ''}`} value={form.dateOfPurchase}
            onChange={e => set('dateOfPurchase', e.target.value)} />
        </FormField>
        <FormField label="Model No.">
          <input className="form-input" value={form.modelNo} onChange={e => set('modelNo', e.target.value)} placeholder="e.g. FORT-2024" />
        </FormField>
        <FormField label="Company Purchased From">
          <input className="form-input" value={form.companyPurchasedFrom} onChange={e => set('companyPurchasedFrom', e.target.value)} placeholder="Showroom / Dealer name" />
        </FormField>
        <FormField label="Fuel Type" required error={errors.fuelType}>
          <select className={`form-select ${errors.fuelType ? 'error' : ''}`} value={form.fuelType} onChange={e => set('fuelType', e.target.value)}>
            <option value="">Select fuel type</option>
            {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </FormField>
        <FormField label="Registration No." required error={errors.registrationNo}>
          <input className={`form-input ${errors.registrationNo ? 'error' : ''}`} value={form.registrationNo}
            onChange={e => set('registrationNo', e.target.value)} placeholder="e.g. DL-01-AB-1234" />
        </FormField>
        <FormField label="Chassis No.">
          <input className="form-input" value={form.chassisNo} onChange={e => set('chassisNo', e.target.value)} placeholder="Chassis number" />
        </FormField>
        <FormField label="Engine No.">
          <input className="form-input" value={form.engineNo} onChange={e => set('engineNo', e.target.value)} placeholder="Engine number" />
        </FormField>
      </div>

      {/* Financial Information */}
      <div className="form-section-header">
        <div className="form-section-icon"><CreditCard size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Financial Information</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
        <FormField label="Hypothecation Bank">
          <input className="form-input" value={form.hypothecationBank} onChange={e => set('hypothecationBank', e.target.value)} placeholder="Bank name (if loan)" />
        </FormField>
        <FormField label="Last EMI Date">
          <input type="date" className="form-input" value={form.lastEmiDate} onChange={e => set('lastEmiDate', e.target.value)} />
        </FormField>
        <FormField label="Date of Release of Hypothecation">
          <input type="date" className="form-input" value={form.dateOfReleaseHypothecation} onChange={e => set('dateOfReleaseHypothecation', e.target.value)} />
        </FormField>
        <FormField label="Value of Car (₹)">
          <input type="number" className="form-input" value={form.valueOfCar} onChange={e => set('valueOfCar', e.target.value)} placeholder="0" />
        </FormField>
        <FormField label="EMI Amount (₹)">
          <input type="number" className="form-input" value={form.emiAmount} onChange={e => set('emiAmount', e.target.value)} placeholder="0" />
        </FormField>
        <FormField label="Insurance Amount (₹)">
          <input type="number" className="form-input" value={form.insuranceAmount} onChange={e => set('insuranceAmount', e.target.value)} placeholder="0" />
        </FormField>
        <FormField label="RTO Amount (₹)">
          <input type="number" className="form-input" value={form.rtoAmount} onChange={e => set('rtoAmount', e.target.value)} placeholder="0" />
        </FormField>
      </div>

      {/* Service & Contact */}
      <div className="form-section-header">
        <div className="form-section-icon"><User size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Service & Contact Details</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
        <FormField label="Company Mobile No.">
          <input className="form-input" value={form.companyMobileNo} onChange={e => set('companyMobileNo', e.target.value)} placeholder="10-digit number" />
        </FormField>
        <FormField label="Service Person Name">
          <input className="form-input" value={form.servicePersonName} onChange={e => set('servicePersonName', e.target.value)} placeholder="Name" />
        </FormField>
        <FormField label="Service Person Mobile No.">
          <input className="form-input" value={form.servicePersonMobileNo} onChange={e => set('servicePersonMobileNo', e.target.value)} placeholder="10-digit number" />
        </FormField>
      </div>

      {/* Ownership & Insurance */}
      <div className="form-section-header">
        <div className="form-section-icon"><Shield size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Ownership & Policy Dates</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
        <FormField label="Name of the Company">
          <input className="form-input" value={form.nameOfCompany} onChange={e => set('nameOfCompany', e.target.value)} placeholder="Company name" />
        </FormField>
        <FormField label="Name of the Owner">
          <input className="form-input" value={form.nameOfOwner} onChange={e => set('nameOfOwner', e.target.value)} placeholder="Owner name" />
        </FormField>
        <FormField label="Agent Name">
          <input className="form-input" value={form.agentName} onChange={e => set('agentName', e.target.value)} placeholder="Insurance agent" />
        </FormField>
        <FormField label="Date of Insurance">
          <input type="date" className="form-input" value={form.dateOfInsurance} onChange={e => set('dateOfInsurance', e.target.value)} />
        </FormField>
        <FormField label="Pollution Date">
          <input type="date" className="form-input" value={form.pollutionDate} onChange={e => set('pollutionDate', e.target.value)} />
        </FormField>
      </div>

      {/* Documents */}
      <div className="form-section-header">
        <div className="form-section-icon"><FileText size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Vehicle Documents</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
        <FormField label="Copy of Insurance">
          <FileUpload value={form.copyOfInsurance} onChange={v => set('copyOfInsurance', v)} accept="image/*,.pdf" label="Upload Insurance Copy" id="ins-copy" />
        </FormField>
        <FormField label="Copy of Registration">
          <FileUpload value={form.copyOfRegistration} onChange={v => set('copyOfRegistration', v)} accept="image/*,.pdf" label="Upload RC Copy" id="reg-copy" />
        </FormField>
      </div>

      <div className="modal-footer" style={{ padding: '20px 0 0' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : isEdit ? 'Update Vehicle' : '+ Add Vehicle'}
        </button>
      </div>
    </form>
  );
};

const ViewCar = ({ car, insurance }) => {
  const ins = insurance.find(i => i.vehicleId === car.vehicleId);
  const fields = [
    ['Vehicle ID', car.vehicleId], ['Firm Name', car.firmName], ['Registration No.', car.registrationNo],
    ['Car Name', car.carName], ['Model No.', car.modelNo],
    ['Fuel Type', car.fuelType], ['Purchase Date', formatDate(car.dateOfPurchase)],
    ['Company Purchased From', car.companyPurchasedFrom], ['Chassis No.', car.chassisNo],
    ['Engine No.', car.engineNo], ['Hypothecation Bank', car.hypothecationBank],
    ['Last EMI Date', formatDate(car.lastEmiDate)], ['Release of Hypothecation', formatDate(car.dateOfReleaseHypothecation)],
    ['Value of Car', car.valueOfCar ? `₹${Number(car.valueOfCar).toLocaleString('en-IN')}` : '—'],
    ['EMI Amount', car.emiAmount ? `₹${Number(car.emiAmount).toLocaleString('en-IN')}` : '—'],
    ['Insurance Amount', car.insuranceAmount ? `₹${Number(car.insuranceAmount).toLocaleString('en-IN')}` : '—'],
    ['RTO Amount', car.rtoAmount ? `₹${Number(car.rtoAmount).toLocaleString('en-IN')}` : '—'],
    ['Company Mobile', car.companyMobileNo], ['Service Person', car.servicePersonName],
    ['Service Mobile', car.servicePersonMobileNo], ['Name of Company', car.nameOfCompany],
    ['Name of Owner', car.nameOfOwner], ['Agent Name', car.agentName],
    ['Date of Insurance', formatDate(car.dateOfInsurance)], ['Pollution Date', formatDate(car.pollutionDate)],
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <Badge label={ins ? 'Insurance Available' : 'Insurance Not Available'} variant={ins ? 'success' : 'warning'} />
        <Badge label={car.fuelType || '—'} variant="info" />
      </div>
      <div className="detail-grid">
        {fields.map(([label, value]) => (
          <div key={label} className="detail-item">
            <label>{label}</label>
            <div className="value">{value || '—'}</div>
          </div>
        ))}
      </div>
      {(() => {
        const insUrl = typeof car.copyOfInsurance === 'object' ? car.copyOfInsurance?.url : car.copyOfInsurance;
        const regUrl = typeof car.copyOfRegistration === 'object' ? car.copyOfRegistration?.url : car.copyOfRegistration;
        if (!insUrl && !regUrl) return null;
        return (
          <div style={{ marginTop: 20, borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
            <div className="form-section-header">
              <div className="form-section-icon"><FileText size={18} /></div>
              <div className="form-section-title">Documents</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {insUrl && (
                <button
                  type="button"
                  onClick={() => openDocument(insUrl, `${car.vehicleId}_Insurance_Copy`)}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  📄 Insurance Copy
                </button>
              )}
              {regUrl && (
                <button
                  type="button"
                  onClick={() => openDocument(regUrl, `${car.vehicleId}_RC_Copy`)}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  📄 RC Copy
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

const PurchaseCar = () => {
  const [cars, setCars] = useState([]);
  const [insurance, setInsurance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fuelFilter, setFuelFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'view'
  const [selected, setSelected] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, ins] = await Promise.all([getCars(), getInsurance()]);
    setCars(c);
    setInsurance(ins);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const unsub = onStoreUpdate(() => {
      load();
    });
    return unsub;
  }, [load]);

  const filtered = cars.filter(c => {
    const q = search.toLowerCase();
    const match = !q || c.carName?.toLowerCase().includes(q) || c.vehicleId?.toLowerCase().includes(q)
      || c.registrationNo?.toLowerCase().includes(q) || c.modelNo?.toLowerCase().includes(q)
      || c.firmName?.toLowerCase().includes(q);
    const fuel = !fuelFilter || c.fuelType === fuelFilter;
    return match && fuel;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCar(deleteDialog.vehicleId);
      toast.success('Vehicle deleted');
      setDeleteDialog(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.PURCHASE_CAR);

  const insuredIds = new Set(insurance.map(i => i.vehicleId));

  return (
    <div>
      {!canEdit && <ReadOnlyNotice moduleName="Purchase Car Records" />}

      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Car</h1>
          <p className="page-subtitle">{cars.length} vehicle{cars.length !== 1 ? 's' : ''} in fleet master database</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { setSelected(null); setModal('add'); }}>
            <Plus size={16} strokeWidth={2.5} /> Add New Car
          </button>
        )}
      </div>

      <div className="data-table-container">
        {/* Filter Bar */}
        <div className="filter-bar">
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input className="search-input" placeholder="Search vehicles by name, ID, reg no..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-select" style={{ width: 150 }} value={fuelFilter}
            onChange={e => { setFuelFilter(e.target.value); setPage(1); }}>
            <option value="">All Fuel Types</option>
            {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          {(search || fuelFilter) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFuelFilter(''); }}>
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
          ) : paged.length === 0 ? (
            <EmptyState icon={Car} title="No vehicles found"
              message="Add your first vehicle or adjust your search filters."
              action={canEdit ? <button className="btn btn-primary" onClick={() => setModal('add')}><Plus size={14} /> Add New Car</button> : null}
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
                  <th>Purchase Date</th>
                  <th>Value (₹)</th>
                  <th>Owner</th>
                  <th>Insurance</th>
                  <th>Insurance Date</th>
                  <th>Pollution Date</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(car => {
                  const hasIns = insuredIds.has(car.vehicleId);
                  return (
                    <tr key={car.vehicleId}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{car.vehicleId}</span></td>
                      <td><div style={{ fontWeight: 700, color: '#0f172a' }}>{car.carName}</div><div style={{ fontSize: 11.5, color: '#64748b' }}>{car.modelNo}</div></td>
                      <td><span style={{ fontWeight: 600, color: '#334155' }}>{car.firmName || '—'}</span></td>
                      <td><span style={{ fontWeight: 600 }}>{car.registrationNo}</span></td>
                      <td><Badge label={car.fuelType || '—'} variant="info" /></td>
                      <td>{formatDate(car.dateOfPurchase)}</td>
                      <td>{car.valueOfCar ? `₹${Number(car.valueOfCar).toLocaleString('en-IN')}` : '—'}</td>
                      <td>{car.nameOfOwner || '—'}</td>
                      <td><Badge label={hasIns ? 'Available' : 'Not Available'} variant={hasIns ? 'success' : 'warning'} /></td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{formatDate(car.dateOfInsurance)}</td>
                      <td>{formatDate(car.pollutionDate)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button className="btn btn-ghost btn-xs" title="View Details" onClick={() => { setSelected(car); setModal('view'); }}>
                            <Eye size={15} />
                          </button>
                          {canEdit && (
                            <>
                              <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => { setSelected(car); setModal('edit'); }}>
                                <Edit2 size={15} />
                              </button>
                              <button className="btn btn-ghost btn-xs" title="Delete" style={{ color: '#ef4444' }} onClick={() => setDeleteDialog(car)}>
                                <Trash2 size={15} />
                              </button>
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
        title={modal === 'edit' ? `Edit Vehicle — ${selected?.vehicleId}` : 'Add New Vehicle'}
        icon={Car} size="xl">
        <CarForm car={selected} cars={cars} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      </Modal>

      {/* View Modal */}
      <Modal isOpen={modal === 'view'} onClose={() => setModal(null)}
        title={`Vehicle Details — ${selected?.vehicleId}`} icon={Car} size="lg">
        {selected && <ViewCar car={selected} insurance={insurance} />}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog isOpen={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={handleDelete}
        loading={deleting} title="Delete Vehicle"
        message={`Are you sure you want to delete ${deleteDialog?.carName} (${deleteDialog?.vehicleId})? This action cannot be undone.`}
        confirmLabel="Delete Vehicle" confirmClass="btn btn-danger" />
    </div>
  );
};

export default PurchaseCar;
