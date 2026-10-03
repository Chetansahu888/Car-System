// pages/PurchaseCar.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Car, Plus, Search, Edit2, Trash2, Eye, X, Filter, CreditCard, User, UserCheck, UserPlus, Shield, ShieldCheck, FileText, CheckCircle, Lock, AlertTriangle, Clock, Calendar, Bell, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCars, addCar, updateCar, deleteCar, getInsurance, renewInsurance, syncEmiToSheet, getMasterFirmNames, getMasterEmployees, onStoreUpdate, checkHasEmi } from '../store/dataStore';
import { generateVehicleId, generateEmiNo, generateInsuranceId } from '../utils/idGenerator';
import { formatDate, today, calcInsuranceRenewal, calcEarliestCoverRenewal, toInputDate, calcEmiDetails } from '../utils/dateUtils';
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
  emiNo: '',
  firmName: '', carName: '', dateOfPurchase: '', modelNo: '', companyPurchasedFrom: '',
  fuelType: '', registrationNo: '', chassisNo: '', engineNo: '',
  hypothecationBank: '', loanAmount: '', emiStartDate: '', lastEmiDate: '', dateOfReleaseHypothecation: '',
  totalEmis: '', paidEmis: '', paidEmiAmount: '', remainingLoanAmount: '',
  valueOfCar: '', emiAmount: '', insuranceAmount: '', rtoAmount: '',
  companyMobileNo: '', servicePersonName: '', servicePersonMobileNo: '',
  copyOfInsurance: null, copyOfRegistration: null,
  nameOfCompany: '', nameOfOwner: '', agentName: '',
  dateOfInsurance: '', pollutionDate: '',
  vehicleAssignTo: '', employeeId: '', assigneeMobileNo: ''
};

const FORM_RULES = {
  carName: [required],
  dateOfPurchase: [required],
  registrationNo: [required],
  fuelType: [required],
};

const EMPTY_INSURANCE = {
  insuranceId: '',
  date: '',
  nameOfCompany: '',
  agentName: '',
  hasOwnDamage: 'Yes',
  odTenure: '1',
  odStartDate: '',
  odEndDate: '',
  hasThirdParty: 'Yes',
  tpTenure: '3',
  tpPolicyNo: '',
  tpStartDate: '',
  tpEndDate: '',
  tppdLimit: '750000',
  hasPaCover: 'Yes',
  paTenure: '1',
  paCoverType: 'Owner-Driver CPA (₹15 Lakhs)',
  paSumInsured: '1500000',
  paPremium: '',
  paStartDate: '',
  paEndDate: '',
  paNomineeName: '',
  paNomineeRelation: '',
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
  returnToInvoice: false,
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

const EmployeeCombobox = ({ value, employees = [], onChange, onEmployeeSelect }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [customList, setCustomList] = useState([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setIsAddingNew(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allEmployees = [...customList, ...employees];
  const cleanQ = (query || '').trim();
  const qLower = cleanQ.toLowerCase();

  const filtered = allEmployees.filter(emp => {
    if (!qLower) return true;
    return (emp.name && emp.name.toLowerCase().includes(qLower)) ||
           (emp.code && emp.code.toLowerCase().includes(qLower));
  });

  const hasExactMatch = allEmployees.some(emp => emp.name && emp.name.toLowerCase().trim() === qLower);
  const canQuickAdd = cleanQ.length > 0 && !hasExactMatch;

  const handleSelect = (emp) => {
    setQuery(emp.name);
    setOpen(false);
    setIsAddingNew(false);
    onEmployeeSelect(emp);
  };

  const handleQuickAddTyped = () => {
    if (!cleanQ) return;
    const newEmp = { name: cleanQ, code: '', isCustom: true };
    setCustomList(prev => [newEmp, ...prev.filter(p => p.name.toLowerCase() !== cleanQ.toLowerCase())]);
    setQuery(cleanQ);
    setOpen(false);
    setIsAddingNew(false);
    onEmployeeSelect(newEmp);
    toast.success(`Assigned to "${cleanQ}"`);
  };

  const handleSaveCustom = (e) => {
    e?.preventDefault?.();
    const trimmedName = (newName || cleanQ).trim();
    if (!trimmedName) {
      toast.error('Please enter name');
      return;
    }
    const newEmp = {
      name: trimmedName,
      code: '',
      isCustom: true
    };
    setCustomList(prev => [newEmp, ...prev.filter(p => p.name.toLowerCase() !== trimmedName.toLowerCase())]);
    setQuery(trimmedName);
    setIsAddingNew(false);
    setOpen(false);
    onEmployeeSelect(newEmp);
    setNewName('');
    toast.success(`Assigned to "${trimmedName}"`);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setOpen(true);
    const matched = allEmployees.find(emp => emp.name && emp.name.toLowerCase() === val.toLowerCase().trim());
    if (matched) {
      onEmployeeSelect(matched);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canQuickAdd) {
        handleQuickAddTyped();
      } else if (filtered.length > 0) {
        handleSelect(filtered[0]);
      }
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder="Search name or type custom name..."
          style={{ paddingRight: 62 }}
        />
        <div style={{ position: 'absolute', right: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                onChange('');
                onEmployeeSelect({ name: '', code: '' });
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: 3,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 4
              }}
              title="Clear"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#64748b',
              padding: 3,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4
            }}
            title="Toggle list"
          >
            <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: '#ffffff',
          border: '1.5px solid #cbd5e1',
          borderRadius: 12,
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.12)',
          maxHeight: 280,
          overflowY: 'auto',
          zIndex: 1000,
          padding: '8px'
        }}>
          {/* Top Add Option - Only Name, right at the top */}
          {isAddingNew ? (
            <div style={{
              background: '#f0fdf4',
              border: '1.5px solid #059669',
              borderRadius: 8,
              padding: '10px',
              marginBottom: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#065f46', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <UserPlus size={14} /> Add Name
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: 2 }}
                >
                  <X size={14} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="Enter Name *"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveCustom();
                    }
                  }}
                  className="form-input"
                  style={{ fontSize: 12, padding: '6px 10px', flex: 1 }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    border: 'none',
                    borderRadius: 6,
                    background: '#059669',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (cleanQ && !hasExactMatch) {
                  handleQuickAddTyped();
                } else {
                  setNewName(cleanQ);
                  setIsAddingNew(true);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                marginBottom: 8,
                borderRadius: 8,
                background: cleanQ && !hasExactMatch ? '#f0fdf4' : '#f8fafc',
                border: cleanQ && !hasExactMatch ? '1.5px dashed #86efac' : '1px dashed #cbd5e1',
                cursor: 'pointer',
                color: cleanQ && !hasExactMatch ? '#15803d' : '#334155',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#ecfdf5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = cleanQ && !hasExactMatch ? '#f0fdf4' : '#f8fafc'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={15} color="#059669" />
                <span style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                  {cleanQ && !hasExactMatch ? `+ Add "${cleanQ}"` : '+ Add New Name'}
                </span>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                background: '#059669',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: 5
              }}>
                + Add
              </span>
            </div>
          )}

          {/* Filtered Employees list */}
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
              No employees found
            </div>
          ) : (
            filtered.map((emp, i) => (
              <div
                key={`${emp.code || ''}_${emp.name}_${i}`}
                onClick={() => handleSelect(emp)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1e293b',
                  background: emp.name === value ? '#ecfdf5' : 'transparent',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={e => { e.currentTarget.style.background = emp.name === value ? '#ecfdf5' : 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={14} color={emp.isCustom ? '#0284c7' : '#059669'} />
                  <span>{emp.name}</span>
                  {emp.isCustom && (
                    <span style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                      Custom
                    </span>
                  )}
                </div>
                {emp.code ? (
                  <span style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: '#2563eb',
                    background: '#eff6ff',
                    padding: '2px 7px',
                    borderRadius: 5,
                    border: '1px solid #bfdbfe'
                  }}>
                    {emp.code}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const CarForm = ({ car, cars, onClose, onSaved }) => {
  const isEdit = !!car;
  const [form, setForm] = useState(isEdit ? { ...EMPTY_FORM, ...car } : { ...EMPTY_FORM });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [firmNames, setFirmNames] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [hasInsurance, setHasInsurance] = useState(false);
  const [insForm, setInsForm] = useState({ ...EMPTY_INSURANCE });
  const [hasEmi, setHasEmi] = useState(isEdit ? checkHasEmi(car) : false);

  useEffect(() => {
    if (isEdit && car) {
      setHasEmi(checkHasEmi(car));
    }
  }, [isEdit, car]);

  useEffect(() => {
    const fetchMasters = async () => {
      const [firms, emps] = await Promise.all([getMasterFirmNames(), getMasterEmployees()]);
      setFirmNames(firms);
      setEmployees(emps);
    };
    fetchMasters();

    const fetchExistingInsurance = async () => {
      if (isEdit && car?.vehicleId) {
        try {
          const allIns = await getInsurance();
          const existing = allIns.find(i => i.vehicleId === car.vehicleId);
          if (existing) {
            setHasInsurance(true);
            setInsForm({
              insuranceId: existing.insuranceId || '',
              date: existing.date || car?.dateOfInsurance || '',
              nameOfCompany: existing.nameOfCompany || car?.nameOfCompany || '',
              agentName: existing.agentName || car?.agentName || '',
              hasOwnDamage: existing.hasOwnDamage || (existing.basicPremium ? 'Yes' : 'No'),
              odStartDate: existing.odStartDate || existing.date || '',
              odEndDate: existing.odEndDate || '',
              hasThirdParty: existing.hasThirdParty || (existing.thirdPartyPremium ? 'Yes' : 'No'),
              tpPolicyNo: existing.tpPolicyNo || '',
              tpStartDate: existing.tpStartDate || existing.date || '',
              tpEndDate: existing.tpEndDate || '',
              tppdLimit: existing.tppdLimit || '750000',
              hasPaCover: existing.hasPaCover || (existing.paPremium ? 'Yes' : 'No'),
              paCoverType: existing.paCoverType || 'Owner-Driver CPA (₹15 Lakhs)',
              paSumInsured: existing.paSumInsured || '1500000',
              paPremium: existing.paPremium || '',
              paStartDate: existing.paStartDate || existing.date || '',
              paEndDate: existing.paEndDate || '',
              paNomineeName: existing.paNomineeName || '',
              paNomineeRelation: existing.paNomineeRelation || '',
              idvValue: existing.idvValue || '',
              totalPremiumToBePaid: existing.totalPremiumToBePaid || '',
              basicPremium: existing.basicPremium || '',
              thirdPartyPremium: existing.thirdPartyPremium || '',
              addOnPremium: existing.addOnPremium || '',
              taxAmount: existing.taxAmount || '',
              totalPremiumAmount: existing.totalPremiumAmount || '',
              premiumOfNcb: existing.premiumOfNcb || '',
              depreciationReimbursement: !!(existing.depreciationReimbursement || existing.zd),
              engineSecure: !!(existing.engineSecure || existing.ep),
              consumableExpenses: !!(existing.consumableExpenses || existing.cm),
              personalBelonging: !!(existing.personalBelonging || existing.pb),
              roadsideAssistance: !!(existing.roadsideAssistance || existing.rsa),
              keyReplacement: !!(existing.keyReplacement || existing.kp),
              returnToInvoice: !!(existing.returnToInvoice || existing.rti),
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

  const updateIns = (field, value) => {
    setInsForm(f => {
      const updated = { ...f, [field]: value };
      const isCalcField = [
        'basicPremium', 'addOnPremium', 'premiumOfNcb',
        'thirdPartyPremium', 'paPremium',
        'hasOwnDamage', 'hasThirdParty', 'hasPaCover'
      ].includes(field);

      if (isCalcField) {
        const od = updated.hasOwnDamage === 'Yes' ? (Number(updated.basicPremium) || 0) : 0;
        const addOn = updated.hasOwnDamage === 'Yes' ? (Number(updated.addOnPremium) || 0) : 0;
        const ncb = updated.hasOwnDamage === 'Yes' ? (Number(updated.premiumOfNcb) || 0) : 0;
        const tp = updated.hasThirdParty === 'Yes' ? (Number(updated.thirdPartyPremium) || 0) : 0;
        const pa = updated.hasPaCover === 'Yes' ? (Number(updated.paPremium) || 0) : 0;

        const net = Math.max(0, od + addOn - ncb) + tp + pa;
        if (net > 0) {
          const gst = Math.round(net * 0.18);
          const total = net + gst;
          updated.taxAmount = String(gst);
          updated.totalPremiumAmount = String(total);
          updated.totalPremiumToBePaid = String(total);
          set('insuranceAmount', String(total));
        } else {
          updated.taxAmount = '0';
          updated.totalPremiumAmount = '0';
          updated.totalPremiumToBePaid = '0';
          set('insuranceAmount', '0');
        }
      } else if (field === 'taxAmount') {
        const od = updated.hasOwnDamage === 'Yes' ? (Number(updated.basicPremium) || 0) : 0;
        const addOn = updated.hasOwnDamage === 'Yes' ? (Number(updated.addOnPremium) || 0) : 0;
        const ncb = updated.hasOwnDamage === 'Yes' ? (Number(updated.premiumOfNcb) || 0) : 0;
        const tp = updated.hasThirdParty === 'Yes' ? (Number(updated.thirdPartyPremium) || 0) : 0;
        const pa = updated.hasPaCover === 'Yes' ? (Number(updated.paPremium) || 0) : 0;
        const net = Math.max(0, od + addOn - ncb) + tp + pa;
        const gst = Number(value) || 0;
        const total = net + gst;
        updated.totalPremiumAmount = String(total);
        updated.totalPremiumToBePaid = String(total);
        set('insuranceAmount', String(total));
      } else if (field === 'totalPremiumAmount') {
        updated.totalPremiumToBePaid = value;
        set('insuranceAmount', value);
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
        if (!processedForm.emiNo) {
          processedForm.emiNo = form.emiNo || generateEmiNo(cars);
        }
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
        toast.success('Vehicle updated in Purchase Car Details');
      } else {
        finalVehicleId = generateVehicleId(cars);
        await addCar({ ...processedForm, vehicleId: finalVehicleId, createdAt: new Date().toISOString() });
        toast.success(`Vehicle ${finalVehicleId} saved to Purchase Car Details`);
      }

      if (hasEmi) {
        await syncEmiToSheet({ ...processedForm, vehicleId: finalVehicleId });
        toast.success(`EMI record (${processedForm.emiNo}) saved to EMI On Vehicle sheet`);
      }

      if (hasInsurance) {
        const allIns = await getInsurance();
        const existingIns = allIns.find(i => (finalVehicleId && i.vehicleId === finalVehicleId) || (insForm.insuranceId && i.insuranceId === insForm.insuranceId));
        const insuranceId = existingIns?.insuranceId || insForm.insuranceId || generateInsuranceId(allIns);
        const renewal = calcInsuranceRenewal(insForm.date, 1);
        const activeEnds = [];
        if (insForm.hasOwnDamage === 'Yes' && insForm.odEndDate) activeEnds.push(insForm.odEndDate);
        if (insForm.hasThirdParty === 'Yes' && insForm.tpEndDate) activeEnds.push(insForm.tpEndDate);
        if (insForm.hasPaCover === 'Yes' && insForm.paEndDate) activeEnds.push(insForm.paEndDate);
        const earliest = calcEarliestCoverRenewal(...activeEnds) || (renewal ? toInputDate(renewal) : '');
        await renewInsurance(finalVehicleId, {
          ...insForm,
          insuranceId,
          vehicleId: finalVehicleId,
          carName: processedForm.carName,
          copyOfInsurance: processedForm.copyOfInsurance,
          validityDate: earliest,
          renewalDate: earliest,
          timestamp: new Date().toISOString(),
        });
        toast.success(`Insurance record (${insuranceId}) saved to Insurance Of Vehicle sheet`);
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
      <LoadingOverlay isVisible={saving} message="Please Wait" />
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  padding: '5px 12px',
                  borderRadius: 8,
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1.5px solid #a7f3d0',
                  boxShadow: '0 1px 3px rgba(5, 150, 105, 0.1)'
                }}>
                  EMI No: {form.emiNo || generateEmiNo(cars)}
                </span>
                <Badge label="EMI Enabled" variant="success" />
              </div>
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

      {/* Vehicle Assign To */}
      <div className="form-section-header">
        <div className="form-section-icon"><UserCheck size={18} strokeWidth={2.2} /></div>
        <div className="form-section-title">Vehicle Assign To</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
        <FormField label="Vehicle Assign To">
          <EmployeeCombobox
            value={form.vehicleAssignTo}
            employees={employees}
            onChange={(name) => set('vehicleAssignTo', name)}
            onEmployeeSelect={(emp) => {
              set('vehicleAssignTo', emp.name || '');
              if (emp.code) {
                set('employeeId', emp.code);
              }
            }}
          />
        </FormField>
        <FormField label="Employee ID">
          <input
            className="form-input"
            value={form.employeeId}
            onChange={e => set('employeeId', e.target.value)}
            placeholder="e.g. PMMPL-1"
          />
        </FormField>
        <FormField label="Assignee Mobile No.">
          <input
            className="form-input"
            value={form.assigneeMobileNo}
            onChange={e => set('assigneeMobileNo', e.target.value)}
            placeholder="10-digit number"
          />
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
                    setInsForm(f => {
                      const updated = { ...f, date: val };
                      if (val) {
                        const odRen = calcInsuranceRenewal(val, 1);
                        const tpRen = calcInsuranceRenewal(val, f.tpTenure || 3);
                        const paRen = calcInsuranceRenewal(val, f.paTenure || 1);
                        if (!f.odStartDate) updated.odStartDate = val;
                        updated.odEndDate = odRen ? toInputDate(odRen) : updated.odEndDate;
                        if (!f.tpStartDate) updated.tpStartDate = val;
                        updated.tpEndDate = tpRen ? toInputDate(tpRen) : updated.tpEndDate;
                        if (!f.paStartDate) updated.paStartDate = val;
                        updated.paEndDate = paRen ? toInputDate(paRen) : updated.paEndDate;
                      }
                      return updated;
                    });
                    set('dateOfInsurance', val);
                  }}
                />
                {insRenewal && (
                  <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 4 }}>
                    ✓ Next Renewal: {formatDate(insRenewal)}
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

            {/* Coverage Selection Dropdowns */}
            <div className="form-section-header">
              <div className="form-section-icon"><ShieldCheck size={18} strokeWidth={2.2} /></div>
              <div className="form-section-title">Insurance Coverage Selection</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
              <FormField label="Own Damage / Self Accident">
                <select
                  className="form-select"
                  value={insForm.hasOwnDamage}
                  onChange={e => updateIns('hasOwnDamage', e.target.value)}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </FormField>

              <FormField label="Third Party (TP) Insurance">
                <select
                  className="form-select"
                  value={insForm.hasThirdParty}
                  onChange={e => updateIns('hasThirdParty', e.target.value)}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </FormField>

              <FormField label="Personal Accident (PA Cover)">
                <select
                  className="form-select"
                  value={insForm.hasPaCover}
                  onChange={e => updateIns('hasPaCover', e.target.value)}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </FormField>
            </div>

            {/* 1. Own Damage / Self Accident Form (When YES) */}
            {insForm.hasOwnDamage === 'Yes' && (
              <>
                <div className="form-section-header">
                  <div className="form-section-icon"><Car size={18} strokeWidth={2.2} /></div>
                  <div className="form-section-title">Own Damage / Self Accident Details</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
                  <FormField label="OD Policy Start Date">
                    <input
                      type="date"
                      className="form-input"
                      value={insForm.odStartDate || ''}
                      onChange={e => {
                        const sDate = e.target.value;
                        const ren = sDate ? calcInsuranceRenewal(sDate, 1) : null;
                        updateIns('odStartDate', sDate);
                        if (ren) updateIns('odEndDate', toInputDate(ren));
                      }}
                    />
                  </FormField>
                  <FormField label="OD Policy End Date">
                    <input
                      type="date"
                      className="form-input"
                      value={insForm.odEndDate || ''}
                      onChange={e => updateIns('odEndDate', e.target.value)}
                    />
                  </FormField>
                  <FormField label="IDV Value (₹)">
                    <input
                      type="number"
                      className="form-input"
                      value={insForm.idvValue}
                      onChange={e => updateIns('idvValue', e.target.value)}
                      placeholder="e.g. 1200000"
                    />
                  </FormField>
                  <FormField label="Own Damage / Basic Premium (₹)">
                    <input
                      type="number"
                      className="form-input"
                      value={insForm.basicPremium}
                      onChange={e => updateIns('basicPremium', e.target.value)}
                      placeholder="0"
                    />
                  </FormField>
                  <FormField label="Claimed Insurance Last Year?">
                    <select
                      className="form-select"
                      value={insForm.claimedLastYear}
                      onChange={e => updateIns('claimedLastYear', e.target.value)}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </FormField>
                  <FormField label="Policy Inclusive of NCB?">
                    <select
                      className="form-select"
                      value={insForm.policyInclusiveOfNcb}
                      onChange={e => updateIns('policyInclusiveOfNcb', e.target.value)}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </FormField>
                  <FormField label="NCB Discount Amount (₹)">
                    <input
                      type="number"
                      className="form-input"
                      value={insForm.premiumOfNcb}
                      onChange={e => updateIns('premiumOfNcb', e.target.value)}
                      placeholder="0"
                    />
                  </FormField>
                  <FormField label="Cashless Facility Available?">
                    <select
                      className="form-select"
                      value={insForm.cashlessPolicy}
                      onChange={e => updateIns('cashlessPolicy', e.target.value)}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </FormField>
                  <FormField label="Add-On Premium (₹)">
                    <input
                      type="number"
                      className="form-input"
                      value={insForm.addOnPremium}
                      onChange={e => updateIns('addOnPremium', e.target.value)}
                      placeholder="0"
                    />
                  </FormField>
                </div>

                {/* Add-on Covers */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 12 }}>
                    Add-On Covers Included
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: 12,
                    padding: '16px',
                    background: '#ffffff',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0'
                  }}>
                    {[
                      ['ZD (Zero Depreciation)', 'depreciationReimbursement'],
                      ['EP (Engine Protect)', 'engineSecure'],
                      ['CM (Consumable Expenses)', 'consumableExpenses'],
                      ['PB (Loss of Personal Belonging)', 'personalBelonging'],
                      ['KP (Key Protect)', 'keyReplacement'],
                      ['RTI (Return to Invoice)', 'returnToInvoice'],
                      ['Roadside Assistance (RSA)', 'roadsideAssistance'],
                      ['Emergency Transport & Hotel', 'emergencyTransportHotel'],
                    ].map(([label, field]) => (
                      <CheckField
                        key={field}
                        label={label}
                        checked={insForm[field]}
                        onChange={() => updateIns(field, !insForm[field])}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 2. Third Party Insurance Form (When YES) */}
            {insForm.hasThirdParty === 'Yes' && (
              <>
                <div className="form-section-header">
                  <div className="form-section-icon"><Shield size={18} strokeWidth={2.2} /></div>
                  <div className="form-section-title">Third Party (TP) Insurance Details</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
                  <FormField label="TP Policy Tenure" required>
                    <select
                      className="form-select"
                      value={insForm.tpTenure || '3'}
                      onChange={e => {
                        const tenure = e.target.value;
                        const sDate = insForm.tpStartDate || insForm.date;
                        const ren = sDate ? calcInsuranceRenewal(sDate, tenure) : null;
                        setInsForm(f => ({
                          ...f,
                          tpTenure: tenure,
                          tpEndDate: ren ? toInputDate(ren) : f.tpEndDate
                        }));
                      }}
                    >
                      <option value="3">3 Years</option>
                      <option value="1">1 Year</option>
                    </select>
                  </FormField>

                  <FormField label="TP Policy Start Date">
                    <input
                      type="date"
                      className="form-input"
                      value={insForm.tpStartDate || ''}
                      onChange={e => {
                        const sDate = e.target.value;
                        const ren = sDate ? calcInsuranceRenewal(sDate, insForm.tpTenure || 3) : null;
                        updateIns('tpStartDate', sDate);
                        if (ren) updateIns('tpEndDate', toInputDate(ren));
                      }}
                    />
                  </FormField>
                  <FormField label="TP Policy End Date">
                    <input
                      type="date"
                      className="form-input"
                      value={insForm.tpEndDate || ''}
                      onChange={e => updateIns('tpEndDate', e.target.value)}
                    />
                  </FormField>
                  <FormField label="3rd Party Premium (₹)">
                    <input
                      type="number"
                      className="form-input"
                      value={insForm.thirdPartyPremium}
                      onChange={e => updateIns('thirdPartyPremium', e.target.value)}
                      placeholder="0"
                    />
                  </FormField>
                  <FormField label="TP Policy / Certificate No.">
                    <input
                      className="form-input"
                      value={insForm.tpPolicyNo}
                      onChange={e => updateIns('tpPolicyNo', e.target.value)}
                      placeholder="Policy / Certificate number"
                    />
                  </FormField>
                  <FormField label="TPPD Coverage Limit (₹)">
                    <input
                      type="number"
                      className="form-input"
                      value={insForm.tppdLimit}
                      onChange={e => updateIns('tppdLimit', e.target.value)}
                      placeholder="750000"
                    />
                  </FormField>
                </div>
              </>
            )}

            {/* 3. Personal Accident Cover Form (When YES) */}
            {insForm.hasPaCover === 'Yes' && (
              <>
                <div className="form-section-header">
                  <div className="form-section-icon"><Clock size={18} strokeWidth={2.2} /></div>
                  <div className="form-section-title">Personal Accident (PA) Cover Details</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
                  <FormField label="PA Cover Type">
                    <select
                      className="form-select"
                      value={insForm.paCoverType}
                      onChange={e => updateIns('paCoverType', e.target.value)}
                    >
                      <option value="Owner-Driver CPA (₹15 Lakhs)">Owner-Driver CPA (₹15 Lakhs)</option>
                      <option value="Paid Driver Cover">Paid Driver Cover</option>
                      <option value="Unnamed Passenger Cover">Unnamed Passenger Cover</option>
                    </select>
                  </FormField>
                  <FormField label="PA Cover Tenure">
                    <select
                      className="form-select"
                      value={insForm.paTenure || '1'}
                      onChange={e => {
                        const tenure = e.target.value;
                        const sDate = insForm.paStartDate || insForm.date;
                        const ren = sDate ? calcInsuranceRenewal(sDate, tenure) : null;
                        setInsForm(f => ({
                          ...f,
                          paTenure: tenure,
                          paEndDate: ren ? toInputDate(ren) : f.paEndDate
                        }));
                      }}
                    >
                      <option value="1">1 Year</option>
                      <option value="3">3 Years</option>
                    </select>
                  </FormField>
                  <FormField label="PA Sum Insured (₹)">
                    <input
                      type="number"
                      className="form-input"
                      value={insForm.paSumInsured}
                      onChange={e => updateIns('paSumInsured', e.target.value)}
                      placeholder="1500000"
                    />
                  </FormField>
                  <FormField label="PA Premium (₹)">
                    <input
                      type="number"
                      className="form-input"
                      value={insForm.paPremium}
                      onChange={e => updateIns('paPremium', e.target.value)}
                      placeholder="0"
                    />
                  </FormField>
                  <FormField label="PA Start Date">
                    <input
                      type="date"
                      className="form-input"
                      value={insForm.paStartDate || ''}
                      onChange={e => {
                        const sDate = e.target.value;
                        const ren = sDate ? calcInsuranceRenewal(sDate, insForm.paTenure || 1) : null;
                        updateIns('paStartDate', sDate);
                        if (ren) updateIns('paEndDate', toInputDate(ren));
                      }}
                    />
                  </FormField>
                  <FormField label="PA End Date">
                    <input
                      type="date"
                      className="form-input"
                      value={insForm.paEndDate || ''}
                      onChange={e => updateIns('paEndDate', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Nominee Name">
                    <input
                      className="form-input"
                      value={insForm.paNomineeName}
                      onChange={e => updateIns('paNomineeName', e.target.value)}
                      placeholder="Full name of nominee"
                    />
                  </FormField>
                  <FormField label="Nominee Relationship">
                    <input
                      className="form-input"
                      value={insForm.paNomineeRelation}
                      onChange={e => updateIns('paNomineeRelation', e.target.value)}
                      placeholder="e.g. Spouse, Father, Mother"
                    />
                  </FormField>
                </div>
              </>
            )}

            {/* Overall Premium Summary & Tax */}
            <div className="form-section-header">
              <div className="form-section-icon"><CreditCard size={18} strokeWidth={2.2} /></div>
              <div className="form-section-title">Total Premium & Taxes Breakdown</div>
            </div>
            {(() => {
              const odNet = insForm.hasOwnDamage === 'Yes' ? Math.max(0, (Number(insForm.basicPremium) || 0) + (Number(insForm.addOnPremium) || 0) - (Number(insForm.premiumOfNcb) || 0)) : 0;
              const tpNet = insForm.hasThirdParty === 'Yes' ? (Number(insForm.thirdPartyPremium) || 0) : 0;
              const paNet = insForm.hasPaCover === 'Yes' ? (Number(insForm.paPremium) || 0) : 0;
              const netTotal = odNet + tpNet + paNet;

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                  <FormField label="Tax / GST (18%) Amount (₹)">
                    <input
                      type="number"
                      className="form-input"
                      value={insForm.taxAmount}
                      onChange={e => updateIns('taxAmount', e.target.value)}
                      placeholder="0"
                    />
                    {netTotal > 0 && (
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                        Auto: 18% GST on Net ₹{netTotal.toLocaleString('en-IN')}
                      </div>
                    )}
                  </FormField>
                  <FormField label="Total Premium Amount (₹)">
                    <input
                      type="number"
                      className="form-input"
                      value={insForm.totalPremiumAmount || insForm.totalPremiumToBePaid}
                      onChange={e => updateIns('totalPremiumAmount', e.target.value)}
                      placeholder="0"
                      style={{ fontWeight: 800, color: '#059669', fontSize: 16 }}
                    />
                    {netTotal > 0 && (
                      <div style={{ fontSize: 11.5, color: '#059669', fontWeight: 700, marginTop: 4 }}>
                        Net ₹{netTotal.toLocaleString('en-IN')} + GST ₹{(Number(insForm.taxAmount) || 0).toLocaleString('en-IN')}
                      </div>
                    )}
                  </FormField>
                </div>
              );
            })()}
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
    ['Vehicle Assign To', car.vehicleAssignTo], ['Employee ID', car.employeeId], ['Assignee Mobile', car.assigneeMobileNo],
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
      || c.firmName?.toLowerCase().includes(q)
      || c.vehicleAssignTo?.toLowerCase().includes(q) || c.employeeId?.toLowerCase().includes(q);
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
                  <th>Vehicle Assign To</th>
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
                      <td>
                        {car.vehicleAssignTo ? (
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <UserCheck size={13} color="#059669" /> {car.vehicleAssignTo}
                            </div>
                            {car.employeeId && (
                              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: 4, border: '1px solid #bfdbfe', display: 'inline-block', marginTop: 2 }}>
                                {car.employeeId}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>Unassigned</span>
                        )}
                      </td>
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
