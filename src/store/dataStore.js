// store/dataStore.js
// Dual-layer data store: Synchronous local state + background sync to connected Google Sheets API.

import { getScriptUrl, fetchFromSheet, sendToSheet } from '../api/googleSheetsClient';
import { createTimestamp, today, calculateExpectedSettlementDate, calcEmiDetails } from '../utils/dateUtils';
import { generateClaimNo, generateId, generateEmiNo, generateInsuranceId, generateRenewalId } from '../utils/idGenerator';

const KEYS = {
  CARS: 'cms_cars',
  INSURANCE: 'cms_insurance',
  REPAIRS: 'cms_repairs',
  CLAIMS: 'cms_claims',
  VENDOR_OFFERS: 'cms_vendor_offers',
  DELIVERY_PLANNING: 'cms_delivery_planning',
  DELIVERIES: 'cms_deliveries',
  PAYMENTS: 'cms_payments',
  CHALLANS: 'cms_challans',
  FASTAGS: 'cms_fastags',
  USERS: 'cms_users',
  RENEWALS: 'cms_insurance_renewals',
};

export const PAGE_STEPS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'purchase_car', label: 'Purchase Car' },
  { key: 'vehicle_emi', label: 'Vehicle on EMI' },
  { key: 'challans', label: 'Challan' },
  { key: 'fastag', label: 'Fastag' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'car_repair', label: 'Car Repair' },
  { key: 'accident_claims', label: 'Accident / Claims' },
  { key: 'vendor_offers', label: 'Vendor Offers' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'delivery', label: 'Delivery Of Car' },
  { key: 'payment', label: 'Payment' },
];

const notifyStoreUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cms_datastore_updated'));
  }
};

export const onStoreUpdate = (callback) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('cms_datastore_updated', callback);
  return () => window.removeEventListener('cms_datastore_updated', callback);
};

const load = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const save = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
  notifyStoreUpdate();
};

// ─── MAPPER FOR "Login Page" SHEET ──────────────────────────────────────────
export const mapUserToSheet = (user) => {
  const permissions = user.permissions || {};

  const formatLevel = (key) => {
    if (user.role === 'admin') return 'Full';
    const level = permissions[key];
    if (level === 'full') return 'Full';
    if (level === 'view') return 'View';
    return 'None';
  };

  return {
    "Timestamp": user.createdAt || user.timestamp || createTimestamp(),
    "Name": user.name || '',
    "User": user.email || '',
    "Password": user.password || '',
    "Role": user.role === 'admin' ? 'Admin' : 'User',
    "Department": user.department || 'Operations',
    "Dashboard": formatLevel('dashboard'),
    "Purchase Car": formatLevel('purchase_car'),
    "Vehicle on EMI": formatLevel('vehicle_emi'),
    "Challan": formatLevel('challans'),
    "Fastag": formatLevel('fastag'),
    "Insurance": formatLevel('insurance'),
    "Car Repair": formatLevel('car_repair'),
    "Accident / Claims": formatLevel('accident_claims'),
    "Vendor Offers": formatLevel('vendor_offers'),
    "Approvals": formatLevel('approvals'),
    "Delivery Of Car": formatLevel('delivery'),
    "Payment": formatLevel('payment'),
  };
};

export const mapSheetRowToUser = (row, index) => {
  if (!row || typeof row !== 'object') return null;

  const get = (...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
      const target = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [rk, rv] of Object.entries(row)) {
        if (rk.toLowerCase().replace(/[^a-z0-9]/g, '') === target && rv !== undefined && rv !== null && String(rv).trim() !== '') {
          return String(rv).trim();
        }
      }
    }
    return '';
  };

  const email = get('User', 'User / Email', 'Email', 'Username', 'user', 'email');
  const name = get('Name', 'Full Name', 'name') || (email ? email.split('@')[0] : `User ${index + 1}`);
  const password = get('Password', 'Pass', 'password');

  if (!email && !password) return null;
  const cleanEmail = email.toLowerCase();
  if (cleanEmail === 'user' || cleanEmail === 'email' || name.toLowerCase() === 'name' || cleanEmail.includes('timestamp')) {
    return null;
  }

  const rawRole = get('Role', 'role').toLowerCase();
  const isAdmin = rawRole === 'admin' || rawRole === 'super admin' || cleanEmail === 'admin@passary.com';
  const role = isAdmin ? 'admin' : 'user';
  const department = get('Department', 'department') || (isAdmin ? 'Management' : 'Operations');

  const permissions = {};
  const accessibleStepsStr = get('Accessible Steps', 'Allowed Steps', 'Access Steps', 'Steps', 'Access').toLowerCase();

  PAGE_STEPS.forEach(p => {
    const colVal = get(p.label, p.key, p.label.replace(/\s+/g, '')).toLowerCase();

    if (isAdmin) {
      permissions[p.key] = 'full';
    } else if (colVal) {
      if (['full', 'yes', 'y', '1', 'true', 'write', 'edit', 'all'].includes(colVal)) {
        permissions[p.key] = 'full';
      } else if (['view', 'read', 'v'].includes(colVal)) {
        permissions[p.key] = 'view';
      } else if (['none', 'no', 'n', '0', 'false'].includes(colVal)) {
        permissions[p.key] = 'none';
      } else {
        permissions[p.key] = 'view';
      }
    } else if (accessibleStepsStr) {
      const stepName = p.label.toLowerCase();
      const stepKey = p.key.toLowerCase();
      if (accessibleStepsStr.includes(stepName) || accessibleStepsStr.includes(stepKey)) {
        permissions[p.key] = 'full';
      } else {
        permissions[p.key] = 'none';
      }
    } else {
      permissions[p.key] = 'view';
    }
  });

  return {
    id: get('id') || `user_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`,
    name,
    email: email.trim(),
    password: password || 'pass123',
    role,
    department,
    avatarColor: isAdmin ? '#059669' : '#2563eb',
    permissions,
    createdAt: get('Timestamp', 'createdAt') || new Date().toISOString(),
  };
};

// ─── MAPPER FOR "Purchase Car Details" SHEET (EXACT 23 COLUMNS A:W) ───────────
export const mapCarToSheet = (car) => ({
  "Timestamp": car.timestamp || car.createdAt || createTimestamp(),
  "Vehicle ID": car.vehicleId || '',
  "Firm Name": car.firmName || '',
  "NAME OF CAR / Vehicle": car.carName || '',
  "DATE OF PURCHASE": car.dateOfPurchase || '',
  "MODEL NO": car.modelNo || '',
  "COMPANY PURCHASED FROM": car.companyPurchasedFrom || '',
  "FUEL TYPE": car.fuelType || '',
  "REGISTRATION NO.": car.registrationNo || '',
  "CHASSIS NO.": car.chassisNo || '',
  "ENGINE NO.": car.engineNo || '',
  "VALUE OF CAR": car.valueOfCar || '',
  "RTO AMOUNT": car.rtoAmount || '',
  "EMI on Vehicle": (car.hasEmi === 'Yes' || car.hasEmi === true || car.emiStatus === 'Yes' || checkHasEmi(car)) ? 'Yes' : 'No',
  "COMPANY MOBILE NO.": car.companyMobileNo || '',
  "SERVICE PERSON NAME": car.servicePersonName || '',
  "SERVICE PERSON MOBILE NO": car.servicePersonMobileNo || '',
  "Name Of The Owner": car.nameOfOwner || '',
  "Vehicle Assign To": car.vehicleAssignTo || car.assignedTo || '',
  "Employee Id": car.employeeId || '',
  "Pollution Date": car.pollutionDate || '',
  "Insurance of Vehicle": (car.hasInsurance === 'Yes' || car.hasInsurance === true || (car.insurance && car.insurance !== 'No') || car.hasOwnDamage === 'Yes' || car.hasThirdParty === 'Yes') ? 'Yes' : 'No',
  "Copy Of Registration": car.copyOfRegistration?.url || (typeof car.copyOfRegistration === 'string' ? car.copyOfRegistration : '') || '',
});

// ─── MAPPER FOR "EMI On Vehicle" SHEET (EXACT 12 COLUMNS A:L, ROW 6 HEADERS, DATA ROW 7+) ───
export const mapEmiToSheet = (car, existingCars = []) => {
  const emiCalc = calcEmiDetails(car);
  const emiNo = car.emiNo || generateEmiNo(existingCars);
  return {
    "Timestamps": car.timestamp || car.createdAt || createTimestamp(),
    "EMI No": emiNo,
    "HYPOTHICATION BANK": car.hypothecationBank || '',
    "Total Loan Amount (₹)": car.loanAmount || '',
    "Monthly EMI Amount (₹)": car.emiAmount || '',
    "EMI Start Date": car.emiStartDate || '',
    "Last EMI Date": car.lastEmiDate || '',
    "DATE OF RELEASE OF HYPOTHICATION": car.dateOfReleaseHypothecation || '',
    "Total Tenure (Months / Total EMIs)": car.totalEmis || '',
    "EMIs Paid So Far (Count)": car.paidEmis || '',
    "Amount Paid So Far (₹) (अब तक पे किया)": car.paidEmiAmount !== undefined && car.paidEmiAmount !== '' ? String(car.paidEmiAmount) : (emiCalc?.paidAmount > 0 ? String(emiCalc.paidAmount) : '0'),
    "Remaining Balance to Pay (₹) (बाकी है)": car.remainingLoanAmount !== undefined && car.remainingLoanAmount !== '' ? String(car.remainingLoanAmount) : (emiCalc?.remainingAmount > 0 ? String(emiCalc.remainingAmount) : (emiCalc?.isCompleted ? '0' : '0')),
  };
};

export const syncEmiToSheet = async (car) => {
  if (!car) return;
  const isEmi = car.hasEmi === 'Yes' || car.hasEmi === true || car.emiStatus === 'Yes' || checkHasEmi(car);
  if (!isEmi) return;

  const cars = load(KEYS.CARS);
  if (!car.emiNo) {
    car.emiNo = generateEmiNo(cars);
    const carIdx = cars.findIndex(c => c.vehicleId === car.vehicleId || (car.registrationNo && c.registrationNo === car.registrationNo));
    if (carIdx !== -1) {
      cars[carIdx].emiNo = car.emiNo;
      save(KEYS.CARS, cars);
    }
  }

  const emiPayload = mapEmiToSheet(car, cars);
  return await sendToSheet({
    action: 'update',
    sheetName: 'EMI On Vehicle',
    keyField: 'EMI No',
    keyValue: emiPayload['EMI No'],
    data: emiPayload
  });
};

export const mapSheetRowToCar = (row, index) => {
  if (!row || typeof row !== 'object') return null;

  const get = (...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
      const target = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [rk, rv] of Object.entries(row)) {
        if (rk.toLowerCase().replace(/[^a-z0-9]/g, '') === target && rv !== undefined && rv !== null && String(rv).trim() !== '') {
          return String(rv).trim();
        }
      }
    }
    return '';
  };

  const regNo = get('REGISTRATION NO.', 'REGISTRATION NO', 'registrationNo');
  const carName = get('NAME OF CAR / Vehicle', 'Name of Car / Vehicle', 'carName', 'Car Name');
  if (!regNo && !carName) return null;

  const emiOnVehicle = get('EMI on Vehicle', 'EMI on vehicle', 'EMI (Y/N)', 'EMI Status', 'Is EMI', 'hasEmi', 'EMI');
  const isEmi = emiOnVehicle === 'Yes' || emiOnVehicle === 'yes' || emiOnVehicle === true || emiOnVehicle === 'TRUE';

  const insOnVehicle = get('Insurance of Vehicle', 'Insurance Of Vehicle', 'Insurance', 'hasInsurance');
  const isIns = insOnVehicle === 'Yes' || insOnVehicle === 'yes' || insOnVehicle === true || insOnVehicle === 'TRUE';

  return {
    vehicleId: get('Vehicle ID', 'vehicleId') || `CAR-${String(index + 1).padStart(4, '0')}`,
    firmName: get('Firm Name', 'Firm name', 'firmName', 'FirmName', 'Firm', 'FIRM NAME'),
    carName: carName,
    dateOfPurchase: get('DATE OF PURCHASE', 'Date of Purchase', 'dateOfPurchase'),
    modelNo: get('MODEL NO', 'Model No', 'modelNo'),
    companyPurchasedFrom: get('COMPANY PURCHASED FROM', 'Company Purchased From', 'companyPurchasedFrom'),
    fuelType: get('FUEL TYPE', 'Fuel Type', 'fuelType'),
    registrationNo: regNo,
    chassisNo: get('CHASSIS NO.', 'CHASSIS NO', 'Chassis No', 'chassisNo'),
    engineNo: get('ENGINE NO.', 'ENGINE NO', 'Engine No', 'engineNo'),
    valueOfCar: get('VALUE OF CAR', 'Value of Car', 'valueOfCar'),
    rtoAmount: get('RTO AMOUNT', 'RTO Amount', 'rtoAmount'),
    hasEmi: isEmi,
    emiStatus: isEmi ? 'Yes' : 'No',
    companyMobileNo: get('COMPANY MOBILE NO.', 'COMPANY MOBILE NO', 'Company Mobile No', 'companyMobileNo'),
    servicePersonName: get('SERVICE PERSON NAME', 'Service Person Name', 'servicePersonName'),
    servicePersonMobileNo: get('SERVICE PERSON MOBILE NO', 'Service Person Mobile No', 'servicePersonMobileNo'),
    nameOfOwner: get('Name Of The Owner', 'Name of the Owner', 'nameOfOwner'),
    pollutionDate: get('Pollution Date', 'pollutionDate'),
    hasInsurance: isIns,
    insurance: isIns ? 'Yes' : 'No',
    copyOfRegistration: get('Copy Of Registration', 'Copy of Registration', 'copyOfRegistration'),
    // Hypothecation & EMI fields (if also populated from EMI On Vehicle)
    hypothecationBank: get('HYPOTHICATION BANK', 'Hypothecation Bank', 'Bank Name', 'hypothecationBank'),
    loanAmount: get('LOAN AMOUNT', 'Loan Amount', 'loanAmount', 'Total Loan Amount'),
    emiStartDate: get('EMI START DATE', 'EMI Start Date', 'emiStartDate', 'Loan Start Date'),
    lastEmiDate: get('LAST EMI DATE', 'Last EMI Date', 'lastEmiDate'),
    dateOfReleaseHypothecation: get('DATE OF RELEASE OF HYPOTHICATION', 'Date of Release of Hypothecation', 'dateOfReleaseHypothecation'),
    emiAmount: get('EMI AMOUNT', 'EMI Amount', 'emiAmount', 'EMI'),
    totalEmis: get('TOTAL EMIS', 'Total EMIs', 'totalEmis', 'Tenure Months', 'Tenure'),
    paidEmis: get('PAID EMIS', 'Paid EMIs', 'paidEmis', 'EMIs Paid'),
    paidEmiAmount: get('PAID EMI AMOUNT', 'Paid EMI Amount', 'paidEmiAmount', 'Total EMI Paid Amount', 'Paid Amount'),
    remainingLoanAmount: get('REMAINING LOAN AMOUNT', 'Remaining Loan Amount', 'remainingLoanAmount', 'Balance Amount', 'Remaining Amount'),
    // Insurance additional fields
    insuranceAmount: get('INSURANCE AMOUNT', 'Insurance Amount', 'insuranceAmount'),
    copyOfInsurance: get('Copy Of Insurance', 'Copy of Insurance', 'copyOfInsurance'),
    nameOfCompany: get('Name Of The Company', 'Name of the Company', 'nameOfCompany'),
    agentName: get('Agent Name', 'agentName'),
    dateOfInsurance: get('Date Of Insurance', 'Date of Insurance', 'dateOfInsurance'),
    vehicleAssignTo: get('Vehicle Assign To', 'Vehicle Assign to', 'vehicleAssignTo', 'Assigned To', 'assignedTo', 'Driver Name', 'driverName'),
    employeeId: get('Employee ID', 'Employee Id', 'employeeId', 'Emp ID', 'empId'),
    assigneeMobileNo: get('Assignee Mobile No.', 'Assignee Mobile No', 'Assignee Mobile', 'assigneeMobileNo', 'Driver Mobile', 'Driver Phone'),
    timestamp: get('Timestamp', 'timestamp') || createTimestamp(),
  };
};

export const checkHasEmi = (car) => {
  if (!car) return false;

  const status = String(car.emiStatus || '').trim().toLowerCase();
  if (status === 'no' || status === 'false') {
    const hasOtherEmi = (car.emiAmount && Number(String(car.emiAmount).replace(/[^0-9.-]+/g, '')) > 0) ||
      (car.hypothecationBank && !['—', '-', 'none', 'no', 'n/a'].includes(String(car.hypothecationBank).trim().toLowerCase()));
    if (!hasOtherEmi) return false;
  }
  if (status === 'yes' || status === 'true') {
    return true;
  }

  const isValidVal = (val) => {
    if (val === undefined || val === null) return false;
    const s = String(val).trim().toLowerCase();
    return s !== '' && s !== '0' && s !== '0.00' && s !== '0/-' && s !== '—' && s !== '-' && s !== 'no' && s !== 'none' && s !== 'n/a' && s !== 'nil' && s !== 'null' && s !== 'undefined';
  };

  if (isValidVal(car.emiAmount)) {
    const cleaned = String(car.emiAmount).replace(/[^0-9.-]+/g, '');
    const num = Number(cleaned);
    if (!isNaN(num) && num > 0) return true;
    if (isNaN(num) && isValidVal(car.emiAmount)) return true;
  }

  if (isValidVal(car.hypothecationBank)) {
    return true;
  }

  if (isValidVal(car.lastEmiDate)) {
    return true;
  }

  return false;
};

// ─── MAPPER FOR "Insurance Of Vehicle" SHEET (EXACT 43 COLUMNS) ────────────────
export const mapInsuranceToSheet = (ins, existingList = []) => {
  const boolToYesNo = (val) => {
    if (val === true || val === 'Yes' || val === 'yes' || val === 'TRUE' || val === 1 || val === '1') return 'Yes';
    return 'No';
  };

  const formatTenure = (val, defaultVal = '1 Year') => {
    if (!val && val !== 0) return defaultVal;
    const s = String(val).trim().toLowerCase();
    if (s.startsWith('3')) return '3 Years';
    if (s.startsWith('1')) return '1 Year';
    if (s.startsWith('2')) return '2 Years';
    if (s.startsWith('5')) return '5 Years';
    return String(val).trim();
  };

  const insuranceId = ins.insuranceId || generateInsuranceId(existingList);

  return {
    "Timestamp": ins.timestamp || ins.createdAt || createTimestamp(),
    "Date": ins.date || ins.dateOfInsurance || '',
    "Insurance ID": insuranceId,
    "Vehicle ID": ins.vehicleId || '',
    "Car Name": ins.carName || '',
    "Name Of Company": ins.nameOfCompany || '',
    "Date Of Insurance": ins.dateOfInsurance || ins.date || '',
    "Own Damage / Self Accident": ins.hasOwnDamage || (ins.basicPremium ? 'Yes' : 'No'),
    "OD Policy Start Date": ins.odStartDate || ins.date || '',
    "OD Policy End Date": ins.odEndDate || '',
    "IDV Value (₹)": ins.idvValue || '',
    "Own Damage / Basic Premium (₹)": ins.basicPremium || '',
    "Policy Inclusive of NCB?": ins.policyInclusiveOfNcb || 'No',
    "NCB Discount Amount (₹)": ins.premiumOfNcb || '',
    "Cashless Facility Available?": ins.cashlessPolicy || 'Yes',
    "Add-On Premium (₹)": ins.addOnPremium || '',
    "ZD (Zero Depreciation)": boolToYesNo(ins.depreciationReimbursement || ins.zd),
    "EP (Engine Protect)": boolToYesNo(ins.engineSecure || ins.ep),
    "CM (Consumable Expenses)": boolToYesNo(ins.consumableExpenses || ins.cm),
    "PB (Loss of Personal Belonging)": boolToYesNo(ins.personalBelonging || ins.pb || ins.loseOfPersonalBelonging),
    "Roadside Assistance (RSA)": boolToYesNo(ins.roadsideAssistance || ins.rsa || ins.roadsideAssistances),
    "KP (Key Protect) ": boolToYesNo(ins.keyReplacement || ins.kp),
    "Emergency Transport And Hotel": boolToYesNo(ins.emergencyTransportHotel || ins.emergencyTransportAndHotel),
    "RTI (Return to Invoice)": boolToYesNo(ins.returnToInvoice || ins.rti),
    "Third Party (TP) Insurance": ins.hasThirdParty || (ins.thirdPartyPremium ? 'Yes' : 'No'),
    "TP Policy Tenure": formatTenure(ins.tpTenure || ins.tpPolicyTenure, '3 Years'),
    "TP Policy Start Date": ins.tpStartDate || ins.date || '',
    "TP Policy End Date": ins.tpEndDate || '',
    "3rd Party Premium (₹)": ins.thirdPartyPremium || '',
    "TP Policy / Certificate No.": ins.tpPolicyNo || '',
    "TPPD Coverage Limit (₹)": ins.tppdLimit || '750000',
    "Personal Accident (PA) Cover": ins.hasPaCover || (ins.paPremium ? 'Yes' : 'No'),
    "PA Cover Type": ins.paCoverType || 'Owner-Driver CPA (₹15 Lakhs)',
    "PA Cover Tenure": formatTenure(ins.paTenure || ins.paCoverTenure, '1 Year'),
    "PA Sum Insured (₹)": ins.paSumInsured || '1500000',
    "PA Premium (₹)": ins.paPremium || '',
    "PA Start Date": ins.paStartDate || ins.date || '',
    "PA End Date": ins.paEndDate || '',
    "Nominee Name": ins.paNomineeName || ins.nomineeName || '',
    "Nominee Relationship": ins.paNomineeRelation || ins.nomineeRelationship || '',
    "Tax / GST (18%) Amount (₹)": ins.taxAmount || '',
    "Total Premium Amount (₹)": ins.totalPremiumAmount || ins.totalPremiumToBePaid || '',
    "Copy Of Insurance": ins.copyOfInsurance?.url || (typeof ins.copyOfInsurance === 'string' ? ins.copyOfInsurance : '') || '',
  };
};

export const mapInsuranceRenewalToSheet = (rec) => {
  const boolToYesNo = (v) => {
    if (v === true || v === 'Yes' || v === 'yes' || v === 'true' || v === 1 || v === '1') return 'Yes';
    if (v === false || v === 'No' || v === 'no' || v === 'false' || v === 0 || v === '0') return 'No';
    return '';
  };

  const formatTenure = (val, defaultVal = '1 Year') => {
    if (!val) return defaultVal;
    const s = String(val).trim();
    if (s.toLowerCase().includes('year')) return s;
    if (s === '1') return '1 Year';
    if (s === '2') return '2 Years';
    if (s === '3') return '3 Years';
    if (s === '5') return '5 Years';
    return `${s} Year${Number(s) > 1 ? 's' : ''}`;
  };

  return {
    "Timestamps": rec.timestamp || rec.updatedAt || createTimestamp(),
    "Renewal Insurance ID": rec.renewalId || '',
    "Vehicle ID": rec.vehicleId || '',
    "Insurance ID": rec.insuranceId || '',
    "Car Name": rec.carName || '',
    "Reg. No.": rec.registrationNo || '',
    "Insurance Company": rec.nameOfCompany || '',
    "Insurance Agent / Broker": rec.agentName || '',
    "Type Of Cover": rec.typeOfCover || '',
    "Policy End Date": rec.policyEndDate || '',
    "Actual": rec.actual || createTimestamp(),

    // OD Group
    "OD Policy Start Date": rec.odStartDate || '',
    "OD Policy End Date": rec.odEndDate || '',
    "Renewed IDV Value (₹)": rec.idvValue || '',
    "Own Damage / Basic Premium (₹)": rec.basicPremium || '',
    "Claimed Insurance Last Year?": rec.claimedLastYear || 'No',
    "Policy Inclusive of NCB?": rec.policyInclusiveOfNcb || 'No',
    "NCB Discount Amount (₹)": rec.premiumOfNcb || '',
    "Cashless Facility Available?": rec.cashlessPolicy || 'Yes',
    "ZD (Zero Depreciation)": boolToYesNo(rec.depreciationReimbursement || rec.zd),
    "EP (Engine Protect)": boolToYesNo(rec.engineSecure || rec.ep),
    "CM (Consumable Expenses)": boolToYesNo(rec.consumableExpenses || rec.cm),
    "PB (Loss of Personal Belonging)": boolToYesNo(rec.personalBelonging || rec.pb),
    "Roadside Assistance (RSA)": boolToYesNo(rec.roadsideAssistance || rec.rsa),
    "KP (Key Protect) ": boolToYesNo(rec.keyReplacement || rec.kp),
    "Emergency Transport And Hotel": boolToYesNo(rec.emergencyTransportHotel),
    "RTI (Return to Invoice)": boolToYesNo(rec.returnToInvoice || rec.rti),
    "odTaxAmount": rec.odTaxAmount !== undefined ? rec.odTaxAmount : '',
    "odTotalAmount": rec.odTotalAmount !== undefined ? rec.odTotalAmount : '',

    // TP Group
    "TP Policy Start Date": rec.tpStartDate || '',
    "TP Policy End Date": rec.tpEndDate || '',
    "TP Policy Tenure": formatTenure(rec.tpTenure || rec.tpPolicyTenure, '1 Year'),
    "3rd Party Premium (₹)": rec.thirdPartyPremium || '',
    "TP Policy / Certificate No.": rec.tpPolicyNo || '',
    "TPPD Coverage Limit (₹)": rec.tppdLimit || '750000',
    "tpTaxAmount": rec.tpTaxAmount !== undefined ? rec.tpTaxAmount : '',
    "tpTotalAmount": rec.tpTotalAmount !== undefined ? rec.tpTotalAmount : '',

    // PA Group
    "PA Cover Type": rec.paCoverType || '',
    "PA Sum Insured (₹)": rec.paSumInsured || '1500000',
    "PA Premium (₹)": rec.paPremium || '',
    "PA Start Date": rec.paStartDate || '',
    "PA End Date": rec.paEndDate || '',
    "PA Cover Tenure": formatTenure(rec.paTenure || rec.paCoverTenure, '1 Year'),
    "Nominee Name": rec.paNomineeName || rec.nomineeName || '',
    "Nominee Relationship": rec.paNomineeRelation || rec.nomineeRelationship || '',
    "paTaxAmount": rec.paTaxAmount !== undefined ? rec.paTaxAmount : '',
    "paTotalAmount": rec.paTotalAmount !== undefined ? rec.paTotalAmount : '',

    // Fallbacks
    "Tax / GST (18%) (₹)": rec.taxAmount || '',
    "Total Premium Amount (₹)": rec.totalPremiumAmount || rec.totalPremiumToBePaid || '',
  };
};

export const mapInsuranceRenewalRows = (rec) => {
  const boolToYesNo = (v) => {
    if (v === true || v === 'Yes' || v === 'yes' || v === 'true' || v === 1 || v === '1') return 'Yes';
    if (v === false || v === 'No' || v === 'no' || v === 'false' || v === 0 || v === '0') return 'No';
    return '';
  };

  const formatTenure = (val, defaultVal = '1 Year') => {
    if (!val) return defaultVal;
    const s = String(val).trim();
    if (s.toLowerCase().includes('year')) return s;
    if (s === '1') return '1 Year';
    if (s === '2') return '2 Years';
    if (s === '3') return '3 Years';
    if (s === '5') return '5 Years';
    return `${s} Year${Number(s) > 1 ? 's' : ''}`;
  };

  const rows = [];
  const baseTimestamp = rec.actual || rec.timestamp || rec.updatedAt || createTimestamp();
  const renewalId = rec.renewalId || '';
  const vehicleId = rec.vehicleId || '';
  const insuranceId = rec.insuranceId || '';
  const carName = rec.carName || '';
  const regNo = rec.registrationNo || '';
  const comp = rec.nameOfCompany || '';
  const agent = rec.agentName || '';

  // 1. OD Row (if Own Damage renewed)
  if (rec.renewOd) {
    rows.push({
      "Timestamps": baseTimestamp,
      "Renewal Insurance ID": renewalId,
      "Vehicle ID": vehicleId,
      "Insurance ID": insuranceId,
      "Car Name": carName,
      "Reg. No.": regNo,
      "Insurance Company": comp,
      "Insurance Agent / Broker": agent,
      "Type Of Cover": "Own Damage / Self Accident",
      "Policy End Date": rec.previousOdEndDate || rec.existingOdEndDate || '',
      "Actual": baseTimestamp,

      // OD Group
      "OD Policy Start Date": rec.odStartDate || '',
      "OD Policy End Date": rec.odEndDate || '',
      "Renewed IDV Value (₹)": rec.idvValue || '',
      "Own Damage / Basic Premium (₹)": rec.basicPremium || '',
      "Claimed Insurance Last Year?": rec.claimedLastYear || 'No',
      "Policy Inclusive of NCB?": rec.policyInclusiveOfNcb || 'No',
      "NCB Discount Amount (₹)": rec.premiumOfNcb || '',
      "Cashless Facility Available?": rec.cashlessPolicy || 'Yes',
      "ZD (Zero Depreciation)": boolToYesNo(rec.depreciationReimbursement || rec.zd),
      "EP (Engine Protect)": boolToYesNo(rec.engineSecure || rec.ep),
      "CM (Consumable Expenses)": boolToYesNo(rec.consumableExpenses || rec.cm),
      "PB (Loss of Personal Belonging)": boolToYesNo(rec.personalBelonging || rec.pb),
      "Roadside Assistance (RSA)": boolToYesNo(rec.roadsideAssistance || rec.rsa),
      "KP (Key Protect) ": boolToYesNo(rec.keyReplacement || rec.kp),
      "Emergency Transport And Hotel": boolToYesNo(rec.emergencyTransportHotel),
      "RTI (Return to Invoice)": boolToYesNo(rec.returnToInvoice || rec.rti),
      "odTaxAmount": rec.odTaxAmount !== undefined ? rec.odTaxAmount : '',
      "odTotalAmount": rec.odTotalAmount !== undefined ? rec.odTotalAmount : '',
      "Tax / GST (18%) (₹)": rec.odTaxAmount !== undefined ? rec.odTaxAmount : '',
      "Total Premium Amount (₹)": rec.odTotalAmount !== undefined ? rec.odTotalAmount : '',
    });
  }

  // 2. TP Row (if Third Party renewed)
  if (rec.renewTp) {
    rows.push({
      "Timestamps": baseTimestamp,
      "Renewal Insurance ID": renewalId,
      "Vehicle ID": vehicleId,
      "Insurance ID": insuranceId,
      "Car Name": carName,
      "Reg. No.": regNo,
      "Insurance Company": comp,
      "Insurance Agent / Broker": agent,
      "Type Of Cover": "Third Party (TP) Insurance",
      "Policy End Date": rec.previousTpEndDate || rec.existingTpEndDate || '',
      "Actual": baseTimestamp,

      // TP Group
      "TP Policy Start Date": rec.tpStartDate || '',
      "TP Policy End Date": rec.tpEndDate || '',
      "TP Policy Tenure": formatTenure(rec.tpTenure || rec.tpPolicyTenure, '1 Year'),
      "3rd Party Premium (₹)": rec.thirdPartyPremium || '',
      "TP Policy / Certificate No.": rec.tpPolicyNo || '',
      "TPPD Coverage Limit (₹)": rec.tppdLimit || '750000',
      "tpTaxAmount": rec.tpTaxAmount !== undefined ? rec.tpTaxAmount : '',
      "tpTotalAmount": rec.tpTotalAmount !== undefined ? rec.tpTotalAmount : '',
      "Tax / GST (18%) (₹)": rec.tpTaxAmount !== undefined ? rec.tpTaxAmount : '',
      "Total Premium Amount (₹)": rec.tpTotalAmount !== undefined ? rec.tpTotalAmount : '',
    });
  }

  // 3. PA Row (if Personal Accident renewed)
  if (rec.renewPa) {
    rows.push({
      "Timestamps": baseTimestamp,
      "Renewal Insurance ID": renewalId,
      "Vehicle ID": vehicleId,
      "Insurance ID": insuranceId,
      "Car Name": carName,
      "Reg. No.": regNo,
      "Insurance Company": comp,
      "Insurance Agent / Broker": agent,
      "Type Of Cover": "Personal Accident (PA Cover)",
      "Policy End Date": rec.previousPaEndDate || rec.existingPaEndDate || '',
      "Actual": baseTimestamp,

      // PA Group
      "PA Cover Type": rec.paCoverType || '',
      "PA Sum Insured (₹)": rec.paSumInsured || '1500000',
      "PA Premium (₹)": rec.paPremium || '',
      "PA Start Date": rec.paStartDate || '',
      "PA End Date": rec.paEndDate || '',
      "PA Cover Tenure": formatTenure(rec.paTenure || rec.paCoverTenure, '1 Year'),
      "Nominee Name": rec.paNomineeName || rec.nomineeName || '',
      "Nominee Relationship": rec.paNomineeRelation || rec.nomineeRelationship || '',
      "paTaxAmount": rec.paTaxAmount !== undefined ? rec.paTaxAmount : '',
      "paTotalAmount": rec.paTotalAmount !== undefined ? rec.paTotalAmount : '',
      "Tax / GST (18%) (₹)": rec.paTaxAmount !== undefined ? rec.paTaxAmount : '',
      "Total Premium Amount (₹)": rec.paTotalAmount !== undefined ? rec.paTotalAmount : '',
    });
  }

  // If neither flag was explicitly passed, fallback to single row
  if (rows.length === 0) {
    rows.push(mapInsuranceRenewalToSheet(rec));
  }

  return rows;
};

export const mapSheetRowToInsurance = (row, index) => {
  if (!row || typeof row !== 'object') return null;

  const get = (...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
      const target = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [rk, rv] of Object.entries(row)) {
        if (rk.toLowerCase().replace(/[^a-z0-9]/g, '') === target && rv !== undefined && rv !== null && String(rv).trim() !== '') {
          return String(rv).trim();
        }
      }
    }
    return '';
  };

  const carName = get('Car Name', 'carName', 'Vehicle Name', 'Vehicle');
  const date = get('Date', 'date', 'Date Of Insurance', 'Date of Insurance');
  const nameOfCompany = get('Name Of Company', 'Name of Company', 'nameOfCompany', 'Company');
  if (!carName && !date && !nameOfCompany) return null;

  const isYes = (val) => {
    const s = String(val).toLowerCase().trim();
    return s === 'yes' || s === 'true' || s === '1';
  };

  const parseTenureYears = (val, defaultYears = 1) => {
    if (!val) return String(defaultYears);
    const m = String(val).match(/\d+/);
    return m ? m[0] : String(defaultYears);
  };

  const insId = get('Insurance ID', 'Insurance Id', 'insuranceId') || `INS-${String(index + 1).padStart(4, '0')}`;
  const rawTpTenure = get('TP Policy Tenure', 'tpPolicyTenure', 'tpTenure', 'TP Tenure');
  const rawPaTenure = get('PA Cover Tenure', 'paCoverTenure', 'paTenure', 'PA Tenure');

  return {
    id: row.id || `ins_${index + 1}`,
    insuranceId: insId,
    vehicleId: get('Vehicle ID', 'vehicleId'),
    carName: carName,
    date: date,
    nameOfCompany: nameOfCompany,
    dateOfInsurance: get('Date Of Insurance', 'Date of Insurance', 'dateOfInsurance', 'Date', 'date'),
    agentName: get('Agent Name', 'agentName'),
    idvValue: get('IDV Value (₹)', 'IDV Value', 'idvValue'),
    basicPremium: get('Own Damage / Basic Premium (₹)', 'Basic Premium', 'basicPremium'),
    policyInclusiveOfNcb: get('Policy Inclusive of NCB?', 'Is The Proposed Policy Inclusive Of NCB', 'policyInclusiveOfNcb') || 'No',
    premiumOfNcb: get('NCB Discount Amount (₹)', 'What Is Premium Of NCB', 'premiumOfNcb'),
    cashlessPolicy: get('Cashless Facility Available?', 'Is It Cashless Policy', 'cashlessPolicy') || 'Yes',
    addOnPremium: get('Add-On Premium (₹)', 'Add On Premium', 'addOnPremium'),
    depreciationReimbursement: isYes(get('ZD (Zero Depreciation)', 'Depreciation Reimbursement', 'ZD', 'zd')),
    engineSecure: isYes(get('EP (Engine Protect)', 'Engine Secure', 'EP', 'ep')),
    consumableExpenses: isYes(get('CM (Consumable Expenses)', 'Consumable Expenses', 'CM', 'cm')),
    personalBelonging: isYes(get('PB (Loss of Personal Belonging)', 'Lose Of Personal Belonging', 'Loss Of Personal Belonging', 'PB', 'pb')),
    roadsideAssistance: isYes(get('Roadside Assistance (RSA)', 'Roadside Assistances', 'RSA', 'rsa')),
    keyReplacement: isYes(get('KP (Key Protect)', 'KP (Key Protect) ', 'Key Replacement', 'KP', 'kp')),
    emergencyTransportHotel: isYes(get('Emergency Transport And Hotel', 'Emergency Transport & Hotel', 'emergencyTransportHotel')),
    returnToInvoice: isYes(get('RTI (Return to Invoice)', 'Return To Invoice', 'RTI', 'rti')),
    hasOwnDamage: get('Own Damage / Self Accident', 'Own Damage / Self Accident Details', 'hasOwnDamage') || (get('Own Damage / Basic Premium (₹)', 'Basic Premium') ? 'Yes' : 'No'),
    odStartDate: get('OD Policy Start Date', 'OD Start Date', 'odStartDate') || date,
    odEndDate: get('OD Policy End Date', 'OD End Date', 'odEndDate'),
    hasThirdParty: get('Third Party (TP) Insurance', 'Third Party (TP) Insurance Details', 'Third Party Insurance', 'hasThirdParty') || (get('3rd Party Premium (₹)', 'Third Party Premium') ? 'Yes' : 'No'),
    tpTenure: parseTenureYears(rawTpTenure, 3),
    tpPolicyTenure: rawTpTenure || '3 Years',
    tpStartDate: get('TP Policy Start Date', 'TP Start Date', 'tpStartDate') || date,
    tpEndDate: get('TP Policy End Date', 'TP End Date', 'tpEndDate'),
    thirdPartyPremium: get('3rd Party Premium (₹)', 'Third Party Premium', 'thirdPartyPremium'),
    tpPolicyNo: get('TP Policy / Certificate No.', 'TP Policy No', 'tpPolicyNo'),
    tppdLimit: get('TPPD Coverage Limit (₹)', 'TPPD Limit', 'tppdLimit') || '750000',
    hasPaCover: get('Personal Accident (PA) Cover', 'Personal Accident (PA) Cover Details', 'Personal Accident Cover', 'hasPaCover') || (get('PA Premium (₹)', 'PA Premium') ? 'Yes' : 'No'),
    paCoverType: get('PA Cover Type', 'paCoverType') || 'Owner-Driver CPA (₹15 Lakhs)',
    paTenure: parseTenureYears(rawPaTenure, 1),
    paCoverTenure: rawPaTenure || '1 Year',
    paSumInsured: get('PA Sum Insured (₹)', 'PA Sum Insured', 'paSumInsured') || '1500000',
    paPremium: get('PA Premium (₹)', 'PA Premium', 'paPremium'),
    paStartDate: get('PA Start Date', 'paStartDate') || date,
    paEndDate: get('PA End Date', 'paEndDate'),
    paNomineeName: get('Nominee Name', 'PA Nominee Name', 'paNomineeName'),
    paNomineeRelation: get('Nominee Relationship', 'PA Nominee Relation', 'paNomineeRelation'),
    taxAmount: get('Tax / GST (18%) Amount (₹)', 'Tax Amount', 'taxAmount'),
    totalPremiumAmount: get('Total Premium Amount (₹)', 'Total Premium Amount', 'Total Premium To Be Paid', 'totalPremiumAmount'),
    totalPremiumToBePaid: get('Total Premium Amount (₹)', 'Total Premium To Be Paid', 'totalPremiumToBePaid'),
    copyOfInsurance: get('Copy Of Insurance', 'Copy of Insurance', 'copyOfInsurance'),
    timestamp: get('Timestamp', 'timestamp') || createTimestamp(),
  };
};

// ─── MAPPER FOR "Car Repair" / "FMS" SHEET ────────────────────────────────────
export const mapRepairToSheet = (repair) => ({
  "Timestamp": repair.timestamp || repair.createdAt || createTimestamp(),
  "Car Repair No.": repair.repairNo || '',
  "Vehicle ID": repair.vehicleId || '',
  "Car Name": repair.carName || '',
  "Reason For Repair": repair.reasonForRepair || '',
  "Which Garage Is It Going For Repair": repair.garage || '',
  "Who Is Taking The Car": repair.whoTakingCar || '',
  "Repair Type": repair.repairType || (repair.insuranceToBeClaimed === 'Yes' ? 'Accident' : 'Normal Repair'),
  "Insurance to be claimed": repair.insuranceToBeClaimed || 'No',
  "Department": repair.department || '',
  ...(repair.plannedDate ? { "Planned 1": repair.plannedDate } : {}),
});

export const mapSheetRowToRepair = (row, index) => {
  const repairNo = row['Car Repair No.'] || row['Car Repair No'] || row.repairNo || '';
  const carName = row['Car Name'] || row.carName || '';
  const vehicleId = row['Vehicle ID'] || row.vehicleId || '';
  const reason = row['Reason For Repair'] || row.reasonForRepair || '';

  // Filter out any banner rows like "02-", "Who", "How", "When", "Timestamp"
  const cleanRepairNo = String(repairNo).trim().toLowerCase();
  const cleanCarName = String(carName).trim().toLowerCase();

  if (cleanRepairNo === '02-' || cleanRepairNo === 'who' || cleanRepairNo === 'how' || cleanRepairNo === 'when' || cleanRepairNo === 'timestamp' || cleanRepairNo === 'car repair no.' || cleanCarName === 'car name') {
    return null;
  }

  if (!repairNo && !carName && !vehicleId && !reason) {
    return null;
  }

  const finalRepairNo = repairNo ? String(repairNo).trim() : `REP-${String(index + 1).padStart(4, '0')}`;

  return {
    id: row.id || `rep_${finalRepairNo}`,
    repairNo: finalRepairNo,
    vehicleId: vehicleId || '',
    carName: carName || '',
    reasonForRepair: reason || '',
    garage: row['Which Garage Is It Going For Repair'] || row.garage || '',
    garageName: row['Garage Name'] || row.garageName || row['Which Garage Is It Going For Repair'] || row.garage || '',
    whoTakingCar: row['Who Is Taking The Car'] || row.whoTakingCar || '',
    repairType: row['Repair Type'] || row.repairType || (row['Insurance to be claimed'] === 'Yes' ? 'Accident' : 'Normal Repair'),
    insuranceToBeClaimed: row['Insurance to be claimed'] || row.insuranceToBeClaimed || 'No',
    department: row['Department'] || row.department || '',
    plannedDate: row['Planned 1'] || row['Planned Date'] || row['Planned'] || row.plannedDate || '',
    actualDate: row['Actual 1'] || row['Actual Date'] || row['Actual'] || row.actualDate || '',
    expectedCompletionDate: row['Expected Repair Completion Date'] || row['Expected Completion Date'] || row['Date of Delivery From Garage'] || row['Date Of Delivery From Garage'] || row.expectedCompletionDate || '',
    plannedDate2: row['Planned 2'] || row['Planned Date 2'] || row.plannedDate2 || '',
    actualDate2: row['Actual 2'] || row['Actual Date 2'] || row.actualDate2 || '',
    plannedDate3: row['Planned 3'] || row['Planned Date 3'] || row.plannedDate3 || '',
    actualDate3: row['Actual 3'] || row['Actual Date 3'] || row.actualDate3 || '',
    dateVehicleReceived: row['Date Of Vechile Received Back'] || row['Date Of Vehicle Received Back'] || row['Date of Vehicle Received Back'] || row.dateVehicleReceived || '',
    kmAtTimeOfRepair: row['K.M at The Time Of Repair'] || row['KM at The Time Of Repair'] || row.kmAtTimeOfRepair || '',
    repairWorkDone: row['Reapir Work Done'] || row['Repair Work Done'] || row.repairWorkDone || '',
    partsAmount: row['Parts Amount'] || row.partsAmount || '',
    serviceAmount: row['Service Amount'] || row.serviceAmount || '',
    insuranceClaimed: row['Insurance Claimed (If Any)'] || row['Insurance Claimed'] || row.insuranceClaimed || 'No',
    insuranceAmount: row['Insurance Amount ( If Claimed )'] || row['Insurance Amount (If Claimed)'] || row.insuranceAmount || '',
    billAmount: row['Bill Amount'] || row.billAmount || '',
    billImage: row['Bill Image'] || row.billImage || '',
    photoOfOffer: row['Photo Of Offer'] || row['Photo of Offer'] || row.photoOfOffer || '',
    insurance: row['Insurance'] || row.insurance || '',
    typesOfRepair: row['Types Of Repair'] || row['Types of Repair'] || row.typesOfRepair || [],
    repairStatus: row.repairStatus || (row['Actual 3'] ? 'Delivered' : (row['Actual 2'] ? 'Approved' : (row['Actual 1'] ? 'Offer Received' : 'Created'))),
    timestamp: row['Timestamp'] || row.timestamp || createTimestamp(),
    createdAt: row['Timestamp'] || row.createdAt || createTimestamp(),
  };
};

// ─── MAPPER FOR "If Accident / Insurance Claims" SHEET ────────────────────────
export const mapSheetRowToClaim = (row, index) => {
  if (!row || typeof row !== 'object') return null;
  const get = (...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
      const target = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [rk, rv] of Object.entries(row)) {
        if (rk.toLowerCase().replace(/[^a-z0-9]/g, '') === target && rv !== undefined && rv !== null && String(rv).trim() !== '') {
          return String(rv).trim();
        }
      }
    }
    return '';
  };

  const claimNo = get('Claim No.', 'Claim No', 'claimNo', 'CLAIM NO');
  const repairNo = get('Repair No.', 'Repair No', 'repairNo', 'REPAIR NO');
  const vehicleId = get('Vehicle ID', 'vehicleId', 'VEHICLE ID');
  const vehicleNameRaw = get('Vehicle', 'Vehicle Name', 'Vehicle / Car Name', 'vehicleName', 'Car Name', 'carName');
  const isDateLike = (str) => /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(String(str || '').trim());
  const vehicleName = isDateLike(vehicleNameRaw) ? '' : vehicleNameRaw;

  const rawReason = get('Reason For Repair', 'reasonForRepair', 'Reason for Repair', 'Accident Reason', 'accidentReason');
  const reasonForRepair = isDateLike(rawReason) ? '' : rawReason;

  const department = get('Departmen', 'Department', 'department');

  if (!claimNo && !repairNo && !vehicleId && !vehicleName) return null;

  const repairs = load(KEYS.REPAIRS);
  const matchedRepair = repairNo ? repairs.find(r => r.repairNo === repairNo) : null;
  const finalVehicleName = vehicleName || matchedRepair?.carName || '';
  const finalReason = reasonForRepair || matchedRepair?.reasonForRepair || '';
  const finalDept = department || matchedRepair?.department || '';
  const finalVehicleId = vehicleId || matchedRepair?.vehicleId || '';

  const cars = load(KEYS.CARS);
  const matchedCar = (finalVehicleId || finalVehicleName)
    ? cars.find(c => (finalVehicleId && c.vehicleId === finalVehicleId) || (finalVehicleName && c.carName && c.carName.toLowerCase() === finalVehicleName.toLowerCase()))
    : null;

  const finalRegNo = get('Registration No.', 'Registration No', 'registrationNo') || matchedRepair?.registrationNo || matchedCar?.registrationNo || '';
  const finalDriverName = get('Driver Name', 'driverName') || matchedRepair?.whoTakingCar || matchedRepair?.driverName || '';
  const finalDriverMobile = get('Driver Mobile', 'Driver Mobile No.', 'driverMobileNo') || matchedRepair?.driverMobileNo || '';
  const finalTimeOfAccident = get('Time of Accident', 'Time Of Accident', 'timeOfAccident') || matchedRepair?.timeOfAccident || '';
  const finalAccidentLoc = get('Accident Location', 'accidentLocation') || '';

  return {
    id: get('id') || `clm_${claimNo || index + 1}`,
    claimNo: claimNo || `CLM-${String(index + 1).padStart(4, '0')}`,
    repairNo: repairNo || '',
    vehicleId: finalVehicleId,
    vehicleName: finalVehicleName,
    registrationNo: finalRegNo,
    dateOfAccident: get('Date of Accident', 'Date Of Accident', 'dateOfAccident') || matchedRepair?.dateOfAccident || today(),
    timeOfAccident: finalTimeOfAccident,
    accidentLocation: finalAccidentLoc,
    accidentReason: finalReason,
    reasonForRepair: finalReason,
    department: finalDept,
    driverName: finalDriverName,
    driverMobileNo: finalDriverMobile,
    insuranceCompany: get('Insurance Company', 'insuranceCompany'),
    policyNo: get('Policy No.', 'Policy No', 'policyNo'),
    policyValidity: get('Policy Validity', 'policyValidity'),
    insuranceClaim: get('Insurance Claim', 'insuranceClaim') || 'Yes',
    estimatedClaimAmount: get('Estimated Claim Amount (₹)', 'Estimated Claim Amount', 'Est. Amount', 'estimatedClaimAmount'),
    typeOfClaim: get('Type Of Claim', 'typeOfClaim') || 'Own Damage',
    claimMode: (() => {
      const m = get('Claim Settlement Mode', 'Claim Mode', 'Settlement Mode', 'claimMode');
      if (m && (m.includes('Cashless') || m.includes('Reimbursement'))) return m;
      return 'Cashless Claim (Network Garage)';
    })(),
    accidentPhotos: get('Accident Photos', 'Accident Photo', 'accidentPhotos', 'accidentPhoto', 'photos', 'photo'),
    firRequired: get('FIR Required?', 'FIR Required', 'firRequired') || 'No',
    firCopy: get('FIR Copy', 'FIR', 'firCopy'),
    policeReport: get('Police Report', 'policeReport', 'Police Report Copy', 'Report'),
    otherDocuments: get('Survey Report / Documents', 'Other Documents', 'Other Document', 'otherDocuments', 'otherDocument', 'Documents', 'Document'),
    paymentReceipt: get('Payment File / Receipt Upload', 'Payment Receipt', 'Payment File', 'Payment Proof', 'Payment Document', 'Receipt', 'paymentReceipt'),
    claimIntimatedDate: get('Claim Intimated Date ', 'Claim Intimated Date', 'Claim Intimated', 'claimIntimatedDate'),
    claimIntimationNo: get('Claim Intimation No. / Ticket', 'Claim Intimation No.', 'Claim Intimation No', 'Claim Intimation', 'claimIntimationNo'),
    surveyorName: get('Surveyor Name', 'Surveyor', 'surveyorName'),
    surveyorMobileNo: get('Surveyor Mobile No.', 'Surveyor Mobile', 'surveyorMobileNo'),
    surveyDate: get('Survey Date', 'surveyDate'),
    surveyStatus: get('Survey Status', 'Survey', 'surveyStatus') || 'Pending',
    claimStatus: get('Claim Current Status', 'Claim Status', 'claimStatus') || 'Claim Under Process',
    claimApprovedAmount: get('Final Approved Claim Amount (₹)', 'Claim Approved Amount (₹)', 'Claim Approved Amount', 'claimApprovedAmount'),
    claimRejectedReason: get('Claim Rejected Reason', 'Rejection Reason', 'claimRejectedReason'),
    expectedSettlementDate: (() => {
      const exp = get('Expected Settlement Date', 'Expected Settlement', 'expectedSettlementDate');
      if (exp && /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(exp)) return exp;
      const m = get('Claim Settlement Mode', 'Claim Mode', 'Settlement Mode', 'claimMode');
      const validM = (m && (m.includes('Cashless') || m.includes('Reimbursement'))) ? m : 'Cashless Claim (Network Garage)';
      const baseD = get('Claim Intimated Date ', 'Claim Intimated Date', 'Claim Intimated', 'claimIntimatedDate') || get('Date of Accident', 'Date Of Accident', 'dateOfAccident') || matchedRepair?.dateOfAccident || today();
      return calculateExpectedSettlementDate(baseD, validM);
    })(),
    claimSettlementDate: get('Actual Settlement Date', 'Settlement Date', 'Claim Settlement Date', 'claimSettlementDate'),
    claimFinalStatus: get('Claim Final Status', 'claimFinalStatus'),
    settlementPaymentMode: get('Settlement / Payout Mode', 'settlementPaymentMode'),
    settlementRefNo: get('Payment Ref. / UTR No.', 'settlementRefNo'),
    settlementRemarks: get('Settlement Closure Remarks', 'settlementRemarks'),
    remarks: get('Survey Assessment & Inspection Remarks', 'Remarks', 'remarks'),
    planned: get('Planned', 'planned'),
    actual: get('Actual', 'actual'),
    delay: get('Delay', 'delay'),
    planned1: get('Planned 1', 'planned1'),
    actual1: get('Actual 1', 'actual1', 'actualDate1'),
    delay1: get('Delay 1', 'delay1'),
    planned2: get('Planned 2', 'planned2'),
    actual2: get('Actual 2', 'actual2', 'actualDate2'),
    delay2: get('Delay 2', 'delay2'),
    stage1Completed: (() => {
      const explicit = get('Stage 1 Completed', 'stage1Completed');
      if (explicit !== undefined && String(explicit).trim() !== '') return explicit === true || explicit === 'true' || explicit === 'Yes';
      const act = get('Actual', 'actual');
      const pol = get('Policy No.', 'Policy No', 'policyNo');
      const est = get('Estimated Claim Amount (₹)', 'Estimated Claim Amount', 'Est. Amount', 'estimatedClaimAmount');
      const st = get('Claim Current Status', 'Claim Status', 'claimStatus');
      const sDate = get('Actual Settlement Date', 'Settlement Date', 'Claim Settlement Date', 'claimSettlementDate');
      return !!(act && String(act).trim() !== '' && String(act).trim() !== '—') || !!(pol && String(pol).trim() !== '') || !!(est && Number(est) > 0) || st === 'Approved' || st === 'Settled' || !!sDate;
    })(),
    stage2Completed: (() => {
      const explicit = get('Stage 2 Completed', 'stage2Completed');
      if (explicit !== undefined && String(explicit).trim() !== '') return explicit === true || explicit === 'true' || explicit === 'Yes';
      const act1 = get('Actual 1', 'actual1');
      if (act1 && String(act1).trim() !== '' && String(act1).trim() !== '—') return true;
      const surv = get('Survey Status', 'Survey', 'surveyStatus');
      const st = get('Claim Current Status', 'Claim Status', 'claimStatus');
      return surv === 'Completed' || st === 'Approved' || st === 'Settled';
    })(),
    stage3Completed: (() => {
      const explicit = get('Stage 3 Completed', 'stage3Completed');
      if (explicit !== undefined && String(explicit).trim() !== '') return explicit === true || explicit === 'true' || explicit === 'Yes';
      const act2 = get('Actual 2', 'actual2');
      if (act2 && String(act2).trim() !== '' && String(act2).trim() !== '—') return true;
      const st = get('Claim Final Status', 'Claim Status', 'claimStatus');
      const sDate = get('Actual Settlement Date', 'Settlement Date', 'claimSettlementDate');
      return st === 'Settled' || st === 'Settled (Approved & Paid)' || (!!sDate && !!act2);
    })(),
    isProcessed: (() => {
      const act = get('Actual', 'actual');
      const pol = get('Policy No.', 'Policy No', 'policyNo');
      return !!(act && String(act).trim() !== '' && String(act).trim() !== '—') || !!(pol && String(pol).trim() !== '');
    })(),
    createdAt: get('Timestamp', 'createdAt') || createTimestamp(),
  };
};

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const seed = () => {
  const version = 'cms_seeded_v11';
  if (localStorage.getItem(version)) return;
  localStorage.setItem(version, 'true');
  localStorage.removeItem(KEYS.DELIVERIES);
  localStorage.removeItem(KEYS.DELIVERY_PLANNING);

  if (getScriptUrl()) {
    // If live Google Sheets connection is configured, initialize empty so sheets are authoritative!
    if (!localStorage.getItem(KEYS.CARS)) localStorage.setItem(KEYS.CARS, JSON.stringify([]));
    if (!localStorage.getItem(KEYS.INSURANCE)) localStorage.setItem(KEYS.INSURANCE, JSON.stringify([]));
    if (!localStorage.getItem(KEYS.REPAIRS)) localStorage.setItem(KEYS.REPAIRS, JSON.stringify([]));
    if (!localStorage.getItem(KEYS.CLAIMS)) localStorage.setItem(KEYS.CLAIMS, JSON.stringify([]));
    if (!localStorage.getItem(KEYS.VENDOR_OFFERS)) localStorage.setItem(KEYS.VENDOR_OFFERS, JSON.stringify([]));
    if (!localStorage.getItem(KEYS.DELIVERIES)) localStorage.setItem(KEYS.DELIVERIES, JSON.stringify([]));
    if (!localStorage.getItem(KEYS.PAYMENTS)) localStorage.setItem(KEYS.PAYMENTS, JSON.stringify([]));
    if (!localStorage.getItem(KEYS.CHALLANS)) localStorage.setItem(KEYS.CHALLANS, JSON.stringify([]));
    if (!localStorage.getItem(KEYS.FASTAGS)) localStorage.setItem(KEYS.FASTAGS, JSON.stringify([]));
    return;
  }

  const cars = [
    {
      vehicleId: 'CAR-0001',
      carName: 'Toyota Fortuner',
      dateOfPurchase: '2024-01-15',
      modelNo: 'FORT-2024',
      companyPurchasedFrom: 'Toyota Motors Delhi',
      fuelType: 'Diesel',
      registrationNo: 'DL-01-AB-1234',
      chassisNo: 'CHS001234567',
      engineNo: 'ENG001234567',
      hypothecationBank: 'HDFC Bank',
      lastEmiDate: '2027-01-15',
      dateOfReleaseHypothecation: '2027-03-01',
      valueOfCar: '3500000',
      emiAmount: '75000',
      insuranceAmount: '45000',
      rtoAmount: '125000',
      companyMobileNo: '9876543210',
      servicePersonName: 'Ramesh Kumar',
      servicePersonMobileNo: '9123456789',
      copyOfInsurance: '',
      copyOfRegistration: '',
      nameOfCompany: 'Acme Corp Pvt Ltd',
      nameOfOwner: 'Mr. Vikram Singh',
      agentName: 'Suresh Sharma',
      dateOfInsurance: '2025-09-10',
      pollutionDate: '2025-09-10',
      timestamp: createTimestamp(),
      createdAt: createTimestamp(),
    },
    {
      vehicleId: 'CAR-0002',
      carName: 'Mahindra Scorpio',
      dateOfPurchase: '2023-06-10',
      modelNo: 'SCOR-2023',
      companyPurchasedFrom: 'Mahindra Showroom Mumbai',
      fuelType: 'Diesel',
      registrationNo: 'MH-02-CD-5678',
      chassisNo: 'CHS009876543',
      engineNo: 'ENG009876543',
      hypothecationBank: 'SBI Bank',
      lastEmiDate: '2026-06-10',
      dateOfReleaseHypothecation: '2026-08-01',
      valueOfCar: '1800000',
      emiAmount: '42000',
      insuranceAmount: '28000',
      rtoAmount: '75000',
      companyMobileNo: '9876543211',
      servicePersonName: 'Ajay Mehta',
      servicePersonMobileNo: '9234567890',
      copyOfInsurance: '',
      copyOfRegistration: '',
      nameOfCompany: 'Acme Corp Pvt Ltd',
      nameOfOwner: 'Ms. Priya Patel',
      agentName: 'Deepak Joshi',
      dateOfInsurance: '2026-05-15',
      pollutionDate: '2026-05-15',
      timestamp: createTimestamp(),
      createdAt: createTimestamp(),
    },
    {
      vehicleId: 'CAR-0003',
      carName: 'Maruti Swift',
      dateOfPurchase: '2023-11-20',
      modelNo: 'SWIFT-2023',
      companyPurchasedFrom: 'Maruti Suzuki Noida',
      fuelType: 'Petrol',
      registrationNo: 'UP-16-EF-9012',
      chassisNo: 'CHS005556789',
      engineNo: 'ENG005556789',
      hypothecationBank: 'ICICI Bank',
      lastEmiDate: '2026-11-20',
      dateOfReleaseHypothecation: '2027-01-01',
      valueOfCar: '750000',
      emiAmount: '18000',
      insuranceAmount: '12000',
      rtoAmount: '30000',
      companyMobileNo: '9876543212',
      servicePersonName: 'Karan Soni',
      servicePersonMobileNo: '9345678901',
      copyOfInsurance: '',
      copyOfRegistration: '',
      nameOfCompany: 'Acme Corp Pvt Ltd',
      nameOfOwner: 'Mr. Anil Gupta',
      agentName: 'Mohit Verma',
      dateOfInsurance: '',
      pollutionDate: '',
      timestamp: createTimestamp(),
      createdAt: createTimestamp(),
    },
  ];

  const insurance = [
    {
      id: 'ins_001',
      vehicleId: 'CAR-0001',
      timestamp: createTimestamp(),
      date: '2025-09-10',
      carName: 'Toyota Fortuner',
      nameOfCompany: 'New India Assurance',
      idvValue: '2800000',
      totalPremiumToBePaid: '45000',
      basicPremium: '32000',
      thirdPartyPremium: '5000',
      addOnPremium: '5000',
      depreciationReimbursement: true,
      engineSecure: true,
      consumableExpenses: false,
      personalBelonging: false,
      roadsideAssistance: true,
      keyReplacement: false,
      emergencyTransportHotel: false,
      taxAmount: '3000',
      totalPremiumAmount: '45000',
      claimedLastYear: 'No',
      policyInclusiveOfNcb: 'Yes',
      premiumOfNcb: '6000',
      cashlessPolicy: 'Yes',
      validityDate: '2026-09-09',
      renewalDate: '2026-09-09',
      createdAt: createTimestamp(),
    },
    {
      id: 'ins_002',
      vehicleId: 'CAR-0002',
      timestamp: createTimestamp(),
      date: '2026-05-15',
      carName: 'Mahindra Scorpio',
      nameOfCompany: 'ICICI Lombard',
      idvValue: '1400000',
      totalPremiumToBePaid: '28000',
      basicPremium: '20000',
      thirdPartyPremium: '4000',
      addOnPremium: '2000',
      depreciationReimbursement: false,
      engineSecure: false,
      consumableExpenses: false,
      personalBelonging: false,
      roadsideAssistance: true,
      keyReplacement: false,
      emergencyTransportHotel: false,
      taxAmount: '2000',
      totalPremiumAmount: '28000',
      claimedLastYear: 'Yes',
      policyInclusiveOfNcb: 'No',
      premiumOfNcb: '0',
      cashlessPolicy: 'Yes',
      validityDate: '2027-05-14',
      renewalDate: '2027-05-14',
      createdAt: createTimestamp(),
    },
  ];

  const repairs = [
    {
      id: 'rep_001',
      repairNo: 'REP-0001',
      vehicleId: 'CAR-0001',
      timestamp: createTimestamp(),
      carName: 'Toyota Fortuner',
      reasonForRepair: 'Front bumper damage due to minor accident',
      garage: 'AutoCare Garage, Sector 18 Noida',
      whoTakingCar: 'Ramesh Kumar',
      insuranceToBeClaimed: 'Yes',
      department: 'Operations',
      repairStatus: 'Created',
      createdAt: createTimestamp(),
    },
    {
      id: 'rep_002',
      repairNo: 'REP-0002',
      vehicleId: 'CAR-0002',
      timestamp: createTimestamp(),
      carName: 'Mahindra Scorpio',
      reasonForRepair: 'Engine oil leak and servicing',
      garage: 'Speed Motors Workshop',
      whoTakingCar: 'Ajay Mehta',
      insuranceToBeClaimed: 'No',
      department: 'Sales',
      repairStatus: 'Created',
      createdAt: createTimestamp(),
    },
  ];

  const claims = [
    {
      id: 'clm_001',
      claimNo: 'CLM-0001',
      repairNo: 'REP-0001',
      vehicleId: 'CAR-0001',
      vehicleName: 'Toyota Fortuner',
      registrationNo: 'DL-01-AB-1234',
      dateOfAccident: '2026-08-20',
      timeOfAccident: '14:30',
      accidentLocation: 'NH-48, Delhi–Gurugram Expressway',
      accidentReason: 'Rear-end collision at traffic signal',
      driverName: 'Ramesh Kumar',
      driverMobileNo: '9123456789',
      insuranceCompany: 'New India Assurance',
      policyNo: 'NIA-2025-001234',
      policyValidity: '2026-09-09',
      insuranceClaim: 'Yes',
      estimatedClaimAmount: '180000',
      accidentPhotos: '',
      firRequired: 'No',
      firCopy: '',
      policeReport: '',
      otherDocuments: '',
      claimIntimatedDate: '2026-08-21',
      claimIntimationNo: 'INT-2026-001',
      surveyorName: 'Mr. Deepak Sharma',
      surveyorMobileNo: '9876501234',
      surveyDate: '2026-08-23',
      surveyStatus: 'Completed',
      claimStatus: 'Claim Under Process',
      claimApprovedAmount: '',
      claimRejectedReason: '',
      claimSettlementDate: '',
      remarks: 'Awaiting claim processing',
      createdAt: createTimestamp(),
    },
  ];

  const vendorOffers = [];
  const deliveryPlanning = [];
  const deliveries = [];
  const payments = [];

  localStorage.setItem(KEYS.CARS, JSON.stringify(cars));
  localStorage.setItem(KEYS.INSURANCE, JSON.stringify(insurance));
  localStorage.setItem(KEYS.REPAIRS, JSON.stringify(repairs));
  localStorage.setItem(KEYS.CLAIMS, JSON.stringify(claims));
  localStorage.setItem(KEYS.VENDOR_OFFERS, JSON.stringify(vendorOffers));
  localStorage.setItem(KEYS.DELIVERY_PLANNING, JSON.stringify(deliveryPlanning));
  localStorage.setItem(KEYS.DELIVERIES, JSON.stringify(deliveries));
  localStorage.setItem(KEYS.PAYMENTS, JSON.stringify(payments));
  if (!localStorage.getItem(KEYS.CHALLANS)) {
    localStorage.setItem(KEYS.CHALLANS, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEYS.FASTAGS)) {
    localStorage.setItem(KEYS.FASTAGS, JSON.stringify([]));
  }
  localStorage.setItem(version, '1');
};

if (!localStorage.getItem(KEYS.CHALLANS)) {
  localStorage.setItem(KEYS.CHALLANS, JSON.stringify([]));
}
if (!localStorage.getItem(KEYS.FASTAGS)) {
  localStorage.setItem(KEYS.FASTAGS, JSON.stringify([]));
}

seed();

const delay = (ms = 0) => Promise.resolve();

// Helper to match sheet keys flexibly from Google Apps Script response
const getSheetDataFromRemote = (remoteData, candidateNames) => {
  if (!remoteData || typeof remoteData !== 'object') return null;
  const normalizedCandidates = candidateNames.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const [key, value] of Object.entries(remoteData)) {
    const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedCandidates.includes(normKey)) {
      return { key, data: value };
    }
  }
  return null;
};

// ─── LIVE 2-WAY SYNC FROM SHEETS ──────────────────────────────────────────────
let isSyncing = false;
export const syncAllFromSheets = async (silent = false) => {
  if (isSyncing) return false;
  isSyncing = true;
  try {
    const remoteData = await fetchFromSheet('getAll');
    if (remoteData) {
      let changed = false;

      // 1. Purchase Car Details
      const carsSheet = getSheetDataFromRemote(remoteData, ['Purchase Car Details', 'Purchase Car', 'cars', 'purchasecardetails', 'purchasecar']);
      if (carsSheet && Array.isArray(carsSheet.data)) {
        const validMappedCars = carsSheet.data.map(mapSheetRowToCar).filter(Boolean);
        const current = load(KEYS.CARS);
        if (JSON.stringify(current) !== JSON.stringify(validMappedCars)) {
          localStorage.setItem(KEYS.CARS, JSON.stringify(validMappedCars));
          changed = true;
        }
      }

      // 1b. EMI On Vehicle (merge EMI loan details into cars)
      const emiSheet = getSheetDataFromRemote(remoteData, ['EMI On Vehicle', 'EMI on Vehicle', 'Vehicle On EMI', 'Vehicle on EMI', 'emionvehicle', 'vehicleonemi', 'emi']);
      if (emiSheet && Array.isArray(emiSheet.data)) {
        const currentCars = load(KEYS.CARS);
        let emiMerged = false;
        const updatedCars = currentCars.map(car => {
          const emiRow = emiSheet.data.find(r => {
            const rowEmiNo = String(r['EMI No'] || r.emiNo || '').trim().toLowerCase();
            if (rowEmiNo && car.emiNo && rowEmiNo === String(car.emiNo).trim().toLowerCase()) return true;

            const rowReg = String(r['REGISTRATION NO.'] || r['Registration No.'] || r['registrationNo'] || '').trim().toLowerCase();
            const carReg = String(car.registrationNo || '').trim().toLowerCase();
            if (rowReg && carReg && rowReg === carReg) return true;

            const rowVid = String(r['Vehicle ID'] || r['vehicleId'] || '').trim().toLowerCase();
            const carVid = String(car.vehicleId || '').trim().toLowerCase();
            if (rowVid && carVid && rowVid === carVid) return true;

            // Match by numeric index (e.g. EMI-0002 matches CAR-0002)
            const emiNum = rowEmiNo.replace(/[^0-9]/g, '');
            const carNum = String(car.vehicleId || '').replace(/[^0-9]/g, '');
            return !!(emiNum && carNum && parseInt(emiNum, 10) === parseInt(carNum, 10));
          });
          if (!emiRow) return car;

          emiMerged = true;
          return {
            ...car,
            hasEmi: true,
            emiStatus: 'Yes',
            emiNo: emiRow['EMI No'] || car.emiNo || '',
            hypothecationBank: emiRow['HYPOTHICATION BANK'] || emiRow['Hypothecation Bank'] || car.hypothecationBank || '',
            loanAmount: emiRow['Total Loan Amount (₹)'] || emiRow['LOAN AMOUNT'] || emiRow['Loan Amount'] || car.loanAmount || '',
            emiAmount: emiRow['Monthly EMI Amount (₹)'] || emiRow['EMI AMOUNT'] || emiRow['EMI Amount'] || car.emiAmount || '',
            emiStartDate: emiRow['EMI Start Date'] || emiRow['EMI START DATE'] || car.emiStartDate || '',
            lastEmiDate: emiRow['Last EMI Date'] || emiRow['LAST EMI DATE'] || car.lastEmiDate || '',
            dateOfReleaseHypothecation: emiRow['DATE OF RELEASE OF HYPOTHICATION'] || car.dateOfReleaseHypothecation || '',
            totalEmis: emiRow['Total Tenure (Months / Total EMIs)'] || emiRow['TOTAL EMIS'] || emiRow['Total EMIs'] || car.totalEmis || '',
            paidEmis: emiRow['EMIs Paid So Far (Count)'] || emiRow['PAID EMIS'] || emiRow['Paid EMIs'] || car.paidEmis || '',
            paidEmiAmount: emiRow['Amount Paid So Far (₹) (अब तक पे किया)'] || emiRow['PAID EMI AMOUNT'] || car.paidEmiAmount || '',
            remainingLoanAmount: emiRow['Remaining Balance to Pay (₹) (बाकी है)'] || emiRow['REMAINING LOAN AMOUNT'] || car.remainingLoanAmount || '',
          };
        });
        if (emiMerged && JSON.stringify(currentCars) !== JSON.stringify(updatedCars)) {
          localStorage.setItem(KEYS.CARS, JSON.stringify(updatedCars));
          changed = true;
        }
      }

      // 2. Repairs (FMS / Car_Repair) + Vendor Offers + Deliveries + Payments
      const fmsSheet = getSheetDataFromRemote(remoteData, ['FMS', 'Car Repair', 'Car_Repair', 'repairs', 'fms']);
      if (fmsSheet && Array.isArray(fmsSheet.data)) {
        const validMappedRepairs = fmsSheet.data.map(mapSheetRowToRepair).filter(Boolean);
        const currentRepairs = load(KEYS.REPAIRS);
        if (JSON.stringify(currentRepairs) !== JSON.stringify(validMappedRepairs)) {
          localStorage.setItem(KEYS.REPAIRS, JSON.stringify(validMappedRepairs));
          changed = true;
        }

        // Also sync submitted vendor offers from FMS sheet
        const currentOffers = load(KEYS.VENDOR_OFFERS);
        const fmsOffers = [];
        validMappedRepairs.forEach(r => {
          const hasOffer = r.actualDate || r.photoOfOffer || (Array.isArray(r.typesOfRepair) && r.typesOfRepair.length > 0) || (typeof r.typesOfRepair === 'string' && r.typesOfRepair.length > 0);
          if (hasOffer) {
            const existingOffer = currentOffers.find(o => o.repairNo === r.repairNo);
            const typesArr = Array.isArray(r.typesOfRepair) ? r.typesOfRepair : (typeof r.typesOfRepair === 'string' ? r.typesOfRepair.split(',').map(s => s.trim()).filter(Boolean) : []);
            const isApproved = !!(r.actualDate2 || existingOffer?.approvalStatus === 'Approved' || r.repairStatus === 'Approved');

            fmsOffers.push({
              id: existingOffer?.id || `offer_${r.repairNo}`,
              repairNo: r.repairNo,
              vehicleId: r.vehicleId,
              carName: r.carName,
              garageName: r.garageName || r.garage || existingOffer?.garageName || '',
              expectedCompletionDate: r.expectedCompletionDate || existingOffer?.expectedCompletionDate || '',
              plannedDate: r.plannedDate || '',
              actualDate: r.actualDate || '',
              plannedDate2: r.plannedDate2 || '',
              actualDate2: r.actualDate2 || existingOffer?.actualDate2 || '',
              photoOfOffer: r.photoOfOffer,
              insurance: r.insurance || 'No',
              typesOfRepair: typesArr,
              approvalStatus: isApproved ? 'Approved' : (r.repairStatus === 'Rejected' ? 'Rejected' : 'Pending'),
              approvedAt: r.actualDate2 || existingOffer?.approvedAt || '',
              timestamp: r.actualDate || r.timestamp,
              createdAt: r.actualDate || r.createdAt
            });
          }
        });

        if (JSON.stringify(currentOffers) !== JSON.stringify(fmsOffers)) {
          localStorage.setItem(KEYS.VENDOR_OFFERS, JSON.stringify(fmsOffers));
          changed = true;
        }

        // Also sync submitted deliveries from FMS sheet
        const currentDeliveries = load(KEYS.DELIVERIES);
        const fmsDeliveries = [];
        validMappedRepairs.forEach(r => {
          if (r.actualDate3 || r.dateVehicleReceived) {
            const existingDel = currentDeliveries.find(d => d.repairNo === r.repairNo);
            fmsDeliveries.push({
              id: existingDel?.id || `del_${r.repairNo}`,
              repairNo: r.repairNo,
              vehicleId: r.vehicleId,
              vehicleName: r.carName || existingDel?.vehicleName || '',
              garageName: r.garageName || existingDel?.garageName || '',
              dateVehicleReceived: r.dateVehicleReceived || existingDel?.dateVehicleReceived || '',
              kmAtTimeOfRepair: r.kmAtTimeOfRepair || existingDel?.kmAtTimeOfRepair || '',
              repairWorkDone: r.repairWorkDone || existingDel?.repairWorkDone || '',
              partsAmount: r.partsAmount || existingDel?.partsAmount || '',
              serviceAmount: r.serviceAmount || existingDel?.serviceAmount || '',
              insuranceClaimed: r.insuranceClaimed || existingDel?.insuranceClaimed || 'No',
              insuranceAmount: r.insuranceAmount || existingDel?.insuranceAmount || '',
              billAmount: r.billAmount || existingDel?.billAmount || '',
              billImage: r.billImage || existingDel?.billImage || '',
              deliveryStatus: 'Delivery Submitted',
              deliveredAt: r.actualDate3 || existingDel?.deliveredAt || '',
              actualDate3: r.actualDate3 || existingDel?.actualDate3 || '',
              submittedAt: r.actualDate3 || existingDel?.submittedAt || '',
              timestamp: r.actualDate3 || r.timestamp,
            });
          }
        });

        if (JSON.stringify(currentDeliveries) !== JSON.stringify(fmsDeliveries)) {
          localStorage.setItem(KEYS.DELIVERIES, JSON.stringify(fmsDeliveries));
          changed = true;
        }

        // Also sync payments from repairs/deliveries
        const currentPayments = load(KEYS.PAYMENTS);
        const fmsPayments = [];
        validMappedRepairs.forEach(r => {
          if (r.actualDate3 || r.dateVehicleReceived || r.repairStatus === 'Delivered' || r.repairStatus === 'Payment Completed') {
            const existingPay = currentPayments.find(p => p.repairNo === r.repairNo);
            fmsPayments.push({
              id: existingPay?.id || `pay_${r.repairNo}`,
              repairNo: r.repairNo,
              vehicleId: r.vehicleId,
              carName: r.carName,
              garageName: r.garageName || r.garage || existingPay?.garageName || '',
              billAmount: r.billAmount || existingPay?.billAmount || '0',
              paymentStatus: r.repairStatus === 'Payment Completed' ? 'Payment Completed' : (existingPay?.paymentStatus || 'Payment Pending'),
              paymentMethod: existingPay?.paymentMethod || 'Bank Transfer',
              paidAmount: existingPay?.paidAmount || r.billAmount || '0',
              paymentDate: existingPay?.paymentDate || r.actualDate3 || '',
              notes: existingPay?.notes || '',
              timestamp: r.actualDate3 || r.timestamp,
            });
          }
        });

        if (JSON.stringify(currentPayments) !== JSON.stringify(fmsPayments)) {
          localStorage.setItem(KEYS.PAYMENTS, JSON.stringify(fmsPayments));
          changed = true;
        }
      }

      // 3. Claims
      const claimsSheet = getSheetDataFromRemote(remoteData, ['If Accident / Insurance Claims', 'claims', 'accidentclaims', 'accident_claims', 'ifaccidentinsuranceclaims']);
      if (claimsSheet && Array.isArray(claimsSheet.data)) {
        const rawMapped = claimsSheet.data.map(mapSheetRowToClaim).filter(Boolean);
        // Deduplicate claims so duplicate rows in sheet don't flood UI
        const seenRepairs = new Set();
        const seenClaims = new Set();
        const validMappedClaims = [];
        for (const c of rawMapped) {
          if (c.repairNo) {
            if (seenRepairs.has(c.repairNo)) continue;
            seenRepairs.add(c.repairNo);
          }
          if (c.claimNo) {
            if (seenClaims.has(c.claimNo)) continue;
            seenClaims.add(c.claimNo);
          }
          validMappedClaims.push(c);
        }
        const currentClaims = load(KEYS.CLAIMS);
        const mergedClaims = validMappedClaims.map(c => {
          const existing = currentClaims.find(ec => (ec.claimNo && ec.claimNo === c.claimNo) || (ec.repairNo && ec.repairNo === c.repairNo));
          if (!existing) return c;

          const hasSheetActual = !!(c.actual && String(c.actual).trim() !== '' && String(c.actual).trim() !== '—');
          const hasSheetPolicy = !!(c.policyNo && String(c.policyNo).trim() !== '');
          const hasSheetEst = !!(c.estimatedClaimAmount && Number(c.estimatedClaimAmount) > 0);
          const isSheetSubmitted = hasSheetActual || hasSheetPolicy || hasSheetEst;

          const merged = { ...existing };

          if (!isSheetSubmitted) {
            // Sheet has no process claim details -> reset to Pending!
            merged.stage1Completed = false;
            merged.stage2Completed = false;
            merged.stage3Completed = false;
            merged.isProcessed = false;
            merged.actual = '';
            merged.policyNo = '';
            merged.insuranceCompany = c.insuranceCompany || '';
            merged.estimatedClaimAmount = '';
            merged.typeOfClaim = '';
            merged.policyValidity = '';
            merged.firRequired = 'No';
            merged.claimMode = '';
            merged.expectedSettlementDate = '';
            merged.accidentPhotos = null;
            merged.policeReport = null;
            merged.otherDocuments = null;
            merged.claimStatus = 'Pending Submission';
            merged.claimSettlementDate = '';
            merged.surveyStatus = 'Pending';
            // Sync incident fields from sheet
            for (const [key, val] of Object.entries(c)) {
              if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '—') {
                merged[key] = val;
              }
            }
          } else {
            for (const [key, val] of Object.entries(c)) {
              if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '—') {
                merged[key] = val;
              }
            }
            merged.stage1Completed = c.stage1Completed !== undefined ? c.stage1Completed : (existing.stage1Completed || false);
            merged.stage2Completed = c.stage2Completed !== undefined ? c.stage2Completed : (existing.stage2Completed || false);
            merged.stage3Completed = c.stage3Completed !== undefined ? c.stage3Completed : (existing.stage3Completed || false);
            merged.isProcessed = c.isProcessed !== undefined ? c.isProcessed : (existing.isProcessed || false);
            merged.actual = c.actual || existing.actual || '';
            if (!merged.claimMode || merged.claimMode === 'Pending' || (!merged.claimMode.includes('Cashless') && !merged.claimMode.includes('Reimbursement'))) {
              merged.claimMode = 'Cashless Claim (Network Garage)';
            }
            if (!merged.expectedSettlementDate || merged.expectedSettlementDate === 'Claim Under Process' || !/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(merged.expectedSettlementDate)) {
              merged.expectedSettlementDate = calculateExpectedSettlementDate(merged.claimIntimatedDate || merged.dateOfAccident || today(), merged.claimMode);
            }
          }
          return merged;
        });

        if (JSON.stringify(currentClaims) !== JSON.stringify(mergedClaims)) {
          localStorage.setItem(KEYS.CLAIMS, JSON.stringify(mergedClaims));
          changed = true;
        }
      }

      // 4. Insurance
      const insSheet = getSheetDataFromRemote(remoteData, ['Insurance Of Vehicle', 'Insurance of Vehicle', 'Insurance_Of_Vehicle', 'insurance']);
      if (insSheet && Array.isArray(insSheet.data)) {
        const mappedIns = insSheet.data.map(mapSheetRowToInsurance).filter(Boolean);
        const currentIns = load(KEYS.INSURANCE);
        if (JSON.stringify(currentIns) !== JSON.stringify(mappedIns)) {
          localStorage.setItem(KEYS.INSURANCE, JSON.stringify(mappedIns));
          changed = true;
        }
      }

      // 5. Challans
      const challansSheet = getSheetDataFromRemote(remoteData, ['Challan Details', 'Challans', 'challans', 'Challan']);
      if (challansSheet && Array.isArray(challansSheet.data)) {
        const mappedChallans = challansSheet.data.map(mapSheetRowToChallan).filter(Boolean);
        const currentChallans = load(KEYS.CHALLANS);
        if (JSON.stringify(currentChallans) !== JSON.stringify(mappedChallans)) {
          localStorage.setItem(KEYS.CHALLANS, JSON.stringify(mappedChallans));
          changed = true;
        }
      }

      // 6. Fastags
      const fastagSheet = getSheetDataFromRemote(remoteData, ['Fastag Details', 'Fastags', 'fastag', 'Fastag']);
      if (fastagSheet && Array.isArray(fastagSheet.data)) {
        const mappedFastags = fastagSheet.data.map(mapSheetRowToFastag).filter(Boolean);
        const currentFastags = load(KEYS.FASTAGS);
        if (JSON.stringify(currentFastags) !== JSON.stringify(mappedFastags)) {
          localStorage.setItem(KEYS.FASTAGS, JSON.stringify(mappedFastags));
          changed = true;
        }
      }

      // 7. Login Page / Users
      const loginSheet = getSheetDataFromRemote(remoteData, ['Login Page', 'loginpage', 'Login', 'Users']);
      if (loginSheet && Array.isArray(loginSheet.data)) {
        const mappedUsers = loginSheet.data.map(mapSheetRowToUser).filter(Boolean);
        if (mappedUsers.length > 0) {
          const currentUsersRaw = localStorage.getItem('cms_users');
          const currentUsers = currentUsersRaw ? JSON.parse(currentUsersRaw) : [];
          if (JSON.stringify(currentUsers) !== JSON.stringify(mappedUsers)) {
            localStorage.setItem('cms_users', JSON.stringify(mappedUsers));
            changed = true;
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('cms_users_updated', { detail: mappedUsers }));
            }
          }
        }
      }

      if (changed) {
        notifyStoreUpdate();
      }
      return true;
    }
    return false;
  } catch (err) {
    if (!silent) console.warn('Sync error:', err);
    return false;
  } finally {
    isSyncing = false;
  }
};

// ─── BACKGROUND LIVE SYNC INITIALIZER ─────────────────────────────────────────
export const initLiveSyncService = (intervalMs = 5000) => {
  if (typeof window === 'undefined') return;

  syncAllFromSheets(true);

  const intervalId = setInterval(() => {
    if (document.visibilityState === 'visible') {
      syncAllFromSheets(true);
    }
  }, intervalMs);

  const onFocus = () => syncAllFromSheets(true);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncAllFromSheets(true);
    }
  });

  return () => {
    clearInterval(intervalId);
    window.removeEventListener('focus', onFocus);
  };
};

// ─── CARS CRUD ────────────────────────────────────────────────────────────────
export const getCars = async () => {
  await delay();
  return load(KEYS.CARS);
};

export const addCar = async (car) => {
  const cars = load(KEYS.CARS);
  const nowFormatted = createTimestamp();
  const carWithTimestamp = {
    ...car,
    timestamp: car.timestamp || nowFormatted,
    createdAt: car.createdAt || nowFormatted,
  };
  cars.push(carWithTimestamp);
  save(KEYS.CARS, cars);

  const payload = mapCarToSheet(carWithTimestamp);
  await sendToSheet({
    action: 'add',
    sheetName: 'Purchase Car Details',
    data: payload
  });

  // Sync to EMI On Vehicle sheet if car has EMI
  if (carWithTimestamp.hasEmi === true || carWithTimestamp.hasEmi === 'Yes' || carWithTimestamp.emiStatus === 'Yes' || checkHasEmi(carWithTimestamp)) {
    try {
      await syncEmiToSheet(carWithTimestamp);
    } catch (e) {
      console.warn('EMI On Vehicle sync error:', e);
    }
  }

  return carWithTimestamp;
};

export const updateCar = async (vehicleId, updates) => {
  const cars = load(KEYS.CARS);
  const idx = cars.findIndex(c => c.vehicleId === vehicleId);
  if (idx === -1) throw new Error('Car not found');
  cars[idx] = { ...cars[idx], ...updates, updatedAt: createTimestamp() };
  save(KEYS.CARS, cars);

  const payload = mapCarToSheet(cars[idx]);
  await sendToSheet({
    action: 'update',
    sheetName: 'Purchase Car Details',
    keyField: 'REGISTRATION NO.',
    keyValue: cars[idx].registrationNo,
    data: payload
  });

  // Sync to EMI On Vehicle sheet if car has EMI
  if (cars[idx].hasEmi === true || cars[idx].hasEmi === 'Yes' || cars[idx].emiStatus === 'Yes' || checkHasEmi(cars[idx])) {
    try {
      await syncEmiToSheet(cars[idx]);
    } catch (e) {
      console.warn('EMI On Vehicle sync error:', e);
    }
  }

  return cars[idx];
};

export const deleteCar = async (vehicleId) => {
  const cars = load(KEYS.CARS);
  const carToDelete = cars.find(c => c.vehicleId === vehicleId);
  const remaining = cars.filter(c => c.vehicleId !== vehicleId);
  save(KEYS.CARS, remaining);

  if (carToDelete) {
    const keyField = carToDelete.registrationNo ? 'REGISTRATION NO.' : 'Vehicle ID';
    const keyValue = carToDelete.registrationNo || carToDelete.vehicleId;
    await sendToSheet({
      action: 'delete',
      sheetName: 'Purchase Car Details',
      keyField,
      keyValue,
      data: { [keyField]: keyValue }
    });

    if (carToDelete.hasEmi === true || carToDelete.hasEmi === 'Yes' || carToDelete.emiStatus === 'Yes' || checkHasEmi(carToDelete)) {
      try {
        await sendToSheet({
          action: 'delete',
          sheetName: 'EMI On Vehicle',
          keyField,
          keyValue,
          data: { [keyField]: keyValue }
        });
      } catch (e) {
        console.warn('Delete from EMI On Vehicle error:', e);
      }
    }
  }
};

// ─── INSURANCE CRUD ───────────────────────────────────────────────────────────
export const getInsurance = async () => {
  await delay();
  return load(KEYS.INSURANCE);
};

export const addInsurance = async (ins) => {
  const all = load(KEYS.INSURANCE);
  const now = createTimestamp();
  const insuranceId = ins.insuranceId || generateInsuranceId(all);
  const item = { ...ins, insuranceId, timestamp: now, createdAt: now };
  all.push(item);
  save(KEYS.INSURANCE, all);
  await sendToSheet({ action: 'add', sheetName: 'Insurance Of Vehicle', data: mapInsuranceToSheet(item, all) });

  // Also update vehicle master in Purchase Car Details
  if (item.vehicleId) {
    const cars = load(KEYS.CARS);
    const carIdx = cars.findIndex(c => c.vehicleId === item.vehicleId);
    if (carIdx !== -1) {
      cars[carIdx].hasInsurance = true;
      cars[carIdx].insurance = 'Yes';
      if (item.date || item.dateOfInsurance) cars[carIdx].dateOfInsurance = item.date || item.dateOfInsurance;
      if (item.nameOfCompany) cars[carIdx].nameOfCompany = item.nameOfCompany;
      if (item.totalPremiumAmount || item.totalPremiumToBePaid) {
        cars[carIdx].insuranceAmount = item.totalPremiumAmount || item.totalPremiumToBePaid;
      }
      cars[carIdx].updatedAt = now;
      save(KEYS.CARS, cars);
      sendToSheet({
        action: 'update',
        sheetName: 'Purchase Car Details',
        keyField: 'REGISTRATION NO.',
        keyValue: cars[carIdx].registrationNo,
        data: mapCarToSheet(cars[carIdx])
      });
    }
  }

  return item;
};

export const updateInsurance = async (id, updates) => {
  const all = load(KEYS.INSURANCE);
  const idx = all.findIndex(i => i.id === id || i.insuranceId === id || i.vehicleId === id);
  if (idx === -1) throw new Error('Insurance not found');
  const insuranceId = all[idx].insuranceId || updates.insuranceId || generateInsuranceId(all);
  all[idx] = { ...all[idx], ...updates, insuranceId, updatedAt: createTimestamp() };
  save(KEYS.INSURANCE, all);
  const keyField = all[idx].insuranceId ? 'Insurance ID' : (all[idx].vehicleId ? 'Vehicle ID' : 'Car Name');
  const keyValue = all[idx].insuranceId || all[idx].vehicleId || all[idx].carName;
  await sendToSheet({ action: 'update', sheetName: 'Insurance Of Vehicle', keyField, keyValue, data: mapInsuranceToSheet(all[idx], all) });
  return all[idx];
};

export const renewInsurance = async (vehicleId, renewalData) => {
  const all = load(KEYS.INSURANCE);
  const idx = all.findIndex(i => (vehicleId && i.vehicleId === vehicleId) || (renewalData.insuranceId && i.insuranceId === renewalData.insuranceId) || (renewalData.carName && i.carName === renewalData.carName));
  const now = createTimestamp();
  
  // 1. Keep original Insurance ID intact and untouched!
  const originalInsuranceId = (idx !== -1 && all[idx].insuranceId) ? all[idx].insuranceId : (renewalData.insuranceId || generateInsuranceId(all));
  
  // 2. Renewal ID with "REINS-" prefix
  const renewalId = renewalData.renewalId || generateRenewalId(all);
  
  const updatedRecord = {
    ...(idx !== -1 ? all[idx] : {}),
    ...renewalData,
    insuranceId: originalInsuranceId, // Untouched original ID!
    renewalId: renewalId,             // REINS-0001
    vehicleId: vehicleId || (idx !== -1 ? all[idx].vehicleId : ''),
    timestamp: now,
    updatedAt: now,
  };
  
  if (idx !== -1) {
    all[idx] = updatedRecord;
    const keyField = updatedRecord.vehicleId ? 'Vehicle ID' : (originalInsuranceId ? 'Insurance ID' : 'Car Name');
    const keyValue = updatedRecord.vehicleId || originalInsuranceId || updatedRecord.carName;
    sendToSheet({ action: 'update', sheetName: 'Insurance Of Vehicle', keyField, keyValue, data: mapInsuranceToSheet(updatedRecord, all) });
  } else {
    const newId = `ins_${Date.now()}`;
    const newRecord = { ...updatedRecord, id: newId, createdAt: now };
    all.push(newRecord);
    sendToSheet({ action: 'add', sheetName: 'Insurance Of Vehicle', data: mapInsuranceToSheet(newRecord, all) });
  }
  save(KEYS.INSURANCE, all);
  
  // 3. Save to local renewals history and sync each renewed cover row to Google Sheets "Insurance Renewal"
  try {
    const renewals = load(KEYS.RENEWALS);
    const renewalRows = mapInsuranceRenewalRows(updatedRecord);
    renewalRows.forEach(r => renewals.push({ ...r, id: `ren_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` }));
    save(KEYS.RENEWALS, renewals);
    sendToSheet({ action: 'add', sheetName: 'Insurance Renewal', data: renewalRows });
  } catch (err) {
    console.error('Failed to log to Insurance Renewal sheet:', err);
  }
  
  // Also update vehicle's master dateOfInsurance & Insurance of Vehicle = Yes
  const cars = load(KEYS.CARS);
  const carIdx = cars.findIndex(c => c.vehicleId === vehicleId || c.carName === renewalData.carName);
  if (carIdx !== -1) {
    cars[carIdx].hasInsurance = true;
    cars[carIdx].insurance = 'Yes';
    if (renewalData.date) cars[carIdx].dateOfInsurance = renewalData.date;
    if (renewalData.nameOfCompany) cars[carIdx].nameOfCompany = renewalData.nameOfCompany;
    if (renewalData.totalPremiumAmount || renewalData.totalPremiumToBePaid) {
      cars[carIdx].insuranceAmount = renewalData.totalPremiumAmount || renewalData.totalPremiumToBePaid;
    }
    cars[carIdx].updatedAt = now;
    save(KEYS.CARS, cars);
    sendToSheet({
      action: 'update',
      sheetName: 'Purchase Car Details',
      keyField: 'REGISTRATION NO.',
      keyValue: cars[carIdx].registrationNo,
      data: mapCarToSheet(cars[carIdx])
    });
  }
  return updatedRecord;
};

export const syncInsuranceToSheet = async (car, insData = {}) => {
  if (!car) return;
  const isIns = car.hasInsurance === 'Yes' || car.hasInsurance === true || car.insurance === 'Yes' || (car.dateOfInsurance && car.dateOfInsurance !== '');
  if (!isIns) return;

  const allIns = load(KEYS.INSURANCE);
  const existingIdx = allIns.findIndex(i => (car.vehicleId && i.vehicleId === car.vehicleId) || (car.carName && i.carName === car.carName));
  const existing = existingIdx !== -1 ? allIns[existingIdx] : null;

  const insuranceId = existing?.insuranceId || insData?.insuranceId || generateInsuranceId(allIns);
  const mergedIns = {
    ...(existing || {}),
    ...insData,
    insuranceId,
    vehicleId: car.vehicleId || existing?.vehicleId || '',
    carName: car.carName || existing?.carName || '',
    date: insData.date || car.dateOfInsurance || existing?.date || today(),
    nameOfCompany: insData.nameOfCompany || car.nameOfCompany || existing?.nameOfCompany || '',
    agentName: insData.agentName || car.agentName || existing?.agentName || '',
    dateOfInsurance: insData.dateOfInsurance || car.dateOfInsurance || existing?.dateOfInsurance || existing?.date || today(),
    timestamp: createTimestamp(),
  };

  if (existingIdx !== -1) {
    allIns[existingIdx] = mergedIns;
  } else {
    allIns.push(mergedIns);
  }
  save(KEYS.INSURANCE, allIns);

  const payload = mapInsuranceToSheet(mergedIns, allIns);
  return await sendToSheet({
    action: 'update',
    sheetName: 'Insurance Of Vehicle',
    keyField: 'Insurance ID',
    keyValue: payload['Insurance ID'],
    data: payload
  });
};

export const deleteInsurance = async (id) => {
  const all = load(KEYS.INSURANCE);
  const item = all.find(i => i.id === id || i.vehicleId === id || i.carName === id);
  const remaining = all.filter(i => i.id !== id && i.vehicleId !== id && i.carName !== id);
  save(KEYS.INSURANCE, remaining);
  if (item) {
    const keyField = item.carName ? 'Car Name' : 'Vehicle ID';
    const keyValue = item.carName || item.vehicleId;
    await sendToSheet({
      action: 'delete',
      sheetName: 'Insurance Of Vehicle',
      keyField,
      keyValue,
      data: { [keyField]: keyValue }
    });
  }
};

// ─── REPAIRS CRUD (SYNC TO "FMS") ─────────────────────────────────────────────
export const getRepairs = async () => {
  await delay();
  return load(KEYS.REPAIRS);
};

// Maps a claim record to the exact "If Accident / Insurance Claims" sheet headers:
export const claimToSheetRow = (item, isInitialSync = false) => {
  const repairs = load(KEYS.REPAIRS);
  const matchedRepair = item.repairNo ? repairs.find(r => r.repairNo === item.repairNo) : null;
  const cars = load(KEYS.CARS);
  const matchedCar = (item.vehicleId || matchedRepair?.vehicleId) ? cars.find(c => c.vehicleId === (item.vehicleId || matchedRepair?.vehicleId)) : null;

  const vehicle = item.vehicleName || item.carName || matchedRepair?.carName || matchedCar?.carName || '';
  const reason = item.reasonForRepair || item.accidentReason || matchedRepair?.reasonForRepair || '';
  const dept = item.department || matchedRepair?.department || '';
  const vehId = item.vehicleId || matchedRepair?.vehicleId || matchedCar?.vehicleId || '';
  const regNo = item.registrationNo || matchedRepair?.registrationNo || matchedCar?.registrationNo || '';
  const dateAcc = item.dateOfAccident || matchedRepair?.dateOfAccident || today();
  const accLoc = item.accidentLocation || '';
  const timeAcc = item.timeOfAccident || matchedRepair?.timeOfAccident || '';
  const driver = item.driverName || matchedRepair?.whoTakingCar || matchedRepair?.driverName || '';
  const mobile = item.driverMobileNo || item.driverMobile || matchedRepair?.driverMobileNo || '';

  const row = {
    'Timestamp': item.timestamp || item.createdAt || createTimestamp(),
    'Claim No.': item.claimNo || '',
    'Repair No.': item.repairNo || '',
    'Vehicle ID': vehId,
    'Vehicle': vehicle,
    'Car Name': vehicle,
    'Vehicle Name': vehicle,
    'Registration No.': regNo,
    'Reason For Repair': reason,
    'Reason for Repair': reason,
    'accidentReason': reason,
    'Department': dept,
    'Departmen': dept,
  };

  // Only include process claim details if the claim has been explicitly submitted/processed!
  const isSubmitted = !isInitialSync && !!(item.isProcessed || item.actual || item.stage1Completed);
  if (isSubmitted) {
    if (item.actual) row['Actual'] = item.actual;
    // Process Claim Details (Cols L to AA):
    row['Date of Accident'] = dateAcc;
    row['Accident Location'] = accLoc;
    row['Time of Accident'] = timeAcc;
    row['Driver Name'] = driver;
    row['Driver Mobile'] = mobile;
    if (item.policyNo) row['Policy No.'] = item.policyNo;
    if (item.insuranceCompany) row['Insurance Company'] = item.insuranceCompany;
    if (item.estimatedClaimAmount !== undefined && item.estimatedClaimAmount !== '') {
      row['Estimated Claim Amount (₹)'] = item.estimatedClaimAmount;
    }
    if (item.typeOfClaim) row['Type Of Claim'] = item.typeOfClaim;
    if (item.policyValidity) row['Policy Validity'] = item.policyValidity;
    if (item.firRequired) row['FIR Required?'] = item.firRequired;

    const finalMode = (item.claimMode && (item.claimMode.includes('Cashless') || item.claimMode.includes('Reimbursement')))
      ? item.claimMode
      : 'Cashless Claim (Network Garage)';
    row['Claim Settlement Mode'] = finalMode;
    row['Claim Mode'] = finalMode;

    const finalExp = (item.expectedSettlementDate && /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(item.expectedSettlementDate))
      ? item.expectedSettlementDate
      : calculateExpectedSettlementDate(item.claimIntimatedDate || dateAcc || today(), finalMode);
    row['Expected Settlement Date'] = finalExp;

    if (item.surveyStatus) {
      row['Survey Status'] = item.surveyStatus;
      row['Survey'] = item.surveyStatus;
    }
    if (item.claimStatus) {
      row['Claim Current Status'] = item.claimStatus;
      row['Claim Status'] = item.claimStatus;
    }
    if (item.claimIntimatedDate) {
      row['Claim Intimated Date '] = item.claimIntimatedDate;
      row['Claim Intimated Date'] = item.claimIntimatedDate;
    }
    if (item.claimIntimationNo) {
      row['Claim Intimation No. / Ticket'] = item.claimIntimationNo;
      row['Claim Intimation No.'] = item.claimIntimationNo;
    }
    if (item.surveyorName) row['Surveyor Name'] = item.surveyorName;
    if (item.surveyorMobileNo) row['Surveyor Mobile No.'] = item.surveyorMobileNo;
    if (item.surveyDate) row['Survey Date'] = item.surveyDate;
    if (item.remarks) {
      row['Survey Assessment & Inspection Remarks'] = item.remarks;
      row['Remarks'] = item.remarks;
    }
    if (item.actual1) row['Actual 1'] = item.actual1;
    if (item.actual2) row['Actual 2'] = item.actual2;
    if (item.claimApprovedAmount) {
      row['Final Approved Claim Amount (₹)'] = item.claimApprovedAmount;
      row['Claim Approved Amount'] = item.claimApprovedAmount;
    }
    if (item.claimSettlementDate) {
      row['Actual Settlement Date'] = item.claimSettlementDate;
      row['Settlement Date'] = item.claimSettlementDate;
    }
    if (item.claimFinalStatus || item.claimStatus) {
      row['Claim Final Status'] = item.claimFinalStatus || item.claimStatus;
    }
    if (item.settlementPaymentMode) {
      row['Settlement / Payout Mode'] = item.settlementPaymentMode;
    }
    if (item.settlementRefNo) {
      row['Payment Ref. / UTR No.'] = item.settlementRefNo;
    }
    if (item.settlementRemarks) {
      row['Settlement Closure Remarks'] = item.settlementRemarks;
    }
    if (item.accidentPhotos) {
      row['Accident Photos'] = typeof item.accidentPhotos === 'object' ? (item.accidentPhotos?.url || '') : (item.accidentPhotos || '');
    }
    if (item.policeReport) {
      row['Police Report'] = typeof item.policeReport === 'object' ? (item.policeReport?.url || '') : (item.policeReport || '');
    }
    if (item.otherDocuments) {
      const docVal = typeof item.otherDocuments === 'object' ? (item.otherDocuments?.url || '') : (item.otherDocuments || '');
      row['Survey Report / Documents'] = docVal;
      row['Other Documents'] = docVal;
    }
    if (item.paymentReceipt) {
      const pVal = typeof item.paymentReceipt === 'object' ? (item.paymentReceipt?.url || '') : item.paymentReceipt;
      row['Payment File / Receipt Upload'] = pVal;
      row['Payment Receipt'] = pVal;
      row['Payment File'] = pVal;
      row['Payment Proof'] = pVal;
    }
  }

  return row;
};

// Guard to prevent concurrent duplicate autoSync for the same repair
const syncingRepairNos = new Set();

// ─── AUTOMATICALLY SYNC REPAIR WITH ACCIDENT CLAIM ───────────────────────────
export const autoSyncRepairClaim = async (repairItem) => {
  if (!repairItem || (repairItem.insuranceToBeClaimed !== 'Yes' && repairItem.insuranceClaimed !== 'Yes')) {
    return null;
  }
  
  const repNo = repairItem.repairNo;
  if (!repNo || syncingRepairNos.has(repNo)) {
    return null;
  }

  syncingRepairNos.add(repNo);
  try {
    const allClaims = load(KEYS.CLAIMS);
    const existingClaim = allClaims.find(c => c.repairNo && c.repairNo === repNo);
    const now = createTimestamp();

    // Resolve vehicle name, reason, department, registrationNo robustly
    const cars = load(KEYS.CARS);
    const matchedCar = repairItem.vehicleId ? cars.find(c => c.vehicleId === repairItem.vehicleId) : null;
    const resolvedVehicleName = repairItem.carName || repairItem.vehicleName || matchedCar?.carName || '';
    const resolvedReason = repairItem.reasonForRepair || repairItem.accidentReason || '';
    const resolvedDept = repairItem.department || '';
    const resolvedRegNo = repairItem.registrationNo || matchedCar?.registrationNo || '';
    const resolvedDriverName = repairItem.whoTakingCar || repairItem.driverName || '';
    const resolvedDriverMobile = repairItem.driverMobileNo || '';

    // Try to lookup vehicle insurance if insuranceCompany not provided
    let insCompany = repairItem.insuranceCompany || '';
    let polNo = repairItem.policyNo || '';
    let polVal = repairItem.policyValidity || '';

    if (!insCompany) {
      try {
        const allIns = load(KEYS.INSURANCE);
        const matched = allIns.find(i => 
          (repairItem.vehicleId && i.vehicleId === repairItem.vehicleId) || 
          (repairItem.carName && i.carName && i.carName.toLowerCase() === repairItem.carName.toLowerCase())
        );
        if (matched) {
          insCompany = matched.nameOfCompany || matched.insuranceCompany || '';
          polNo = matched.tpPolicyNo || matched.policyNo || '';
          polVal = matched.odEndDate || matched.tpEndDate || '';
        }
      } catch (e) {
        console.warn('Error fetching insurance company for claim:', e);
      }
    }

    if (existingClaim) {
      // Update existing claim
      const updated = {
        ...existingClaim,
        vehicleId: repairItem.vehicleId || existingClaim.vehicleId || '',
        vehicleName: resolvedVehicleName || existingClaim.vehicleName || '',
        carName: resolvedVehicleName || existingClaim.carName || '',
        registrationNo: resolvedRegNo || existingClaim.registrationNo || '',
        dateOfAccident: repairItem.dateOfAccident || existingClaim.dateOfAccident || today(),
        insuranceCompany: insCompany || existingClaim.insuranceCompany || '',
        policyNo: polNo || existingClaim.policyNo || '',
        policyValidity: polVal || existingClaim.policyValidity || '',
        estimatedClaimAmount: repairItem.estimatedClaimAmount !== undefined && repairItem.estimatedClaimAmount !== '' ? repairItem.estimatedClaimAmount : (existingClaim.estimatedClaimAmount || ''),
        typeOfClaim: repairItem.typeOfClaim || existingClaim.typeOfClaim || '',
        accidentReason: resolvedReason || existingClaim.accidentReason || '',
        reasonForRepair: resolvedReason || existingClaim.reasonForRepair || existingClaim.accidentReason || '',
        department: resolvedDept || existingClaim.department || '',
        driverName: resolvedDriverName || existingClaim.driverName || '',
        driverMobileNo: resolvedDriverMobile || existingClaim.driverMobileNo || '',
        timeOfAccident: repairItem.timeOfAccident || existingClaim.timeOfAccident || '',
        accidentLocation: existingClaim.accidentLocation || '',
        updatedAt: now
      };
      const idx = allClaims.findIndex(c => c.claimNo === existingClaim.claimNo);
      allClaims[idx] = updated;
      save(KEYS.CLAIMS, allClaims);

      await sendToSheet({
        action: 'update',
        sheetName: 'If Accident / Insurance Claims',
        keyField: 'Claim No.',
        keyValue: existingClaim.claimNo,
        data: claimToSheetRow(updated)
      });
      return updated;
    } else {
      // Auto-create new claim
      const claimNo = generateClaimNo(allClaims);
      const newClaim = {
        id: generateId(),
        claimNo,
        repairNo: repNo,
        vehicleId: repairItem.vehicleId || '',
        vehicleName: resolvedVehicleName,
        carName: resolvedVehicleName,
        registrationNo: resolvedRegNo,
        department: resolvedDept,
        reasonForRepair: resolvedReason,
        dateOfAccident: repairItem.dateOfAccident || today(),
        timeOfAccident: repairItem.timeOfAccident || '',
        accidentLocation: '',
        accidentReason: resolvedReason,
        driverName: resolvedDriverName,
        driverMobileNo: resolvedDriverMobile,
        insuranceCompany: '',
        policyNo: '',
        policyValidity: '',
        insuranceClaim: 'Yes',
        estimatedClaimAmount: '',
        typeOfClaim: '',
        claimMode: '',
        accidentPhotos: null,
        firRequired: '',
        firCopy: null,
        policeReport: null,
        otherDocuments: null,
        stage1Completed: false,
        stage2Completed: false,
        stage3Completed: false,
        claimIntimatedDate: '',
        claimIntimationNo: '',
        surveyorName: '',
        surveyorMobileNo: '',
        surveyDate: '',
        surveyStatus: '',
        claimStatus: 'Pending Submission',
        claimApprovedAmount: '',
        claimRejectedReason: '',
        claimSettlementDate: '',
        remarks: '',
        timestamp: now,
        createdAt: now
      };
      allClaims.push(newClaim);
      save(KEYS.CLAIMS, allClaims);

      // On initial auto-sync from repair, ONLY sync initial requirement columns (Cols A to G)!
      await sendToSheet({
        action: 'add',
        sheetName: 'If Accident / Insurance Claims',
        data: claimToSheetRow(newClaim, true)
      });
      return newClaim;
    }
  } finally {
    syncingRepairNos.delete(repNo);
  }
};

// Auto-sync any existing repairs that have insurance claimed but no claim record yet
export const syncPendingRepairClaims = async () => {
  try {
    const repairs = load(KEYS.REPAIRS);
    const claims = load(KEYS.CLAIMS);
    const pendingRepairs = repairs.filter(r => 
      (r.insuranceToBeClaimed === 'Yes' || r.insuranceClaimed === 'Yes') &&
      !claims.some(c => c.repairNo && c.repairNo === r.repairNo)
    );
    if (pendingRepairs.length === 0) return 0;
    
    for (const r of pendingRepairs) {
      await autoSyncRepairClaim(r);
    }
    return pendingRepairs.length;
  } catch (err) {
    console.warn('Failed to sync pending repair claims:', err);
    return 0;
  }
};

export const addRepair = async (repair) => {
  const all = load(KEYS.REPAIRS);
  const now = createTimestamp();
  const item = { ...repair, timestamp: now, createdAt: now };
  all.push(item);
  save(KEYS.REPAIRS, all);

  const payload = mapRepairToSheet(item);
  await sendToSheet({ action: 'add', sheetName: 'FMS', data: payload });

  // If Insurance to be claimed is Yes, automatically create & sync to If Accident / Insurance Claims!
  if (item.insuranceToBeClaimed === 'Yes') {
    await autoSyncRepairClaim(item);
  }

  return item;
};

export const updateRepair = async (repairNo, updates) => {
  const all = load(KEYS.REPAIRS);
  const idx = all.findIndex(r => r.repairNo === repairNo);
  if (idx === -1) throw new Error('Repair not found');
  const now = createTimestamp();
  all[idx] = { ...all[idx], ...updates, updatedAt: now };
  save(KEYS.REPAIRS, all);

  const payload = mapRepairToSheet(all[idx]);
  await sendToSheet({
    action: 'update',
    sheetName: 'FMS',
    keyField: 'Car Repair No.',
    keyValue: repairNo,
    data: payload
  });

  // If Insurance to be claimed is Yes, ensure claim is synced to If Accident / Insurance Claims!
  if (all[idx].insuranceToBeClaimed === 'Yes') {
    await autoSyncRepairClaim(all[idx]);
  }

  return all[idx];
};

export const deleteRepair = async (repairNo) => {
  const all = load(KEYS.REPAIRS).filter(r => r.repairNo !== repairNo);
  save(KEYS.REPAIRS, all);

  // Clean up associated vendor offer, delivery, payment
  const offers = load(KEYS.VENDOR_OFFERS).filter(o => o.repairNo !== repairNo);
  save(KEYS.VENDOR_OFFERS, offers);
  const dels = load(KEYS.DELIVERIES).filter(d => d.repairNo !== repairNo);
  save(KEYS.DELIVERIES, dels);
  const pays = load(KEYS.PAYMENTS).filter(p => p.repairNo !== repairNo);
  save(KEYS.PAYMENTS, pays);

  await sendToSheet({
    action: 'delete',
    sheetName: 'FMS',
    keyField: 'Car Repair No.',
    keyValue: repairNo,
    data: { 'Car Repair No.': repairNo }
  });
};

// ─── CLAIMS CRUD ──────────────────────────────────────────────────────────────
export const getClaims = async () => {
  await delay();
  const claims = load(KEYS.CLAIMS);
  const seenRepairs = new Set();
  const seenClaims = new Set();
  const deduplicated = [];
  const repairs = load(KEYS.REPAIRS);
  let modified = false;

  for (const c of claims) {
    if (c.repairNo) {
      if (seenRepairs.has(c.repairNo)) { modified = true; continue; }
      seenRepairs.add(c.repairNo);
    }
    if (c.claimNo) {
      if (seenClaims.has(c.claimNo)) { modified = true; continue; }
      seenClaims.add(c.claimNo);
    }

    // Auto-fix corrupted claimMode ('Pending') and expectedSettlementDate ('Claim Under Process'):
    if (!c.claimMode || c.claimMode === 'Pending' || (!c.claimMode.includes('Cashless') && !c.claimMode.includes('Reimbursement'))) {
      c.claimMode = 'Cashless Claim (Network Garage)';
      modified = true;
    }
    if (!c.expectedSettlementDate || c.expectedSettlementDate === 'Claim Under Process' || !/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(c.expectedSettlementDate)) {
      c.expectedSettlementDate = calculateExpectedSettlementDate(c.claimIntimatedDate || c.dateOfAccident || today(), c.claimMode);
      modified = true;
    }

    // Auto-fix accidentLocation if it was mistakenly set to garage name
    const matchedRep = c.repairNo ? repairs.find(r => r.repairNo === c.repairNo) : null;
    if (matchedRep?.garage && c.accidentLocation === matchedRep.garage) {
      c.accidentLocation = '';
      modified = true;
    }

    // Auto-fix claims where process data was cleared in sheet:
    const hasActual = !!(c.actual && String(c.actual).trim() !== '' && String(c.actual).trim() !== '—');
    const hasPolicy = !!(c.policyNo && String(c.policyNo).trim() !== '');
    const hasEstAmount = !!(c.estimatedClaimAmount && Number(c.estimatedClaimAmount) > 0);
    const isSettled = c.claimStatus === 'Settled' || !!c.claimSettlementDate;
    const isStage2or3 = c.stage2Completed === true || c.stage3Completed === true;

    if (!hasActual && !hasPolicy && !hasEstAmount && !isSettled && !isStage2or3) {
      if (c.stage1Completed || c.isProcessed || c.policyNo || c.actual) {
        c.stage1Completed = false;
        c.stage2Completed = false;
        c.stage3Completed = false;
        c.isProcessed = false;
        c.actual = '';
        c.policyNo = '';
        c.insuranceCompany = '';
        c.estimatedClaimAmount = '';
        c.typeOfClaim = '';
        c.policyValidity = '';
        c.firRequired = 'No';
        c.claimMode = '';
        c.expectedSettlementDate = '';
        c.accidentPhotos = null;
        c.policeReport = null;
        c.otherDocuments = null;
        c.claimStatus = 'Pending Submission';
        c.claimSettlementDate = '';
        c.surveyStatus = 'Pending';
        modified = true;
      }
    }

    // Auto-fix claims that completed Stage 1 but have not done Stage 2 (Survey is Pending, not Approved/Settled):
    if ((!c.surveyStatus || c.surveyStatus === 'Pending') && c.claimStatus !== 'Approved' && c.claimStatus !== 'Settled') {
      if (c.stage2Completed || c.stage3Completed || c.claimSettlementDate) {
        c.stage2Completed = false;
        c.stage3Completed = false;
        c.claimSettlementDate = '';
        modified = true;
      }
    }

    deduplicated.push(c);
  }
  if (modified || deduplicated.length !== claims.length) {
    save(KEYS.CLAIMS, deduplicated);
  }
  return deduplicated;
};

export const addClaim = async (claim) => {
  const all = load(KEYS.CLAIMS);
  const now = createTimestamp();
  const item = {
    stage1Completed: false,
    stage2Completed: false,
    stage3Completed: false,
    ...claim,
    timestamp: now,
    createdAt: now
  };
  all.push(item);
  save(KEYS.CLAIMS, all);
  await sendToSheet({
    action: 'add',
    sheetName: 'If Accident / Insurance Claims',
    data: { 'Timestamp': now, ...claimToSheetRow(item) },
  });
  return item;
};

export const updateClaim = async (claimNo, updates) => {
  const all = load(KEYS.CLAIMS);
  const idx = all.findIndex(c => c.claimNo === claimNo);
  if (idx === -1) throw new Error('Claim not found');
  all[idx] = { ...all[idx], ...updates, updatedAt: createTimestamp() };
  save(KEYS.CLAIMS, all);

  const sheetData = claimToSheetRow(all[idx]);
  if (all[idx].actual) {
    sheetData['Actual'] = all[idx].actual;
  }

  await sendToSheet({
    action: 'update',
    sheetName: 'If Accident / Insurance Claims',
    keyField: 'Claim No.',
    keyValue: claimNo,
    data: sheetData,
  });
  return all[idx];
};

export const processAccidentClaim = async (claimNo, processData) => {
  const all = load(KEYS.CLAIMS);
  const idx = all.findIndex(c => c.claimNo === claimNo);
  if (idx === -1) throw new Error('Claim not found');
  const now = createTimestamp();
  const validMode = (processData.claimMode && (processData.claimMode.includes('Cashless') || processData.claimMode.includes('Reimbursement')))
    ? processData.claimMode
    : (all[idx].claimMode && (all[idx].claimMode.includes('Cashless') || all[idx].claimMode.includes('Reimbursement')) ? all[idx].claimMode : 'Cashless Claim (Network Garage)');
  
  const validExp = (processData.expectedSettlementDate && /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(processData.expectedSettlementDate))
    ? processData.expectedSettlementDate
    : calculateExpectedSettlementDate(processData.claimIntimatedDate || processData.dateOfAccident || all[idx].claimIntimatedDate || all[idx].dateOfAccident || today(), validMode);

  const isStage2 = !!(processData.stage2Completed || all[idx].stage2Completed);
  const isStage3 = !!(processData.stage3Completed || all[idx].stage3Completed);

  if (isStage2 && !all[idx].actual1) {
    all[idx].actual1 = now;
    all[idx].actualDate1 = now;
  }
  if (isStage3 && !all[idx].actual2) {
    all[idx].actual2 = now;
    all[idx].actualDate2 = now;
  }
  if (!all[idx].actual) {
    all[idx].actual = now;
  }

  all[idx] = {
    ...all[idx],
    ...processData,
    claimMode: validMode,
    expectedSettlementDate: validExp,
    isProcessed: true,
    updatedAt: now
  };
  save(KEYS.CLAIMS, all);

  const sheetData = {
    ...claimToSheetRow(all[idx]),
    'Actual': all[idx].actual || now,
    ...(isStage2 ? { 'Actual 1': all[idx].actual1 || now } : (all[idx].actual1 ? { 'Actual 1': all[idx].actual1 } : {})),
    ...(isStage3 ? { 'Actual 2': all[idx].actual2 || now } : (all[idx].actual2 ? { 'Actual 2': all[idx].actual2 } : {})),

    // Stage 1 Fields
    'Registration No.': all[idx].registrationNo || '',
    'Date of Accident': all[idx].dateOfAccident || '',
    'Accident Location': all[idx].accidentLocation || '',
    'Time of Accident': all[idx].timeOfAccident || '',
    'Driver Name': all[idx].driverName || '',
    'Driver Mobile': all[idx].driverMobileNo || all[idx].driverMobile || '',
    'Policy No.': all[idx].policyNo || '',
    'Insurance Company': all[idx].insuranceCompany || '',
    'Insurance Comp': all[idx].insuranceCompany || '',
    'Estimated Claim Amount': all[idx].estimatedClaimAmount || '',
    'Estimated Claim': all[idx].estimatedClaimAmount || '',
    'Estimated Claim Amount (₹)': all[idx].estimatedClaimAmount || '',
    'Type Of Claim': all[idx].typeOfClaim || 'Own Damage',
    'Claim Settlement Mode': validMode,
    'Claim Mode': validMode,
    'Expected Settlement Date': validExp,
    'Policy Validity': all[idx].policyValidity || '',
    'FIR Required?': all[idx].firRequired || 'No',
    'FIR Required': all[idx].firRequired || 'No',

    // Stage 2 ("Claim Intimation & Surveyor Appointment") Columns - exactly matching Sheet Row 6
    'Claim Intimated Date ': all[idx].claimIntimatedDate || '',
    'Claim Intimated Date': all[idx].claimIntimatedDate || '',
    'Claim Intimation No. / Ticket': all[idx].claimIntimationNo || '',
    'Claim Intimation No.': all[idx].claimIntimationNo || '',
    'Claim Intimation': all[idx].claimIntimationNo || '',
    'Surveyor Name': all[idx].surveyorName || '',
    'Surveyor Mobile No.': all[idx].surveyorMobileNo || '',
    'Survey Date': all[idx].surveyDate || '',
    'Survey Status': all[idx].surveyStatus || 'Pending',
    'Survey': all[idx].surveyStatus || 'Pending',
    'Claim Current Status': all[idx].claimStatus || 'Claim Under Process',
    'Claim Status': all[idx].claimStatus || 'Claim Under Process',
    'Survey Assessment & Inspection Remarks': all[idx].remarks || '',
    'Remarks': all[idx].remarks || '',
    'Survey Report / Documents': typeof all[idx].otherDocuments === 'string' ? all[idx].otherDocuments : (all[idx].otherDocuments?.url || ''),
    'Other Documents': typeof all[idx].otherDocuments === 'string' ? all[idx].otherDocuments : (all[idx].otherDocuments?.url || ''),

    // Stage 3 ("Final Settlement & Payout Details") Columns - exactly matching Sheet Row 6 (Cols AO to AX):
    'Final Approved Claim Amount (₹)': all[idx].claimApprovedAmount || all[idx].estimatedClaimAmount || '',
    'Claim Approved Amount': all[idx].claimApprovedAmount || all[idx].estimatedClaimAmount || '',
    'Actual Settlement Date': all[idx].claimSettlementDate || today(),
    'Settlement Date': all[idx].claimSettlementDate || today(),
    'Claim Final Status': all[idx].claimFinalStatus || all[idx].claimStatus || 'Settled (Approved & Paid)',
    'Settlement / Payout Mode': all[idx].settlementPaymentMode || 'Direct to Network Garage (Cashless)',
    'Payment Ref. / UTR No.': all[idx].settlementRefNo || '',
    'Payment File / Receipt Upload': typeof all[idx].paymentReceipt === 'string' ? all[idx].paymentReceipt : (all[idx].paymentReceipt?.url || ''),
    'Payment Receipt': typeof all[idx].paymentReceipt === 'string' ? all[idx].paymentReceipt : (all[idx].paymentReceipt?.url || ''),
    'Payment File': typeof all[idx].paymentReceipt === 'string' ? all[idx].paymentReceipt : (all[idx].paymentReceipt?.url || ''),
    'Payment Proof': typeof all[idx].paymentReceipt === 'string' ? all[idx].paymentReceipt : (all[idx].paymentReceipt?.url || ''),
    'Payment Document': typeof all[idx].paymentReceipt === 'string' ? all[idx].paymentReceipt : (all[idx].paymentReceipt?.url || ''),
    'Settlement Closure Remarks': all[idx].settlementRemarks || '',

    // Photos / Reports
    'Accident Photos': typeof all[idx].accidentPhotos === 'string' ? all[idx].accidentPhotos : (all[idx].accidentPhotos?.url || ''),
    'Accident Photo': typeof all[idx].accidentPhotos === 'string' ? all[idx].accidentPhotos : (all[idx].accidentPhotos?.url || ''),
    'Police Report': typeof all[idx].policeReport === 'string' ? all[idx].policeReport : (all[idx].policeReport?.url || ''),
    'FIR Copy': typeof all[idx].firCopy === 'string' ? all[idx].firCopy : (all[idx].firCopy?.url || ''),
    'Claim Rejected Reason': all[idx].claimRejectedReason || ''
  };

  await sendToSheet({
    action: 'update',
    sheetName: 'If Accident / Insurance Claims',
    keyField: 'Claim No.',
    keyValue: claimNo,
    data: sheetData,
  });
  return all[idx];
};

export const deleteClaim = async (claimNo) => {
  const all = load(KEYS.CLAIMS).filter(c => c.claimNo !== claimNo);
  save(KEYS.CLAIMS, all);
  await sendToSheet({
    action: 'delete',
    sheetName: 'If Accident / Insurance Claims',
    keyField: 'Claim No.',
    keyValue: claimNo,
    data: { 'Claim No.': claimNo }
  });
};

// ─── VENDOR OFFERS & MASTER REPAIR TYPES ─────────────────────────────
export const getMasterRepairTypes = async () => {
  const DEFAULT_TYPES = [
    'Tyre Change', 'Regular Maintainance', 'Body Repair', 'Major Repair',
    'Denting', 'Painting', 'Mechanical', 'Electrical', 'AC Servicing', 'General Checkup'
  ];

  try {
    const remote = await fetchFromSheet('get_Master', 'Master');
    if (Array.isArray(remote) && remote.length > 0) {
      const types = remote
        .map(r => r['Types Of Repair'] || r['Types of Repair'] || r.typesOfRepair)
        .filter(Boolean)
        .map(t => String(t).trim())
        .filter(t => t.length > 0 && t !== '.');
      if (types.length > 0) {
        return [...new Set(types)];
      }
    }
  } catch (err) {
    console.warn('Could not fetch Master repair types from sheet, using defaults:', err);
  }
  return DEFAULT_TYPES;
};

export const getMasterFirmNames = async () => {
  const DEFAULT_FIRMS = [
    'Passary Minerals Ltd',
    'Passary Progressive Pvt Ltd',
    'Passary Refractories Ltd'
  ];

  try {
    const remote = await fetchFromSheet('get_Master', 'Master');
    if (Array.isArray(remote) && remote.length > 0) {
      const firms = remote
        .map(r => r['Firm Name'] || r['Firm name'] || r['firmName'] || r['FirmName'] || r['Firm'] || r['FIRM NAME'])
        .filter(Boolean)
        .map(t => String(t).trim())
        .filter(t => t.length > 0 && t !== '.' && t.toLowerCase() !== 'firm name');
      if (firms.length > 0) {
        return [...new Set(firms)];
      }
    }
  } catch (err) {
    console.warn('Could not fetch Master firm names from sheet, using defaults:', err);
  }
  return DEFAULT_FIRMS;
};

export const getMasterEmployees = async () => {
  const DEFAULT_EMPLOYEES = [
    { code: 'PMMPL-1', name: 'Jayant Kumar Pandey' },
    { code: 'PMMPL-2', name: 'Jitendra Singh' },
    { code: 'PMMPL-3', name: 'Hareram Ramkathin Maurya' },
    { code: 'PMMPL-4', name: 'Laxmikant Nisad' },
    { code: 'PMMPL-7', name: 'Rajkumar sahu' },
    { code: 'PMMPL-8', name: 'Anand kumar' },
    { code: 'PMMPL-9', name: 'Vivek kumar mishra' },
    { code: 'PMMPL-11', name: 'SK Taiab Ali' },
    { code: 'PMMPL-13', name: 'Bishnupada Maity' },
    { code: 'PMMPL-14', name: 'Tara Pada Sana' },
    { code: 'PMMPL-22', name: 'Mahadev jana' },
    { code: 'PMMPL-24', name: 'Digambar das manikpuri' },
    { code: 'PMMPL-26', name: 'Jeevan lal sahu' },
    { code: 'PMMPL-34', name: 'Devshree Bhawar' },
    { code: 'PMMPL-46', name: 'Anjali prasad' },
    { code: 'PMMPL-53', name: 'Kishan Choudhary' },
    { code: 'PMMPL-64', name: 'Satish kumar banjari' },
    { code: 'PMMPL-74', name: 'Himani Pandey' },
    { code: 'PMMPL-78', name: 'Maniram' },
    { code: 'PMMPL-84', name: 'Ajay Kumar' },
    { code: 'PMMPL-108', name: 'Suvankar jana' },
    { code: 'PMMPL-113', name: 'Umesh Singh' },
    { code: 'PMMPL-116', name: 'Durgesh Kumar Sharma' },
    { code: 'PMMPL-127', name: 'Harish kumar Verma' },
    { code: 'PMMPL-130', name: 'Yogeshwar Rao' },
    { code: 'PMMPL-139', name: 'Soniya Tandan' },
    { code: 'PMMPL-140', name: 'Ajit Kumar Yadav' },
    { code: 'PMMPL-144', name: 'Devendra Kumar Verma.' },
    { code: 'PMMPL-148', name: 'Akash Mirjha' },
  ];

  try {
    const remote = await fetchFromSheet('get_Master', 'Master');
    if (Array.isArray(remote) && remote.length > 0) {
      const list = [];
      const seen = new Set();
      remote.forEach(r => {
        const name = r['Employee Name'] || r['Employee name'] || r['employeeName'] || r['EMPLOYEE NAME'] || '';
        const code = r['Employee Code'] || r['Employee code'] || r['employeeCode'] || r['EMPLOYEE CODE'] || r['Employee Id'] || r['Employee ID'] || '';
        const cleanName = String(name).trim();
        const cleanCode = String(code).trim();
        if (cleanName && cleanName !== '.' && cleanName.toLowerCase() !== 'employee name') {
          const key = `${cleanName}_${cleanCode}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({ name: cleanName, code: cleanCode });
          }
        }
      });
      if (list.length > 0) {
        return list;
      }
    }
  } catch (err) {
    console.warn('Could not fetch Master employees from sheet, using defaults:', err);
  }
  return DEFAULT_EMPLOYEES;
};

export const getVendorOffers = async () => {
  await delay();
  return load(KEYS.VENDOR_OFFERS);
};

export const addVendorOffer = async (offer) => {
  const all = load(KEYS.VENDOR_OFFERS);
  const now = createTimestamp();
  const actualDate = offer.actualDate || now;
  const item = {
    ...offer,
    actualDate,
    timestamp: now,
    createdAt: now
  };
  all.push(item);
  save(KEYS.VENDOR_OFFERS, all);

  // Send to FMS sheet (Col K: Actual 1, Col M: Photo, Col N: Insurance, Col O: Types, Col P: Garage Name, Col Q: Expected Repair Completion Date)
  await sendToSheet({
    action: 'submit_vendor_offer',
    sheetName: 'FMS',
    keyValue: item.repairNo,
    data: {
      'Car Repair No.': item.repairNo,
      'Actual 1': actualDate,
      'Photo Of Offer': item.photoOfOffer,
      'Insurance': item.insurance,
      'Types Of Repair': item.typesOfRepair,
      'Garage Name': item.garageName || item.garage || '',
      'Expected Repair Completion Date': item.expectedCompletionDate || '',
    }
  });

  // Also update repair status
  const repairs = load(KEYS.REPAIRS);
  const ri = repairs.findIndex(r => r.repairNo === item.repairNo);
  if (ri !== -1) {
    repairs[ri].repairStatus = 'Offer Received';
    repairs[ri].actualDate = actualDate;
    repairs[ri].updatedAt = now;
    save(KEYS.REPAIRS, repairs);
  }

  return item;
};

export const approveVendorOffer = async (id, remarks = '') => {
  const all = load(KEYS.VENDOR_OFFERS);
  const idx = all.findIndex(o => o.id === id || o.repairNo === id);
  if (idx === -1) throw new Error('Offer not found');
  const now = createTimestamp();
  all[idx] = {
    ...all[idx],
    approvalStatus: 'Approved',
    approvedAt: now,
    actualDate2: now,
    approvalRemarks: remarks
  };
  save(KEYS.VENDOR_OFFERS, all);

  // Send to FMS sheet: Col Q (Actual 2)
  await sendToSheet({
    action: 'submit_approval',
    sheetName: 'FMS',
    keyValue: all[idx].repairNo,
    data: {
      'Car Repair No.': all[idx].repairNo,
      'Actual 2': now,
      'approvalStatus': 'Approved',
      'remarks': remarks
    }
  });

  // Update repair status to Approved
  const repairs = load(KEYS.REPAIRS);
  const ri = repairs.findIndex(r => r.repairNo === all[idx].repairNo);
  if (ri !== -1) {
    repairs[ri].repairStatus = 'Approved';
    repairs[ri].actualDate2 = now;
    repairs[ri].updatedAt = now;
    save(KEYS.REPAIRS, repairs);
  }
  return all[idx];
};

export const rejectVendorOffer = async (id, reason) => {
  const all = load(KEYS.VENDOR_OFFERS);
  const idx = all.findIndex(o => o.id === id);
  if (idx === -1) throw new Error('Offer not found');
  const now = createTimestamp();
  all[idx] = { ...all[idx], approvalStatus: 'Rejected', rejectionReason: reason, rejectedAt: now };
  save(KEYS.VENDOR_OFFERS, all);
  sendToSheet({ action: 'update', sheetName: 'Vendor_Offers', keyField: 'id', keyValue: id, data: all[idx] });
  return all[idx];
};

export const updateVendorOffer = async (idOrRepairNo, updates) => {
  const all = load(KEYS.VENDOR_OFFERS);
  const idx = all.findIndex(o => o.id === idOrRepairNo || o.repairNo === idOrRepairNo);
  if (idx === -1) throw new Error('Offer not found');
  const now = createTimestamp();
  all[idx] = { ...all[idx], ...updates, updatedAt: now };
  save(KEYS.VENDOR_OFFERS, all);

  await sendToSheet({
    action: 'submit_vendor_offer',
    sheetName: 'FMS',
    keyValue: all[idx].repairNo,
    data: {
      'Car Repair No.': all[idx].repairNo,
      'Actual 1': all[idx].actualDate || now,
      'Photo Of Offer': all[idx].photoOfOffer,
      'Insurance': all[idx].insurance,
      'Types Of Repair': all[idx].typesOfRepair,
      'Garage Name': all[idx].garageName || all[idx].garage || '',
      'Expected Repair Completion Date': all[idx].expectedCompletionDate || '',
    }
  });
  return all[idx];
};

// ─── DELIVERY PLANNING ────────────────────────────────────────────────────────
export const getDeliveryPlanning = async () => {
  await delay();
  return load(KEYS.DELIVERY_PLANNING);
};

export const addDeliveryPlanning = async (dp) => {
  const all = load(KEYS.DELIVERY_PLANNING);
  const now = createTimestamp();
  const item = { ...dp, timestamp: now, createdAt: now };
  all.push(item);
  save(KEYS.DELIVERY_PLANNING, all);
  await sendToSheet({ action: 'add', sheetName: 'Delivery_Planning', data: item });

  // Create delivery record
  const deliveries = load(KEYS.DELIVERIES);
  const exists = deliveries.find(d => d.repairNo === dp.repairNo);
  if (!exists) {
    const newDel = { ...dp, deliveryStatus: 'Delivery Pending', id: `del_${Date.now()}`, timestamp: now, createdAt: now };
    deliveries.push(newDel);
    save(KEYS.DELIVERIES, deliveries);
    sendToSheet({ action: 'add', sheetName: 'Delivery_Car', data: newDel });
  }

  // Update repair status
  const repairs = load(KEYS.REPAIRS);
  const ri = repairs.findIndex(r => r.repairNo === dp.repairNo);
  if (ri !== -1) {
    repairs[ri].repairStatus = 'Delivery Planned';
    repairs[ri].updatedAt = now;
    save(KEYS.REPAIRS, repairs);
    sendToSheet({
      action: 'update',
      sheetName: 'FMS',
      keyField: 'Car Repair No.',
      keyValue: dp.repairNo,
      data: mapRepairToSheet(repairs[ri])
    });
  }
  return item;
};

// ─── DELIVERIES ───────────────────────────────────────────────────────────────
export const getDeliveries = async () => {
  await delay();
  return load(KEYS.DELIVERIES);
};

export const submitDelivery = async (deliveryInput) => {
  const repairNo = typeof deliveryInput === 'string' ? deliveryInput : deliveryInput?.repairNo;
  const deliveries = load(KEYS.DELIVERIES);
  const now = createTimestamp();
  
  let idx = deliveries.findIndex(d => d.repairNo === repairNo);
  let delRecord;

  if (typeof deliveryInput === 'object') {
    delRecord = {
      id: deliveryInput.id || `del_${Date.now()}`,
      ...deliveryInput,
      deliveryStatus: 'Delivery Submitted',
      submittedAt: now,
      deliveredAt: now,
      actualDate3: now,
      timestamp: now,
    };
    if (idx !== -1) {
      deliveries[idx] = { ...deliveries[idx], ...delRecord };
    } else {
      deliveries.push(delRecord);
    }
  } else {
    if (idx === -1) throw new Error('Delivery not found');
    deliveries[idx] = {
      ...deliveries[idx],
      deliveryStatus: 'Delivery Submitted',
      submittedAt: now,
      deliveredAt: now,
      actualDate3: now,
    };
    delRecord = deliveries[idx];
  }
  
  save(KEYS.DELIVERIES, deliveries);

  // Send to FMS sheet (Col V: Actual 3 through Col AF: Bill Image)
  await sendToSheet({
    action: 'submit_delivery',
    sheetName: 'FMS',
    keyValue: repairNo,
    data: {
      'Car Repair No.': repairNo,
      'Actual 3': now,
      'Date Of Vechile Received Back': delRecord.dateVehicleReceived || '',
      'Date of Vehicle Received Back': delRecord.dateVehicleReceived || '',
      'K.M at The Time Of Repair': delRecord.kmAtTimeOfRepair || '',
      'Reapir Work Done': delRecord.repairWorkDone || '',
      'Repair Work Done': delRecord.repairWorkDone || '',
      'Parts Amount': delRecord.partsAmount || '',
      'Service Amount': delRecord.serviceAmount || '',
      'Insurance Claimed (If Any)': delRecord.insuranceClaimed || 'No',
      'Insurance Amount ( If Claimed )': delRecord.insuranceAmount || '',
      'Bill Amount': delRecord.billAmount || '',
      'Bill Image': delRecord.billImage || '',
    }
  });

  // Create payment record
  const payments = load(KEYS.PAYMENTS);
  const alreadyPay = payments.find(p => p.repairNo === repairNo);
  if (!alreadyPay) {
    const newPay = {
      id: `pay_${Date.now()}`,
      repairNo,
      vehicleId: delRecord.vehicleId,
      garageName: delRecord.garageName,
      vehicleName: delRecord.vehicleName,
      dateVehicleReceived: delRecord.dateVehicleReceived,
      kmAtTimeOfRepair: delRecord.kmAtTimeOfRepair,
      serviceAmount: delRecord.serviceAmount,
      billAmount: delRecord.billAmount,
      billImage: delRecord.billImage,
      paymentStatus: 'Payment Pending',
      timestamp: now,
      createdAt: now,
    };
    payments.push(newPay);
    save(KEYS.PAYMENTS, payments);
    sendToSheet({ action: 'add', sheetName: 'Payment', data: newPay });
  }

  // Update repair status
  const repairs = load(KEYS.REPAIRS);
  const ri = repairs.findIndex(r => r.repairNo === repairNo);
  if (ri !== -1) {
    repairs[ri].repairStatus = 'Delivered';
    repairs[ri].actualDate3 = now;
    repairs[ri].dateVehicleReceived = delRecord.dateVehicleReceived;
    repairs[ri].updatedAt = now;
    save(KEYS.REPAIRS, repairs);
  }

  return delRecord;
};

export const updateDelivery = async (repairNo, updates) => {
  const deliveries = load(KEYS.DELIVERIES);
  const idx = deliveries.findIndex(d => d.repairNo === repairNo || d.id === repairNo);
  if (idx === -1) throw new Error('Delivery not found');
  const now = createTimestamp();
  deliveries[idx] = { ...deliveries[idx], ...updates, updatedAt: now };
  save(KEYS.DELIVERIES, deliveries);

  await sendToSheet({
    action: 'submit_delivery',
    sheetName: 'FMS',
    keyValue: deliveries[idx].repairNo,
    data: {
      'Car Repair No.': deliveries[idx].repairNo,
      'Actual 3': deliveries[idx].actualDate3 || deliveries[idx].submittedAt || now,
      'Date Of Vechile Received Back': deliveries[idx].dateVehicleReceived || '',
      'Date of Vehicle Received Back': deliveries[idx].dateVehicleReceived || '',
      'K.M at The Time Of Repair': deliveries[idx].kmAtTimeOfRepair || '',
      'Reapir Work Done': deliveries[idx].repairWorkDone || '',
      'Repair Work Done': deliveries[idx].repairWorkDone || '',
      'Parts Amount': deliveries[idx].partsAmount || '',
      'Service Amount': deliveries[idx].serviceAmount || '',
      'Insurance Claimed (If Any)': deliveries[idx].insuranceClaimed || 'No',
      'Insurance Amount ( If Claimed )': deliveries[idx].insuranceAmount || '',
      'Bill Amount': deliveries[idx].billAmount || '',
      'Bill Image': typeof deliveries[idx].billImage === 'object' ? (deliveries[idx].billImage?.url || '') : (deliveries[idx].billImage || ''),
    }
  });

  // Also sync billAmount to payments if present
  const payments = load(KEYS.PAYMENTS);
  const pIdx = payments.findIndex(p => p.repairNo === deliveries[idx].repairNo);
  if (pIdx !== -1) {
    payments[pIdx] = {
      ...payments[pIdx],
      billAmount: deliveries[idx].billAmount,
      dateVehicleReceived: deliveries[idx].dateVehicleReceived,
      kmAtTimeOfRepair: deliveries[idx].kmAtTimeOfRepair,
      serviceAmount: deliveries[idx].serviceAmount,
      billImage: deliveries[idx].billImage,
      garageName: deliveries[idx].garageName || payments[pIdx].garageName,
      updatedAt: now
    };
    save(KEYS.PAYMENTS, payments);
  }

  return deliveries[idx];
};

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────
export const getPayments = async () => {
  await delay();
  return load(KEYS.PAYMENTS);
};

export const updatePaymentStatus = async (repairNo, status) => {
  const payments = load(KEYS.PAYMENTS);
  const idx = payments.findIndex(p => p.repairNo === repairNo);
  if (idx === -1) throw new Error('Payment not found');
  const now = createTimestamp();
  payments[idx] = { ...payments[idx], paymentStatus: status, updatedAt: now };
  save(KEYS.PAYMENTS, payments);
  await sendToSheet({ action: 'update', sheetName: 'Payment', keyField: 'repairNo', keyValue: repairNo, data: payments[idx] });

  if (status === 'Payment Completed') {
    const repairs = load(KEYS.REPAIRS);
    const ri = repairs.findIndex(r => r.repairNo === repairNo);
    if (ri !== -1) {
      repairs[ri].repairStatus = 'Payment Completed';
      repairs[ri].updatedAt = now;
      save(KEYS.REPAIRS, repairs);
      sendToSheet({
        action: 'update',
        sheetName: 'FMS',
        keyField: 'Car Repair No.',
        keyValue: repairNo,
        data: mapRepairToSheet(repairs[ri])
      });
    }
  }
  return payments[idx];
};

export const updatePayment = async (repairNo, updates) => {
  const payments = load(KEYS.PAYMENTS);
  const idx = payments.findIndex(p => p.repairNo === repairNo || p.id === repairNo);
  if (idx === -1) throw new Error('Payment not found');
  const now = createTimestamp();
  payments[idx] = { ...payments[idx], ...updates, updatedAt: now };
  save(KEYS.PAYMENTS, payments);
  await sendToSheet({ action: 'update', sheetName: 'Payment', keyField: 'repairNo', keyValue: payments[idx].repairNo, data: payments[idx] });
  return payments[idx];
};

// ─── MAPPER FOR "Challan Details" SHEET ───────────────────────────────────────
export const mapChallanToSheet = (ch) => ({
  "Timestamp": ch.timestamp || ch.createdAt || createTimestamp(),
  "Challan ID": ch.id || '',
  "Challan No": ch.challanNo || '',
  "Vehicle ID": ch.vehicleId || '',
  "Car Name": ch.carName || '',
  "Firm Name": ch.firmName || '',
  "Reg. No": ch.registrationNo || '',
  "Fuel": ch.fuelType || '',
  "Owner": ch.owner || '',
  "Date of Challan": ch.dateOfChallan || '',
  "Reason of Challan": ch.reasonOfChallan || '',
  "Who is Driver": ch.driverName || '',
  "Driver Mobile": ch.driverMobile || '',
  "Challan Amount": ch.challanAmount || '',
  "Location / Authority": ch.location || '',
  "Payment Status": ch.paymentStatus || 'Pending',
  "Payment Date": ch.paymentDate || '',
  "Transaction ID": ch.transactionId || '',
  "Challan Document": typeof ch.documentUrl === 'string' ? ch.documentUrl : (ch.documentUrl?.url || ''),
  "Remarks": ch.remarks || '',
});

export const mapSheetRowToChallan = (row, index) => {
  if (!row || typeof row !== 'object') return null;
  const get = (...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
      const target = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [rk, rv] of Object.entries(row)) {
        if (rk.toLowerCase().replace(/[^a-z0-9]/g, '') === target && rv !== undefined && rv !== null && String(rv).trim() !== '') {
          return String(rv).trim();
        }
      }
    }
    return '';
  };

  const challanNo = get('Challan No', 'challanNo', 'CHALLAN NO', 'Challan Number');
  const vehicleId = get('Vehicle ID', 'vehicleId', 'VEHICLE ID');
  const regNo = get('Reg. No', 'Reg No', 'registrationNo', 'REGISTRATION NO.');
  if (!challanNo && !vehicleId && !regNo) return null;

  return {
    id: get('Challan ID', 'id') || `CH-${Date.now()}-${index}`,
    challanNo: challanNo || `CH-${String(index + 1).padStart(4, '0')}`,
    vehicleId: vehicleId || '',
    carName: get('Car Name', 'carName', 'NAME OF CAR / Vehicle'),
    firmName: get('Firm Name', 'firmName'),
    registrationNo: regNo,
    fuelType: get('Fuel', 'fuelType', 'FUEL TYPE'),
    owner: get('Owner', 'owner', 'Name Of The Owner'),
    dateOfChallan: get('Date of Challan', 'dateOfChallan', 'date'),
    reasonOfChallan: get('Reason of Challan', 'reasonOfChallan', 'reason'),
    driverName: get('Who is Driver', 'driverName', 'driver'),
    driverMobile: get('Driver Mobile', 'driverMobile'),
    challanAmount: get('Challan Amount', 'challanAmount', 'amount'),
    location: get('Location / Authority', 'location', 'authority'),
    paymentStatus: get('Payment Status', 'paymentStatus') || 'Pending',
    paymentDate: get('Payment Date', 'paymentDate'),
    transactionId: get('Transaction ID', 'transactionId'),
    documentUrl: get('Challan Document', 'documentUrl', 'document'),
    remarks: get('Remarks', 'remarks'),
    timestamp: get('Timestamp', 'timestamp') || createTimestamp(),
    createdAt: get('Timestamp', 'createdAt') || createTimestamp(),
  };
};

// ─── CHALLANS CRUD ────────────────────────────────────────────────────────────
export const getChallans = async () => {
  await delay();
  return load(KEYS.CHALLANS);
};

export const addChallan = async (challanData) => {
  const challans = load(KEYS.CHALLANS);
  const now = createTimestamp();
  const id = `ch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newChallan = {
    ...challanData,
    id,
    paymentStatus: challanData.paymentStatus || 'Pending',
    timestamp: now,
    createdAt: now,
  };
  challans.push(newChallan);
  save(KEYS.CHALLANS, challans);

  await sendToSheet({
    action: 'add',
    sheetName: 'Challan Details',
    data: mapChallanToSheet(newChallan)
  });

  return newChallan;
};

export const updateChallan = async (id, updates) => {
  const challans = load(KEYS.CHALLANS);
  const idx = challans.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Challan record not found');
  const now = createTimestamp();
  challans[idx] = { ...challans[idx], ...updates, updatedAt: now };
  save(KEYS.CHALLANS, challans);

  await sendToSheet({
    action: 'update',
    sheetName: 'Challan Details',
    keyField: 'Challan ID',
    keyValue: id,
    data: mapChallanToSheet(challans[idx])
  });

  return challans[idx];
};

export const deleteChallan = async (id) => {
  const challans = load(KEYS.CHALLANS);
  const target = challans.find(c => c.id === id || c.challanNo === id);
  const filtered = challans.filter(c => c.id !== id && c.challanNo !== id);
  save(KEYS.CHALLANS, filtered);

  if (target) {
    const keyVal = target.id || id;
    await sendToSheet({
      action: 'delete',
      sheetName: 'Challan Details',
      keyField: 'Challan ID',
      keyValue: keyVal,
      data: { 'Challan ID': keyVal }
    });
  }
  return true;
};

// ─── MAPPER FOR "Fastag Details" SHEET ────────────────────────────────────────
export const mapFastagToSheet = (ft) => ({
  "Timestamp": ft.timestamp || ft.createdAt || createTimestamp(),
  "Vehicle ID": ft.vehicleId || '',
  "Car Name": ft.carName || '',
  "Firm Name": ft.firmName || '',
  "Reg. No": ft.registrationNo || '',
  "Fuel": ft.fuelType || '',
  "Owner": ft.owner || '',
  "Fastag Status": ft.fastagStatus || 'Active',
  "Tag ID": ft.tagId || '',
  "Issuing Bank": ft.bankName || '',
  "Vehicle Class": ft.vehicleClass || 'VC4',
  "Linked Mobile": ft.linkedMobile || '',
  "Wallet ID": ft.walletId || '',
  "Balance": ft.balance || '0',
  "Low Balance Limit": ft.lowBalanceLimit || '200',
  "Activation Date": ft.activationDate || '',
  "Expiry Date": ft.expiryDate || '',
  "Barcode Document": typeof ft.documentUrl === 'string' ? ft.documentUrl : (ft.documentUrl?.url || ''),
  "Remarks": ft.remarks || '',
});

export const mapSheetRowToFastag = (row, index) => {
  if (!row || typeof row !== 'object') return null;
  const get = (...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
      const target = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [rk, rv] of Object.entries(row)) {
        if (rk.toLowerCase().replace(/[^a-z0-9]/g, '') === target && rv !== undefined && rv !== null && String(rv).trim() !== '') {
          return String(rv).trim();
        }
      }
    }
    return '';
  };

  const vehicleId = get('Vehicle ID', 'vehicleId', 'VEHICLE ID');
  const regNo = get('Reg. No', 'Reg No', 'registrationNo', 'REGISTRATION NO.');
  const tagId = get('Tag ID', 'tagId', 'TAG ID');
  if (!vehicleId && !regNo && !tagId) return null;

  return {
    id: get('id') || `FT-${vehicleId || regNo || index}`,
    vehicleId: vehicleId || '',
    carName: get('Car Name', 'carName', 'NAME OF CAR / Vehicle'),
    firmName: get('Firm Name', 'firmName'),
    registrationNo: regNo,
    fuelType: get('Fuel', 'fuelType', 'FUEL TYPE'),
    owner: get('Owner', 'owner', 'Name Of The Owner'),
    fastagStatus: get('Fastag Status', 'fastagStatus', 'status') || 'Active',
    tagId: tagId || '',
    bankName: get('Issuing Bank', 'bankName', 'bank'),
    vehicleClass: get('Vehicle Class', 'vehicleClass') || 'VC4',
    linkedMobile: get('Linked Mobile', 'linkedMobile', 'mobile'),
    walletId: get('Wallet ID', 'walletId'),
    balance: get('Balance', 'balance') || '0',
    lowBalanceLimit: get('Low Balance Limit', 'lowBalanceLimit') || '200',
    activationDate: get('Activation Date', 'activationDate'),
    expiryDate: get('Expiry Date', 'expiryDate'),
    documentUrl: get('Barcode Document', 'documentUrl', 'document'),
    remarks: get('Remarks', 'remarks'),
    timestamp: get('Timestamp', 'timestamp') || createTimestamp(),
    createdAt: get('Timestamp', 'createdAt') || createTimestamp(),
  };
};

// ─── FASTAG CRUD ──────────────────────────────────────────────────────────────
export const getFastags = async () => {
  await delay();
  return load(KEYS.FASTAGS);
};

export const saveFastag = async (fastagData) => {
  const fastags = load(KEYS.FASTAGS);
  const now = createTimestamp();
  const idx = fastags.findIndex(f => (fastagData.vehicleId && f.vehicleId === fastagData.vehicleId) || (fastagData.registrationNo && f.registrationNo === fastagData.registrationNo));

  let savedRecord;
  if (idx !== -1) {
    savedRecord = {
      ...fastags[idx],
      ...fastagData,
      fastagStatus: fastagData.fastagStatus || 'Active',
      updatedAt: now,
    };
    fastags[idx] = savedRecord;
    save(KEYS.FASTAGS, fastags);

    await sendToSheet({
      action: 'update',
      sheetName: 'Fastag Details',
      keyField: 'Vehicle ID',
      keyValue: savedRecord.vehicleId,
      data: mapFastagToSheet(savedRecord)
    });
  } else {
    savedRecord = {
      ...fastagData,
      id: fastagData.id || `ft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      fastagStatus: fastagData.fastagStatus || 'Active',
      timestamp: now,
      createdAt: now,
    };
    fastags.push(savedRecord);
    save(KEYS.FASTAGS, fastags);

    await sendToSheet({
      action: 'add',
      sheetName: 'Fastag Details',
      data: mapFastagToSheet(savedRecord)
    });
  }

  return savedRecord;
};

export const deleteFastag = async (vehicleId) => {
  const fastags = load(KEYS.FASTAGS);
  const target = fastags.find(f => f.vehicleId === vehicleId || f.id === vehicleId);
  const filtered = fastags.filter(f => f.vehicleId !== vehicleId && f.id !== vehicleId);
  save(KEYS.FASTAGS, filtered);

  if (target) {
    const keyVal = target.vehicleId || vehicleId;
    await sendToSheet({
      action: 'delete',
      sheetName: 'Fastag Details',
      keyField: 'Vehicle ID',
      keyValue: keyVal,
      data: { 'Vehicle ID': keyVal }
    });
  }
  return true;
};

// ─── LOGIN PAGE / USER MANAGEMENT LIVE SYNC ─────────────────────────────────
export const pushUsersToSheet = async (usersList = null) => {
  const users = usersList || load(KEYS.USERS);
  if (!users || users.length === 0) return false;

  let allSuccess = true;
  for (const user of users) {
    const mapped = mapUserToSheet(user);
    const ok = await sendToSheet({
      action: 'update',
      sheetName: 'Login Page',
      keyField: 'User',
      keyValue: user.email,
      data: mapped
    });
    if (!ok) allSuccess = false;
  }
  return allSuccess;
};

export const addUserToSheet = async (user) => {
  return await sendToSheet({
    action: 'add',
    sheetName: 'Login Page',
    data: mapUserToSheet(user)
  });
};

export const updateUserInSheet = async (user) => {
  return await sendToSheet({
    action: 'update',
    sheetName: 'Login Page',
    keyField: 'User',
    keyValue: user.email,
    data: mapUserToSheet(user)
  });
};

export const deleteUserFromSheet = async (userEmail) => {
  return await sendToSheet({
    action: 'delete',
    sheetName: 'Login Page',
    keyField: 'User',
    keyValue: userEmail,
    data: { User: userEmail }
  });
};

export const syncUsersFromSheet = async () => {
  let remote = await fetchFromSheet('get_LoginPage', 'Login Page');
  if (!remote || !Array.isArray(remote) || remote.length === 0) {
    const all = await fetchFromSheet('getAll');
    if (all && typeof all === 'object') {
      const loginKey = Object.keys(all).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes('login'));
      if (loginKey && Array.isArray(all[loginKey])) {
        remote = all[loginKey];
      }
    }
  }
  if (Array.isArray(remote)) {
    const mapped = remote.map(mapSheetRowToUser).filter(Boolean);
    if (mapped.length > 0) {
      localStorage.setItem(KEYS.USERS, JSON.stringify(mapped));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cms_users_updated', { detail: mapped }));
        window.dispatchEvent(new CustomEvent('cms_datastore_updated'));
      }
      return mapped;
    }
  }
  return null;
};


