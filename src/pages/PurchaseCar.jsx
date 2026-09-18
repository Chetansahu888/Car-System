// pages/PurchaseCar.jsx
import { useState, useEffect, useCallback } from 'react';
import { Car, Plus, Search, Edit2, Trash2, Eye, X, Filter, CreditCard, User, Shield, ShieldCheck, FileText, CheckCircle, Lock, AlertTriangle, Clock, Calendar, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCars, addCar, updateCar, deleteCar, getInsurance, renewInsurance, getMasterFirmNames, onStoreUpdate, checkHasEmi } from '../store/dataStore';
import { generateVehicleId } from '../utils/idGenerator';
import { formatDate, today, calcInsuranceRenewal, toInputDate, calcEmiDetails } from '../utils/dateUtils';
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
  hypothecationBank: '', loanAmount: '', emiStartDate: '', lastEmiDate: '', dateOfReleaseHypothecation: '',
  totalEmis: '', paidEmis: '', paidEmiAmount: '', remainingLoanAmount: '',
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

const EMPTY_INSURANCE = {
  date: today(),
  nameOfCompany: '',
  agentName: '',
  idvValue: '',
  totalPremiumToBePaid: '',
  basicPremium: '',
  thirdPartyPremium: '',
  addOnPremium: '',
  taxAmount: '',
  totalPremiumAmount: '',
  premiumOfNcb: '',
  depreciationReimbursement: false,
  engineSecure: false,
  consumableExpenses: false,
  personalBelonging: false,
  roadsideAssistance: false,
  keyReplacement: false,
  emergencyTransportHotel: false,
  claimedLastYear: 'No',
  policyInclusiveOfNcb: 'No',
  cashlessPolicy: 'Yes',
};

const CheckField = ({ label, checked, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5, color: '#334155', userSelect: 'none' }}>
    <div onClick={onChange} style={{
      width: 20, height: 20, borderRadius: 6, border: `2px solid ${checked ? '#059669' : '#cbd5e1'}`,
      background: checked ? '#059669' : '#ffffff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
    }}>
      {checked && <CheckCircle size={13} color="#ffffff" />}
    </div>
    {label}
  </label>
);

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
  const [hasInsurance, setHasInsurance] = useState(false);
  const [insForm, setInsForm] = useState({ ...EMPTY_INSURANCE });
  const [hasEmi, setHasEmi] = useState(isEdit ? checkHasEmi(car) : false);

  useEffect(() => {
    if (isEdit && car) {
      setHasEmi(checkHasEmi(car));
    }
  }, [isEdit, car]);

  useEffect(() => {
    const fetchFirms = async () => {
      const firms = await getMasterFirmNames();
      setFirmNames(firms);
    };
    fetchFirms();

    const fetchExistingInsurance = async () => {
      if (isEdit && car?.vehicleId) {
        try {
          const allIns = await getInsurance();
          const existing = allIns.find(i => i.vehicleId === car.vehicleId);
          if (existing) {
            setHasInsurance(true);
            setInsForm({
              date: existing.date || car?.dateOfInsurance || today(),
              nameOfCompany: existing.nameOfCompany || car?.nameOfCompany || '',
              agentName: existing.agentName || car?.agentName || '',
              idvValue: existing.idvValue || '',
              totalPremiumToBePaid: existing.totalPremiumToBePaid || '',
              basicPremium: existing.basicPremium || '',
              thirdPartyPremium: existing.thirdPartyPremium || '',
              addOnPremium: existing.addOnPremium || '',
              taxAmount: existing.taxAmount || '',
              totalPremiumAmount: existing.totalPremiumAmount || '',
              premiumOfNcb: existing.premiumOfNcb || '',
              depreciationReimbursement: !!existing.depreciationReimbursement,
              engineSecure: !!existing.engineSecure,
              consumableExpenses: !!existing.consumableExpenses,
              personalBelonging: !!existing.personalBelonging,
              roadsideAssistance: !!existing.roadsideAssistance,
              keyReplacement: !!existing.keyReplacement,
              emergencyTransportHotel: !!existing.emergencyTransportHotel,
              claimedLastYear: existing.claimedLastYear || 'No',
              policyInclusiveOfNcb: existing.policyInclusiveOfNcb || 'No',
              cashlessPolicy: existing.cashlessPolicy || 'Yes',
            });
          }
        } catch (err) {
          console.warn('Failed to load existing insurance', err);
        }
      }
    };
    fetchExistingInsurance();
  }, [isEdit, car]);

  const set = (field, value) => {
    setForm(f => {
      const updated = { ...f, [field]: value };
      if (field === 'paidEmis') {
        const count = Number(value);
        const emi = Number(f.emiAmount);
        if (!isNaN(count) && count >= 0 && !isNaN(emi) && emi > 0) {
          updated.paidEmiAmount = String(count * emi);
        }
      } else if (field === 'paidEmiAmount') {
        const amt = Number(value);
        const emi = Number(f.emiAmount);
        if (!isNaN(amt) && amt >= 0 && !isNaN(emi) && emi > 0) {
          updated.paidEmis = String(Math.round(amt / emi));
        }
      } else if (field === 'emiAmount') {
        const emi = Number(value);
        const count = Number(f.paidEmis);
        if (!isNaN(emi) && emi > 0 && !isNaN(count) && count > 0) {
          updated.paidEmiAmount = String(count * emi);
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm(form, FORM_RULES);
    if (hasInsurance) {
      if (!insForm.date) errs.insuranceDate = 'Insurance Date is required';
      if (!insForm.nameOfCompany?.trim()) errs.insuranceCompany = 'Name of the Company is required';
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const processedForm = { ...form };

      if (hasEmi) {
        processedForm.hasEmi = true;
        processedForm.emiStatus = 'Yes';
        const emiCalc = calcEmiDetails(processedForm);
        processedForm.paidEmiAmount = processedForm.paidEmiAmount || (emiCalc ? String(emiCalc.paidAmount) : '');
        processedForm.remainingLoanAmount = emiCalc ? String(emiCalc.remainingAmount) : '';
      } else {
        processedForm.hasEmi = false;
        processedForm.emiStatus = 'No';
        processedForm.hypothecationBank = '';
        processedForm.loanAmount = '';
        processedForm.emiAmount = '';
        processedForm.emiStartDate = '';
        processedForm.lastEmiDate = '';
        processedForm.dateOfReleaseHypothecation = '';
        processedForm.totalEmis = '';
        processedForm.paidEmis = '';
        processedForm.paidEmiAmount = '';
        processedForm.remainingLoanAmount = '';
      }

      if (hasInsurance) {
        processedForm.dateOfInsurance = insForm.date;
        processedForm.nameOfCompany = insForm.nameOfCompany || '';
        processedForm.agentName = insForm.agentName || form.agentName || '';
        if (insForm.totalPremiumAmount || insForm.totalPremiumToBePaid) {
          processedForm.insuranceAmount = insForm.totalPremiumAmount || insForm.totalPremiumToBePaid;
        }
      } else {
        processedForm.dateOfInsurance = '';
        processedForm.nameOfCompany = '';
        processedForm.agentName = '';
        processedForm.insuranceAmount = '';
      }

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

      let finalVehicleId = car?.vehicleId;
      if (isEdit) {
        await updateCar(car.vehicleId, { ...processedForm, updatedAt: new Date().toISOString() });
        toast.success('Vehicle updated successfully');
      } else {
        finalVehicleId = generateVehicleId(cars);
        await addCar({ ...processedForm, vehicleId: finalVehicleId, createdAt: new Date().toISOString() });
        toast.success(`Vehicle ${finalVehicleId} added successfully`);
      }

      if (hasInsurance) {
        const renewal = calcInsuranceRenewal(insForm.date);
        await renewInsurance(finalVehicleId, {
          ...insForm,
          vehicleId: finalVehicleId,
          carName: processedForm.carName,
          validityDate: renewal ? toInputDate(renewal) : '',
          renewalDate: renewal ? toInputDate(renewal) : '',
          timestamp: new Date().toISOString(),
        });
        toast.success('Insurance record saved successfully');
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <FormField label="Value of Car (₹)">
          <input type="number" className="form-input" value={form.valueOfCar} onChange={e => set('valueOfCar', e.target.value)} placeholder="0" />
        </FormField>
        <FormField label="RTO Amount (₹)">
          <input type="number" className="form-input" value={form.rtoAmount} onChange={e => set('rtoAmount', e.target.value)} placeholder="0" />
        </FormField>
        <FormField label="EMI on Vehicle">
          <select
            className="form-select"
            value={hasEmi ? 'Yes' : 'No'}
            onChange={e => setHasEmi(e.target.value === 'Yes')}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </FormField>
      </div>

      {/* EMI Form Section (When YES) */}
      {hasEmi && (() => {
        const liveEmi = calcEmiDetails(form);
        const hasEmiCalcData = form.loanAmount || form.emiAmount || form.totalEmis || form.paidEmis || form.lastEmiDate;

        return (
          <div style={{
            background: '#f8fafc',
            border: '1.5px solid #cbd5e1',
            borderRadius: 16,
            padding: '24px',
            marginBottom: 28,
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#059669', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Vehicle EMI & Loan Details</h4>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Calculate loan amount, monthly installment, remaining balance & due reminders.</div>
                </div>
              </div>
              <Badge label="EMI Enabled" variant="success" />
            </div>

            {/* Live Calculation & Payment Reminder Box */}
            {hasEmiCalcData && (
              <div style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
                borderRadius: 14,
                padding: '16px 20px',
                color: '#ffffff',
                marginBottom: 20,
                boxShadow: '0 6px 18px rgba(6, 78, 59, 0.25)'
              }}>
                {/* Due Date & Reminder ribbon */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.2)', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bell size={18} color="#ffffff" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next EMI Pay Date</div>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>
                        {liveEmi.nextEmiDate ? formatDate(liveEmi.nextEmiDate) : (form.lastEmiDate ? formatDate(form.lastEmiDate) : '—')}
                      </div>
                    </div>
                  </div>
                  <div>
                    {liveEmi.isCompleted ? (
                      <span style={{ background: '#d1fae5', color: '#065f46', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
                        ✓ Loan Completed
                      </span>
                    ) : liveEmi.isOverdue ? (
                      <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
                        ⚠️ Overdue by {Math.abs(liveEmi.daysUntilNextEmi)} days
                      </span>
                    ) : liveEmi.isDueSoon ? (
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
                        🔔 Payment Due in {liveEmi.daysUntilNextEmi} day{liveEmi.daysUntilNextEmi === 1 ? '' : 's'}!
                      </span>
                    ) : liveEmi.nextEmiDate ? (
                      <span style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                        Due in {liveEmi.daysUntilNextEmi} days
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* 4 Summary Metric Boxes */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 12 }}>
                  <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 600 }}>Loan Amount (लोन था)</div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                      {liveEmi.loanAmount > 0 ? `₹${liveEmi.loanAmount.toLocaleString('en-IN')}` : '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 600 }}>Monthly EMI (देना है)</div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                      {liveEmi.emiAmount > 0 ? `₹${liveEmi.emiAmount.toLocaleString('en-IN')}` : '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 600 }}>Paid So Far (दे दिया)</div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                      {liveEmi.paidAmount > 0 ? `₹${liveEmi.paidAmount.toLocaleString('en-IN')}` : '₹0'}
                    </div>
                    <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 1 }}>{liveEmi.paidEmis} EMIs paid</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 600 }}>Balance Left (बाकी है)</div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: liveEmi.remainingAmount > 0 ? '#fde047' : '#86efac' }}>
                      {liveEmi.remainingAmount > 0 ? `₹${liveEmi.remainingAmount.toLocaleString('en-IN')}` : (liveEmi.isCompleted ? '₹0' : '—')}
                    </div>
                    <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 1 }}>{liveEmi.remainingEmis} EMIs left</div>
                  </div>
                </div>
              </div>
            )}

            {/* Input fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              <FormField label="Hypothecation Bank">
                <input className="form-input" value={form.hypothecationBank} onChange={e => set('hypothecationBank', e.target.value)} placeholder="Bank name (e.g. HDFC Bank, SBI)" />
              </FormField>
              <FormField label="Total Loan Amount (₹)">
                <input type="number" className="form-input" value={form.loanAmount} onChange={e => set('loanAmount', e.target.value)} placeholder="e.g. 800000" />
              </FormField>
              <FormField label="Monthly EMI Amount (₹)">
                <input type="number" className="form-input" value={form.emiAmount} onChange={e => set('emiAmount', e.target.value)} placeholder="e.g. 18500" />
              </FormField>
              <FormField label="EMI Start Date">
                <input type="date" className="form-input" value={form.emiStartDate} onChange={e => set('emiStartDate', e.target.value)} />
              </FormField>
              <FormField label="Last EMI Date">
                <input type="date" className="form-input" value={form.lastEmiDate} onChange={e => set('lastEmiDate', e.target.value)} />
              </FormField>
              <FormField label="Date of Release of Hypothecation">
                <input type="date" className="form-input" value={form.dateOfReleaseHypothecation} onChange={e => set('dateOfReleaseHypothecation', e.target.value)} />
              </FormField>
              <FormField label="Total Tenure (Months / Total EMIs)">
                <input type="number" className="form-input" value={form.totalEmis} onChange={e => set('totalEmis', e.target.value)} placeholder="e.g. 36 or 48" />
              </FormField>
              <FormField label="EMIs Paid So Far (Count)">
                <input type="number" className="form-input" value={form.paidEmis} onChange={e => set('paidEmis', e.target.value)} placeholder="e.g. 12" />
              </FormField>
              <FormField label="Amount Paid So Far (₹) (अब तक पे किया)">
                <input
                  type="number"
                  className="form-input"
                  value={form.paidEmiAmount !== undefined && form.paidEmiAmount !== '' ? form.paidEmiAmount : (liveEmi.paidAmount > 0 ? liveEmi.paidAmount : '')}
                  onChange={e => set('paidEmiAmount', e.target.value)}
                  placeholder="0"
                />
              </FormField>
              <FormField label="Remaining Balance to Pay (₹) (बाकी है)">
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    readOnly
                    value={liveEmi.remainingAmount > 0 ? `₹${liveEmi.remainingAmount.toLocaleString('en-IN')}` : (liveEmi.isCompleted ? '₹0 (Fully Paid)' : '—')}
                    style={{
                      background: '#f8fafc',
                      fontWeight: 800,
                      color: liveEmi.remainingAmount > 0 ? '#b45309' : '#059669',
                      cursor: 'default',
                      paddingRight: 84
                    }}
                  />
                  {liveEmi.remainingEmis > 0 && (
                    <span style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748b'
                    }}>
                      {liveEmi.remainingEmis} EMIs left
                    </span>
                  )}
                </div>
              </FormField>
            </div>
          </div>
        );
      })()}

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
        <FormField label="Name of the Owner">
          <input className="form-input" value={form.nameOfOwner} onChange={e => set('nameOfOwner', e.target.value)} placeholder="Owner name" />
        </FormField>
        <FormField label="Pollution Date">
          <input type="date" className="form-input" value={form.pollutionDate} onChange={e => set('pollutionDate', e.target.value)} />
        </FormField>
        <FormField label="Insurance of Vehicle">
          <select
            className="form-select"
            value={hasInsurance ? 'Yes' : 'No'}
            onChange={e => setHasInsurance(e.target.value === 'Yes')}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </FormField>
      </div>

      {/* Insurance Form Section (When YES) */}
      {hasInsurance && (() => {
        const insRenewal = insForm.date ? calcInsuranceRenewal(insForm.date) : null;
        return (
          <div style={{
            background: '#f8fafc',
            border: '1.5px solid #cbd5e1',
            borderRadius: 16,
            padding: '24px',
            marginBottom: 28,
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#059669', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Insurance Policy & Coverage Details</h4>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Insurance module form fields — fills directly into Insurance database.</div>
                </div>
              </div>
              <Badge label="Insurance Linked" variant="success" />
            </div>

            {/* Insurance Core Fields: Company, Date, Agent Name */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
              <FormField label="Name of the Company" required error={errors.insuranceCompany}>
                <input
                  className={`form-input ${errors.insuranceCompany ? 'error' : ''}`}
                  value={insForm.nameOfCompany}
                  onChange={e => {
                    const val = e.target.value;
                    setInsForm(f => ({ ...f, nameOfCompany: val }));
                    set('nameOfCompany', val);
                  }}
                  placeholder="e.g. New India Assurance, HDFC ERGO"
                />
              </FormField>

              <FormField label="Date of Insurance" required error={errors.insuranceDate}>
                <input
                  type="date"
                  className={`form-input ${errors.insuranceDate ? 'error' : ''}`}
                  value={insForm.date}
                  onChange={e => {
                    const val = e.target.value;
                    setInsForm(f => ({ ...f, date: val }));
                    set('dateOfInsurance', val);
                  }}
                />
                {insRenewal && (
                  <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 4 }}>
                    ✓ Next Renewal: {formatDate(insRenewal)} (1 year − 1 day)
                  </div>
                )}
              </FormField>

              <FormField label="Agent Name">
                <input
                  className="form-input"
                  value={insForm.agentName !== undefined ? insForm.agentName : form.agentName}
                  onChange={e => {
                    const val = e.target.value;
                    set('agentName', val);
                    setInsForm(f => ({ ...f, agentName: val }));
                  }}
                  placeholder="Insurance agent name"
                />
              </FormField>
            </div>

            {/* Premium Breakdown */}
            <div className="form-section-header" style={{ marginBottom: 14 }}>
              <div className="form-section-icon"><CreditCard size={18} strokeWidth={2.2} /></div>
              <div className="form-section-title">Premium Breakdown</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                ['IDV Value (₹)', 'idvValue'],
                ['Total Premium (₹)', 'totalPremiumToBePaid'],
                ['Basic Premium (₹)', 'basicPremium'],
                ['3rd Party Premium (₹)', 'thirdPartyPremium'],
                ['Add-On Premium (₹)', 'addOnPremium'],
                ['Tax Amount (₹)', 'taxAmount'],
                ['Total Premium Amount (₹)', 'totalPremiumAmount'],
                ['NCB Premium (₹)', 'premiumOfNcb']
              ].map(([label, field]) => (
                <FormField key={field} label={label}>
                  <input
                    type="number"
                    className="form-input"
                    value={insForm[field]}
                    onChange={e => {
                      const val = e.target.value;
                      setInsForm(f => ({ ...f, [field]: val }));
                      if (field === 'totalPremiumAmount' || field === 'totalPremiumToBePaid') {
                        set('insuranceAmount', val);
                      }
                    }}
                    placeholder="0"
                  />
                </FormField>
              ))}
            </div>

            {/* Add-On Covers Included */}
            <div className="form-section-header" style={{ marginBottom: 14 }}>
              <div className="form-section-icon"><ShieldCheck size={18} strokeWidth={2.2} /></div>
              <div className="form-section-title">Add-On Covers Included</div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 14,
              marginBottom: 24,
              padding: '16px',
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0'
            }}>
              {[
                ['Depreciation Reimbursement', 'depreciationReimbursement'],
                ['Engine Secure', 'engineSecure'],
                ['Consumable Expenses', 'consumableExpenses'],
                ['Loss of Personal Belonging', 'personalBelonging'],
                ['Roadside Assistance', 'roadsideAssistance'],
                ['Key Replacement', 'keyReplacement'],
                ['Emergency Transport & Hotel', 'emergencyTransportHotel'],
              ].map(([label, field]) => (
                <CheckField
                  key={field}
                  label={label}
                  checked={insForm[field]}
                  onChange={() => setInsForm(f => ({ ...f, [field]: !f[field] }))}
                />
              ))}
            </div>

            {/* Policy Terms & NCB */}
            <div className="form-section-header" style={{ marginBottom: 14 }}>
              <div className="form-section-icon"><Shield size={18} strokeWidth={2.2} /></div>
              <div className="form-section-title">Policy Terms & NCB</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {[
                ['Claimed Insurance Last Year?', 'claimedLastYear'],
                ['Policy Inclusive of NCB?', 'policyInclusiveOfNcb'],
                ['Cashless Policy?', 'cashlessPolicy'],
              ].map(([label, field]) => (
                <FormField key={field} label={label}>
                  <select
                    className="form-select"
                    value={insForm[field]}
                    onChange={e => setInsForm(f => ({ ...f, [field]: e.target.value }))}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </FormField>
              ))}
            </div>
          </div>
        );
      })()}

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

const EmiDetailsModal = ({ car, onClose }) => {
  if (!car) return null;

  const emi = calcEmiDetails(car);
  const formattedLoan = emi.loanAmount > 0 ? `₹${emi.loanAmount.toLocaleString('en-IN')}` : '—';
  const formattedEmi = emi.emiAmount > 0 ? `₹${emi.emiAmount.toLocaleString('en-IN')}` : (car.emiAmount || '—');
  const formattedPaid = emi.paidAmount > 0 ? `₹${emi.paidAmount.toLocaleString('en-IN')}` : '₹0';
  const formattedRemaining = emi.remainingAmount > 0 ? `₹${emi.remainingAmount.toLocaleString('en-IN')}` : (emi.isCompleted ? '₹0' : '—');

  const rawVal = car.valueOfCar ? String(car.valueOfCar).replace(/[^0-9.-]+/g, '') : '';
  const numVal = Number(rawVal);
  const formattedCarVal = !isNaN(numVal) && numVal > 0 ? `₹${numVal.toLocaleString('en-IN')}` : (car.valueOfCar || '—');

  const pctPaid = emi.loanAmount > 0 ? Math.min(100, Math.round((emi.paidAmount / emi.loanAmount) * 100)) : 0;

  return (
    <div>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #065f46 0%, #059669 100%)',
        borderRadius: 16,
        padding: '20px 24px',
        color: '#ffffff',
        marginBottom: 20,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 10px 25px -5px rgba(5, 150, 105, 0.3)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '2px 8px',
              borderRadius: 6,
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.5px'
            }}>
              {car.vehicleId}
            </span>
            <span style={{
              background: emi.isCompleted ? '#fef3c7' : '#d1fae5',
              color: emi.isCompleted ? '#92400e' : '#065f46',
              padding: '2px 10px',
              borderRadius: 12,
              fontSize: 11.5,
              fontWeight: 700
            }}>
              {emi.isCompleted ? '✓ EMI Completed' : '● Active EMI'}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#ffffff' }}>{car.carName}</h3>
          <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: 13 }}>
            {car.registrationNo} {car.modelNo ? `• ${car.modelNo}` : ''} {car.firmName ? `• ${car.firmName}` : ''}
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11.5, opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Monthly EMI Amount (देना है)
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 2, letterSpacing: '-0.5px' }}>
            {formattedEmi}
          </div>
        </div>
      </div>

      {/* Next EMI Due Date & Payment Reminder Ribbon */}
      <div style={{
        background: emi.isCompleted
          ? '#ecfdf5'
          : emi.isOverdue
            ? '#fef2f2'
            : emi.isDueSoon
              ? '#fffbeb'
              : '#f0fdf4',
        border: `1.5px solid ${emi.isCompleted ? '#a7f3d0' : emi.isOverdue ? '#fca5a5' : emi.isDueSoon ? '#fde68a' : '#bbf7d0'}`,
        borderRadius: 14,
        padding: '14px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: emi.isCompleted ? '#059669' : emi.isOverdue ? '#dc2626' : emi.isDueSoon ? '#d97706' : '#16a34a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Bell size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569' }}>
              Next EMI Due Date (अगली EMI तारीख)
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 1 }}>
              {emi.nextEmiDate ? formatDate(emi.nextEmiDate) : (car.lastEmiDate ? formatDate(car.lastEmiDate) : '—')}
            </div>
          </div>
        </div>

        <div>
          {emi.isCompleted ? (
            <Badge label="✓ EMI Fully Repaid" variant="success" />
          ) : emi.isOverdue ? (
            <Badge label={`⚠️ Overdue by ${Math.abs(emi.daysUntilNextEmi)} Days`} variant="danger" />
          ) : emi.isDueSoon ? (
            <Badge label={`🔔 Payment Due in ${emi.daysUntilNextEmi} Days!`} variant="warning" />
          ) : emi.nextEmiDate ? (
            <Badge label={`Upcoming in ${emi.daysUntilNextEmi} Days`} variant="info" />
          ) : null}
        </div>
      </div>

      {/* 4 Financial Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14,
        marginBottom: 20
      }}>
        <div style={{
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          borderRadius: 14,
          padding: '14px 16px'
        }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Total Loan Amount (लोन राशि)
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
            {formattedLoan}
          </div>
        </div>

        <div style={{
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          borderRadius: 14,
          padding: '14px 16px'
        }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Monthly EMI (किस्त देना है)
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>
            {formattedEmi}
          </div>
        </div>

        <div style={{
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          borderRadius: 14,
          padding: '14px 16px'
        }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Paid So Far (दे दिया)
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
            {formattedPaid}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 600 }}>
            {emi.paidEmis} of {emi.totalEmis || '?'} EMIs paid
          </div>
        </div>

        <div style={{
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          borderRadius: 14,
          padding: '14px 16px'
        }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Balance Remaining (बाकी है)
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: emi.remainingAmount > 0 ? '#b45309' : '#059669' }}>
            {formattedRemaining}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 600 }}>
            {emi.remainingEmis} EMIs remaining
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {emi.loanAmount > 0 && (
        <div style={{
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          borderRadius: 14,
          padding: '14px 18px',
          marginBottom: 22
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>Loan Repayment Progress</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>
              {pctPaid}% Paid
            </span>
          </div>
          <div style={{ height: 9, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pctPaid}%`,
              background: 'linear-gradient(90deg, #10b981, #059669)',
              borderRadius: 6,
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>
      )}

      {/* Additional Details */}
      <div className="form-section-header" style={{ marginBottom: 14 }}>
        <div className="form-section-icon"><CreditCard size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Loan & Bank Breakdown</div>
      </div>

      <div className="detail-grid" style={{ marginBottom: 24 }}>
        <div className="detail-item">
          <label>Hypothecation Bank</label>
          <div className="value">{car.hypothecationBank || '—'}</div>
        </div>
        <div className="detail-item">
          <label>EMI Start Date</label>
          <div className="value">{formatDate(car.emiStartDate)}</div>
        </div>
        <div className="detail-item">
          <label>Last EMI Date</label>
          <div className="value">{formatDate(car.lastEmiDate)}</div>
        </div>
        <div className="detail-item">
          <label>Release of Hypothecation</label>
          <div className="value">{formatDate(car.dateOfReleaseHypothecation)}</div>
        </div>
        <div className="detail-item">
          <label>Total Tenure</label>
          <div className="value">{emi.totalEmis ? `${emi.totalEmis} Months` : '—'}</div>
        </div>
        <div className="detail-item">
          <label>Total Value of Car</label>
          <div className="value">{formattedCarVal}</div>
        </div>
        <div className="detail-item">
          <label>Date of Purchase</label>
          <div className="value">{formatDate(car.dateOfPurchase)}</div>
        </div>
        <div className="detail-item">
          <label>Company Purchased From</label>
          <div className="value">{car.companyPurchasedFrom || '—'}</div>
        </div>
        <div className="detail-item">
          <label>Firm / Company Name</label>
          <div className="value">{car.firmName || car.nameOfCompany || '—'}</div>
        </div>
        <div className="detail-item">
          <label>Owner Name</label>
          <div className="value">{car.nameOfOwner || '—'}</div>
        </div>
      </div>

      {/* Modal Actions */}
      <div className="modal-footer" style={{ padding: '16px 0 0', margin: 0, background: 'transparent' }}>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
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
  const [emiModalCar, setEmiModalCar] = useState(null);
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
                  <th style={{ textAlign: 'center' }}>EMI</th>
                  <th>Insurance</th>
                  <th>Insurance Date</th>
                  <th>Pollution Date</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(car => {
                  const hasIns = insuredIds.has(car.vehicleId);
                  const hasEmi = checkHasEmi(car);
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
                      <td style={{ textAlign: 'center' }}>
                        {hasEmi ? (() => {
                          const emiData = calcEmiDetails(car);
                          return (
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                title={`View EMI Details${emiData?.isDueSoon ? ` (Due in ${emiData.daysUntilNextEmi}d)` : emiData?.isOverdue ? ' (Overdue!)' : ''}`}
                                onClick={() => setEmiModalCar(car)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  background: emiData?.isDueSoon ? '#fef3c7' : emiData?.isOverdue ? '#fee2e2' : '#ecfdf5',
                                  color: emiData?.isDueSoon ? '#d97706' : emiData?.isOverdue ? '#dc2626' : '#059669',
                                  border: `1.5px solid ${emiData?.isDueSoon ? '#fde68a' : emiData?.isOverdue ? '#fca5a5' : '#a7f3d0'}`,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  margin: '0 auto'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = emiData?.isDueSoon ? '#d97706' : emiData?.isOverdue ? '#dc2626' : '#059669';
                                  e.currentTarget.style.color = '#ffffff';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = emiData?.isDueSoon ? '#fef3c7' : emiData?.isOverdue ? '#fee2e2' : '#ecfdf5';
                                  e.currentTarget.style.color = emiData?.isDueSoon ? '#d97706' : emiData?.isOverdue ? '#dc2626' : '#059669';
                                }}
                              >
                                <Eye size={16} strokeWidth={2.4} />
                              </button>
                              {emiData?.isDueSoon && (
                                <span
                                  title={`EMI Payment Due in ${emiData.daysUntilNextEmi} days!`}
                                  style={{
                                    position: 'absolute',
                                    top: -4,
                                    right: -4,
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    background: '#f59e0b',
                                    border: '2px solid #ffffff',
                                    boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.4)'
                                  }}
                                />
                              )}
                              {emiData?.isOverdue && (
                                <span
                                  title="EMI Payment Overdue!"
                                  style={{
                                    position: 'absolute',
                                    top: -4,
                                    right: -4,
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    background: '#ef4444',
                                    border: '2px solid #ffffff',
                                    boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.4)'
                                  }}
                                />
                              )}
                            </div>
                          );
                        })() : (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#64748b',
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              letterSpacing: '0.5px'
                            }}
                          >
                            NO
                          </span>
                        )}
                      </td>
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

      {/* EMI Details Modal */}
      <Modal
        isOpen={!!emiModalCar}
        onClose={() => setEmiModalCar(null)}
        title={`EMI Details — ${emiModalCar?.vehicleId || ''}`}
        icon={CreditCard}
        size="md"
      >
        {emiModalCar && (
          <EmiDetailsModal
            car={emiModalCar}
            onClose={() => setEmiModalCar(null)}
          />
        )}
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
