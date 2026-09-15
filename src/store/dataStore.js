// store/dataStore.js
// Dual-layer data store: Synchronous local state + background sync to connected Google Sheets API.

import { getScriptUrl, fetchFromSheet, sendToSheet } from '../api/googleSheetsClient';
import { createTimestamp } from '../utils/dateUtils';

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
};

export const PAGE_STEPS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'purchase_car', label: 'Purchase Car' },
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

// ─── MAPPER FOR "Purchase Car Details" SHEET ──────────────────────────────────
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
  "HYPOTHICATION BANK": car.hypothecationBank || '',
  "LAST EMI DATE": car.lastEmiDate || '',
  "DATE OF RELEASE OF HYPOTHICATION": car.dateOfReleaseHypothecation || '',
  "VALUE OF CAR": car.valueOfCar || '',
  "EMI AMOUNT": car.emiAmount || '',
  "INSURANCE AMOUNT": car.insuranceAmount || '',
  "RTO AMOUNT": car.rtoAmount || '',
  "COMPANY MOBILE NO.": car.companyMobileNo || '',
  "SERVICE PERSON NAME": car.servicePersonName || '',
  "SERVICE PERSON MOBILE NO": car.servicePersonMobileNo || '',
  "Copy Of Insurance": car.copyOfInsurance?.url || (typeof car.copyOfInsurance === 'string' ? car.copyOfInsurance : '') || '',
  "Copy Of Registration": car.copyOfRegistration?.url || (typeof car.copyOfRegistration === 'string' ? car.copyOfRegistration : '') || '',
  "Name Of The Company": car.nameOfCompany || '',
  "Name Of The Owner": car.nameOfOwner || '',
  "Agent Name": car.agentName || '',
  "Date Of Insurance": car.dateOfInsurance || '',
  "Pollution Date": car.pollutionDate || '',
});

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
    hypothecationBank: get('HYPOTHICATION BANK', 'Hypothecation Bank', 'hypothecationBank'),
    lastEmiDate: get('LAST EMI DATE', 'Last EMI Date', 'lastEmiDate'),
    dateOfReleaseHypothecation: get('DATE OF RELEASE OF HYPOTHICATION', 'Date of Release of Hypothecation', 'dateOfReleaseHypothecation'),
    valueOfCar: get('VALUE OF CAR', 'Value of Car', 'valueOfCar'),
    emiAmount: get('EMI AMOUNT', 'EMI Amount', 'emiAmount'),
    insuranceAmount: get('INSURANCE AMOUNT', 'Insurance Amount', 'insuranceAmount'),
    rtoAmount: get('RTO AMOUNT', 'RTO Amount', 'rtoAmount'),
    companyMobileNo: get('COMPANY MOBILE NO.', 'COMPANY MOBILE NO', 'Company Mobile No', 'companyMobileNo'),
    servicePersonName: get('SERVICE PERSON NAME', 'Service Person Name', 'servicePersonName'),
    servicePersonMobileNo: get('SERVICE PERSON MOBILE NO', 'Service Person Mobile No', 'servicePersonMobileNo'),
    copyOfInsurance: get('Copy Of Insurance', 'Copy of Insurance', 'copyOfInsurance'),
    copyOfRegistration: get('Copy Of Registration', 'Copy of Registration', 'copyOfRegistration'),
    nameOfCompany: get('Name Of The Company', 'Name of the Company', 'nameOfCompany'),
    nameOfOwner: get('Name Of The Owner', 'Name of the Owner', 'nameOfOwner'),
    agentName: get('Agent Name', 'agentName'),
    dateOfInsurance: get('Date Of Insurance', 'Date of Insurance', 'dateOfInsurance'),
    pollutionDate: get('Pollution Date', 'pollutionDate'),
    timestamp: get('Timestamp', 'timestamp') || createTimestamp(),
  };
};

// ─── MAPPER FOR "Insurance Of Vehicle" SHEET ──────────────────────────────────
export const mapInsuranceToSheet = (ins) => {
  const boolToYesNo = (val) => {
    if (val === true || val === 'Yes' || val === 'yes' || val === 'TRUE' || val === 1 || val === '1') return 'Yes';
    return 'No';
  };

  return {
    "Timestamp": ins.timestamp || ins.createdAt || createTimestamp(),
    "Vehicle ID": ins.vehicleId || '',
    "Date": ins.date || '',
    "Car Name": ins.carName || '',
    "Name Of Company": ins.nameOfCompany || '',
    "IDV Value": ins.idvValue || '',
    "Total Premium To Be Paid": ins.totalPremiumToBePaid || '',
    "Basic Premium": ins.basicPremium || '',
    "Third Party Premium": ins.thirdPartyPremium || '',
    "Add On Premium": ins.addOnPremium || '',
    "Depreciation Reimbursement": boolToYesNo(ins.depreciationReimbursement),
    "Engine Secure": boolToYesNo(ins.engineSecure),
    "Consumable Expenses": boolToYesNo(ins.consumableExpenses),
    "Lose Of Personal Belonging": boolToYesNo(ins.personalBelonging || ins.loseOfPersonalBelonging),
    "Roadside Assistances": boolToYesNo(ins.roadsideAssistance || ins.roadsideAssistances),
    "Key Replacement": boolToYesNo(ins.keyReplacement),
    "Emergency Transport And Hotel": boolToYesNo(ins.emergencyTransportHotel || ins.emergencyTransportAndHotel),
    "Tax Amount": ins.taxAmount || '',
    "Total Premium Amount": ins.totalPremiumAmount || '',
    "Did We Claim Insurance Last Year": ins.claimedLastYear || ins.didWeClaimInsuranceLastYear || 'No',
    "Is The Proposed Policy Inclusive Of NCB": ins.policyInclusiveOfNcb || ins.isTheProposedPolicyInclusiveOfNcb || 'No',
    "What Is Premium Of NCB": ins.premiumOfNcb || ins.whatIsPremiumOfNcb || '',
    "Is It Cashless Policy": ins.cashlessPolicy || ins.isItCashlessPolicy || 'Yes',
  };
};

export const mapSheetRowToInsurance = (row, index) => {
  const carName = row['Car Name'] || row.carName || '';
  const date = row['Date'] || row.date || '';
  const nameOfCompany = row['Name Of Company'] || row['Name of Company'] || row.nameOfCompany || '';
  if (!carName && !date && !nameOfCompany) return null;

  const isYes = (val) => val === 'Yes' || val === 'yes' || val === true || val === 'TRUE';

  return {
    id: row.id || `ins_${index + 1}`,
    vehicleId: row['Vehicle ID'] || row.vehicleId || '',
    carName: carName,
    date: date,
    nameOfCompany: nameOfCompany,
    idvValue: row['IDV Value'] || row.idvValue || '',
    totalPremiumToBePaid: row['Total Premium To Be Paid'] || row.totalPremiumToBePaid || '',
    basicPremium: row['Basic Premium'] || row.basicPremium || '',
    thirdPartyPremium: row['Third Party Premium'] || row.thirdPartyPremium || '',
    addOnPremium: row['Add On Premium'] || row.addOnPremium || '',
    depreciationReimbursement: isYes(row['Depreciation Reimbursement'] || row.depreciationReimbursement),
    engineSecure: isYes(row['Engine Secure'] || row.engineSecure),
    consumableExpenses: isYes(row['Consumable Expenses'] || row.consumableExpenses),
    personalBelonging: isYes(row['Lose Of Personal Belonging'] || row['Loss Of Personal Belonging'] || row.personalBelonging),
    roadsideAssistance: isYes(row['Roadside Assistances'] || row['Roadside Assistance'] || row.roadsideAssistance),
    keyReplacement: isYes(row['Key Replacement'] || row.keyReplacement),
    emergencyTransportHotel: isYes(row['Emergency Transport And Hotel'] || row['Emergency Transport & Hotel'] || row.emergencyTransportHotel),
    taxAmount: row['Tax Amount'] || row.taxAmount || '',
    totalPremiumAmount: row['Total Premium Amount'] || row.totalPremiumAmount || '',
    claimedLastYear: row['Did We Claim Insurance Last Year'] || row.claimedLastYear || 'No',
    policyInclusiveOfNcb: row['Is The Proposed Policy Inclusive Of NCB'] || row.policyInclusiveOfNcb || 'No',
    premiumOfNcb: row['What Is Premium Of NCB'] || row.premiumOfNcb || '',
    cashlessPolicy: row['Is It Cashless Policy'] || row.cashlessPolicy || 'Yes',
    timestamp: row['Timestamp'] || row.timestamp || '',
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

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const seed = () => {
  const version = 'cms_seeded_v10';
  if (localStorage.getItem(version)) return;
  localStorage.setItem(version, 'true');
  localStorage.removeItem(KEYS.DELIVERIES);
  localStorage.removeItem(KEYS.DELIVERY_PLANNING);

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

const delay = (ms = 100) => new Promise((res) => setTimeout(res, ms));

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
      const purchaseCarsKey = Object.keys(remoteData).find(k => {
        const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        return norm === 'purchasecardetails' || norm === 'purchasecar' || norm === 'cars' || norm.includes('purchasecar');
      });
      const purchaseCars = purchaseCarsKey ? remoteData[purchaseCarsKey] : (remoteData['purchase car details'] || remoteData['Purchase Car Details'] || remoteData.cars);
      if (Array.isArray(purchaseCars) && purchaseCars.length > 0) {
        const validMappedCars = purchaseCars.map(mapSheetRowToCar).filter(Boolean);
        if (validMappedCars.length > 0) {
          const current = load(KEYS.CARS);
          const currentKey = current.map(c => `${c.vehicleId}-${c.carName}-${c.registrationNo}-${c.firmName || ''}`).join('|');
          const newKey = validMappedCars.map(c => `${c.vehicleId}-${c.carName}-${c.registrationNo}-${c.firmName || ''}`).join('|');
          if (currentKey !== newKey) {
            localStorage.setItem(KEYS.CARS, JSON.stringify(validMappedCars));
            changed = true;
          }
        }
      }

      // 2. Repairs (Check FMS / Car_Repair)
      const repairsData = remoteData['fms'] || remoteData['FMS'] || remoteData['car_repair'] || remoteData['Car_Repair'] || remoteData.repairs;
      if (Array.isArray(repairsData) && repairsData.length > 0) {
        const validMappedRepairs = repairsData.map(mapSheetRowToRepair).filter(Boolean);
        if (validMappedRepairs.length > 0) {
          const current = load(KEYS.REPAIRS);
          const currentKey = current.map(r => `${r.repairNo}-${r.carName}-${r.vehicleId}-${r.plannedDate || ''}-${r.plannedDate2 || ''}-${r.actualDate || ''}-${r.actualDate2 || ''}-${r.repairStatus}`).join('|');
          const newKey = validMappedRepairs.map(r => `${r.repairNo}-${r.carName}-${r.vehicleId}-${r.plannedDate || ''}-${r.plannedDate2 || ''}-${r.actualDate || ''}-${r.actualDate2 || ''}-${r.repairStatus}`).join('|');
          if (currentKey !== newKey) {
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

          if (fmsOffers.length > 0) {
            const currentOffers = load(KEYS.VENDOR_OFFERS);
            const currentKeyOffers = currentOffers.map(o => `${o.repairNo}-${o.actualDate || ''}-${o.plannedDate2 || ''}-${o.actualDate2 || ''}-${o.approvalStatus}-${o.expectedCompletionDate || ''}-${o.garageName || ''}`).join('|');
            const newKeyOffers = fmsOffers.map(o => `${o.repairNo}-${o.actualDate || ''}-${o.plannedDate2 || ''}-${o.actualDate2 || ''}-${o.approvalStatus}-${o.expectedCompletionDate || ''}-${o.garageName || ''}`).join('|');
            if (currentKeyOffers !== newKeyOffers) {
              localStorage.setItem(KEYS.VENDOR_OFFERS, JSON.stringify(fmsOffers));
              changed = true;
            }
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

          if (fmsDeliveries.length > 0) {
            const currentDelKey = currentDeliveries.map(d => `${d.repairNo}-${d.actualDate3 || ''}-${d.dateVehicleReceived || ''}-${d.billAmount || ''}`).join('|');
            const newDelKey = fmsDeliveries.map(d => `${d.repairNo}-${d.actualDate3 || ''}-${d.dateVehicleReceived || ''}-${d.billAmount || ''}`).join('|');
            if (currentDelKey !== newDelKey) {
              localStorage.setItem(KEYS.DELIVERIES, JSON.stringify(fmsDeliveries));
              changed = true;
            }
          }
        }
      }

      // 3. Claims
      const claimsData = remoteData['if accident / insurance claims'] || remoteData['If Accident / Insurance Claims'] || remoteData.claims;
      if (Array.isArray(claimsData) && claimsData.length > 0) {
        const current = load(KEYS.CLAIMS);
        const currentKey = current.map(c => `${c.claimNo}-${c.repairNo}-${c.claimStatus}`).join('|');
        const newKey = claimsData.map(c => `${c.claimNo || c['Claim No.']}-${c.repairNo || c['Repair No.']}-${c.claimStatus || c['Claim Status']}`).join('|');
        if (currentKey !== newKey) {
          localStorage.setItem(KEYS.CLAIMS, JSON.stringify(claimsData));
          changed = true;
        }
      }

      // 4. Insurance
      const insData = remoteData['Insurance Of Vehicle'] || remoteData['Insurance of Vehicle'] || remoteData['Insurance_Of_Vehicle'] || remoteData['insurance'] || remoteData['Insurance'] || remoteData.insurance;
      if (Array.isArray(insData) && insData.length > 0) {
        const mappedIns = insData.map(mapSheetRowToInsurance).filter(Boolean);
        if (mappedIns.length > 0) {
          const current = load(KEYS.INSURANCE);
          const currentKey = current.map(i => `${i.carName}-${i.date}-${i.totalPremiumAmount}-${i.idvValue}`).join('|');
          const newKey = mappedIns.map(i => `${i.carName}-${i.date}-${i.totalPremiumAmount}-${i.idvValue}`).join('|');
          if (currentKey !== newKey) {
            localStorage.setItem(KEYS.INSURANCE, JSON.stringify(mappedIns));
            changed = true;
          }
        }
      }

      // 5. Challans
      const challansData = remoteData['Challan Details'] || remoteData['Challans'] || remoteData['challans'] || remoteData['Challan'];
      if (Array.isArray(challansData) && challansData.length > 0) {
        const mappedChallans = challansData.map(mapSheetRowToChallan).filter(Boolean);
        if (mappedChallans.length > 0) {
          const current = load(KEYS.CHALLANS);
          const currentKey = current.map(c => `${c.id}-${c.vehicleId}-${c.paymentStatus}-${c.challanAmount}`).join('|');
          const newKey = mappedChallans.map(c => `${c.id}-${c.vehicleId}-${c.paymentStatus}-${c.challanAmount}`).join('|');
          if (currentKey !== newKey) {
            localStorage.setItem(KEYS.CHALLANS, JSON.stringify(mappedChallans));
            changed = true;
          }
        }
      }

      // 6. Fastags
      const fastagData = remoteData['Fastag Details'] || remoteData['Fastags'] || remoteData['fastag'] || remoteData['Fastag'];
      if (Array.isArray(fastagData) && fastagData.length > 0) {
        const mappedFastags = fastagData.map(mapSheetRowToFastag).filter(Boolean);
        if (mappedFastags.length > 0) {
          const current = load(KEYS.FASTAGS);
          const currentKey = current.map(f => `${f.vehicleId}-${f.tagId}-${f.fastagStatus}-${f.balance}`).join('|');
          const newKey = mappedFastags.map(f => `${f.vehicleId}-${f.tagId}-${f.fastagStatus}-${f.balance}`).join('|');
          if (currentKey !== newKey) {
            localStorage.setItem(KEYS.FASTAGS, JSON.stringify(mappedFastags));
            changed = true;
          }
        }
      }

      // 7. Login Page / Users
      const loginSheetKey = Object.keys(remoteData).find(k => {
        const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        return norm === 'loginpage' || norm === 'login' || norm === 'users' || norm === 'logindetails';
      });
      const loginRows = loginSheetKey ? remoteData[loginSheetKey] : (remoteData['Login Page'] || remoteData['login page'] || remoteData['Login'] || remoteData['Users']);
      if (Array.isArray(loginRows) && loginRows.length > 0) {
        const mappedUsers = loginRows.map(mapSheetRowToUser).filter(Boolean);
        if (mappedUsers.length > 0) {
          const currentUsersRaw = localStorage.getItem('cms_users');
          const currentUsers = currentUsersRaw ? JSON.parse(currentUsersRaw) : [];
          const currentKey = currentUsers.map(u => `${u.email}-${u.password}-${u.role}-${JSON.stringify(u.permissions || {})}`).join('|');
          const newKey = mappedUsers.map(u => `${u.email}-${u.password}-${u.role}-${JSON.stringify(u.permissions || {})}`).join('|');
          if (currentKey !== newKey) {
            localStorage.setItem('cms_users', JSON.stringify(mappedUsers));
            changed = true;
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('cms_users_updated', { detail: mappedUsers }));
            }
          }
        }
      } else if (loginSheetKey && Array.isArray(loginRows) && loginRows.length === 0) {
        // Tab exists but has 0 rows - initialize it with current users!
        const currentUsersRaw = localStorage.getItem('cms_users');
        if (currentUsersRaw) {
          try {
            const currentUsers = JSON.parse(currentUsersRaw);
            if (Array.isArray(currentUsers) && currentUsers.length > 0) {
              pushUsersToSheet(currentUsers);
            }
          } catch (e) {}
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
export const initLiveSyncService = (intervalMs = 8000) => {
  if (typeof window === 'undefined') return;

  syncAllFromSheets(true);

  const intervalId = setInterval(() => {
    if (document.visibilityState === 'visible') {
      syncAllFromSheets(true);
    }
  }, intervalMs);

  const onFocus = () => syncAllFromSheets(true);
  window.addEventListener('focus', onFocus);

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
  return cars[idx];
};

export const deleteCar = async (vehicleId) => {
  const cars = load(KEYS.CARS);
  const carToDelete = cars.find(c => c.vehicleId === vehicleId);
  const remaining = cars.filter(c => c.vehicleId !== vehicleId);
  save(KEYS.CARS, remaining);

  if (carToDelete) {
    await sendToSheet({
      action: 'delete',
      sheetName: 'Purchase Car Details',
      keyField: 'REGISTRATION NO.',
      keyValue: carToDelete.registrationNo
    });
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
  const item = { ...ins, timestamp: now, createdAt: now };
  all.push(item);
  save(KEYS.INSURANCE, all);
  await sendToSheet({ action: 'add', sheetName: 'Insurance Of Vehicle', data: mapInsuranceToSheet(item) });
  return item;
};

export const updateInsurance = async (id, updates) => {
  const all = load(KEYS.INSURANCE);
  const idx = all.findIndex(i => i.id === id);
  if (idx === -1) throw new Error('Insurance not found');
  all[idx] = { ...all[idx], ...updates, updatedAt: createTimestamp() };
  save(KEYS.INSURANCE, all);
  await sendToSheet({ action: 'update', sheetName: 'Insurance Of Vehicle', keyField: 'Car Name', keyValue: all[idx].carName, data: mapInsuranceToSheet(all[idx]) });
  return all[idx];
};

export const renewInsurance = async (vehicleId, renewalData) => {
  const all = load(KEYS.INSURANCE);
  const idx = all.findIndex(i => i.vehicleId === vehicleId || i.carName === renewalData.carName);
  const now = createTimestamp();
  const updatedRecord = {
    ...(idx !== -1 ? all[idx] : {}),
    ...renewalData,
    vehicleId,
    timestamp: now,
    updatedAt: now,
  };
  
  if (idx !== -1) {
    all[idx] = updatedRecord;
    sendToSheet({ action: 'update', sheetName: 'Insurance Of Vehicle', keyField: 'Car Name', keyValue: updatedRecord.carName, data: mapInsuranceToSheet(updatedRecord) });
  } else {
    const newId = `ins_${Date.now()}`;
    const newRecord = { ...updatedRecord, id: newId, createdAt: now };
    all.push(newRecord);
    sendToSheet({ action: 'add', sheetName: 'Insurance Of Vehicle', data: mapInsuranceToSheet(newRecord) });
  }
  save(KEYS.INSURANCE, all);
  
  // Also update vehicle's master dateOfInsurance
  const cars = load(KEYS.CARS);
  const carIdx = cars.findIndex(c => c.vehicleId === vehicleId || c.carName === renewalData.carName);
  if (carIdx !== -1 && renewalData.date) {
    cars[carIdx].dateOfInsurance = renewalData.date;
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

export const deleteInsurance = async (id) => {
  const all = load(KEYS.INSURANCE);
  const item = all.find(i => i.id === id);
  const remaining = all.filter(i => i.id !== id);
  save(KEYS.INSURANCE, remaining);
  if (item) {
    await sendToSheet({ action: 'delete', sheetName: 'Insurance Of Vehicle', keyField: 'Car Name', keyValue: item.carName });
  }
};

// ─── REPAIRS CRUD (SYNC TO "FMS") ─────────────────────────────────────────────
export const getRepairs = async () => {
  await delay();
  return load(KEYS.REPAIRS);
};

export const addRepair = async (repair) => {
  const all = load(KEYS.REPAIRS);
  const now = createTimestamp();
  const item = { ...repair, timestamp: now, createdAt: now };
  all.push(item);
  save(KEYS.REPAIRS, all);

  const payload = mapRepairToSheet(item);
  await sendToSheet({ action: 'add', sheetName: 'FMS', data: payload });
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
  return all[idx];
};

export const deleteRepair = async (repairNo) => {
  const all = load(KEYS.REPAIRS).filter(r => r.repairNo !== repairNo);
  save(KEYS.REPAIRS, all);
  await sendToSheet({
    action: 'delete',
    sheetName: 'FMS',
    keyField: 'Car Repair No.',
    keyValue: repairNo
  });
};

// ─── CLAIMS CRUD ──────────────────────────────────────────────────────────────
export const getClaims = async () => {
  await delay();
  return load(KEYS.CLAIMS);
};

export const addClaim = async (claim) => {
  const all = load(KEYS.CLAIMS);
  const now = createTimestamp();
  const item = { ...claim, timestamp: now, createdAt: now };
  all.push(item);
  save(KEYS.CLAIMS, all);
  await sendToSheet({ action: 'add', sheetName: 'If Accident / Insurance Claims', data: { ...item, Timestamp: now } });
  return item;
};

export const updateClaim = async (claimNo, updates) => {
  const all = load(KEYS.CLAIMS);
  const idx = all.findIndex(c => c.claimNo === claimNo);
  if (idx === -1) throw new Error('Claim not found');
  all[idx] = { ...all[idx], ...updates, updatedAt: createTimestamp() };
  save(KEYS.CLAIMS, all);
  await sendToSheet({ action: 'update', sheetName: 'If Accident / Insurance Claims', keyField: 'claimNo', keyValue: claimNo, data: all[idx] });
  return all[idx];
};

export const deleteClaim = async (claimNo) => {
  const all = load(KEYS.CLAIMS).filter(c => c.claimNo !== claimNo);
  save(KEYS.CLAIMS, all);
  await sendToSheet({ action: 'delete', sheetName: 'If Accident / Insurance Claims', keyField: 'claimNo', keyValue: claimNo });
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
  const target = challans.find(c => c.id === id);
  const filtered = challans.filter(c => c.id !== id);
  save(KEYS.CHALLANS, filtered);

  if (target) {
    sendToSheet({
      action: 'delete',
      sheetName: 'Challan Details',
      keyField: 'Challan ID',
      keyValue: id
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
    sendToSheet({
      action: 'delete',
      sheetName: 'Fastag Details',
      keyField: 'Vehicle ID',
      keyValue: target.vehicleId
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
  const remote = await fetchFromSheet('get_LoginPage', 'Login Page');
  if (Array.isArray(remote) && remote.length > 0) {
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


