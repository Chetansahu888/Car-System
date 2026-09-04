// components/shared/GoogleSheetModal.jsx
import { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertCircle, Copy, Check, ExternalLink, RefreshCw, Sparkles, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { getScriptUrl, setScriptUrl, testConnection } from '../../api/googleSheetsClient';
import { syncAllFromSheets } from '../../store/dataStore';
import Modal from '../ui/Modal';

export default function GoogleSheetModal({ isOpen, onClose }) {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(null); // { success: boolean, message: string }

  useEffect(() => {
    if (isOpen) {
      const currentUrl = getScriptUrl() || '';
      setUrl(currentUrl);
      if (currentUrl) {
        setStatus({ success: true, message: 'Google Sheets URL configured.' });
      } else {
        setStatus(null);
      }
    }
  }, [isOpen]);

  const handleSaveAndTest = async () => {
    if (!url.trim()) {
      setScriptUrl('');
      setStatus({ success: false, message: 'URL cleared. App running in local mode.' });
      toast.success('Switched to local mode');
      return;
    }

    setTesting(true);
    const result = await testConnection(url.trim());
    setTesting(false);
    setStatus(result);

    if (result.success) {
      setScriptUrl(url.trim());
      toast.success('Connected to Google Sheet successfully!');
    } else {
      toast.error(result.message || 'Connection test failed');
    }
  };

  const handleSyncData = async () => {
    setSyncing(true);
    try {
      const ok = await syncAllFromSheets();
      if (ok) {
        toast.success('All tables synced from Google Sheets!');
        onClose();
        window.location.reload();
      } else {
        toast.error('Sync failed. Please check script deployment permissions.');
      }
    } catch (err) {
      toast.error(err.message || 'Sync error');
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyScript = () => {
    const scriptCode = `/**
 * CAR FLEET MANAGEMENT SYSTEM — GOOGLE APPS SCRIPT
 * Paste this into Google Sheet Extensions > Apps Script and Deploy as Web App!
 */
const SHEET_NAMES = {
  CARS: 'Purchase_Car',
  INSURANCE: 'Insurance',
  REPAIRS: 'Car_Repair',
  CLAIMS: 'Accident_Claims',
  VENDOR_OFFERS: 'Vendor_Offers',
  DELIVERY_PLANNING: 'Delivery_Planning',
  DELIVERIES: 'Delivery_Car',
  PAYMENTS: 'Payment'
};

const HEADERS = {
  [SHEET_NAMES.CARS]: ['vehicleId', 'carName', 'dateOfPurchase', 'modelNo', 'companyPurchasedFrom', 'fuelType', 'registrationNo', 'chassisNo', 'engineNo', 'hypothecationBank', 'lastEmiDate', 'dateOfReleaseHypothecation', 'valueOfCar', 'emiAmount', 'insuranceAmount', 'rtoAmount', 'companyMobileNo', 'servicePersonName', 'servicePersonMobileNo', 'copyOfInsurance', 'copyOfRegistration', 'nameOfCompany', 'nameOfOwner', 'agentName', 'dateOfInsurance', 'pollutionDate', 'createdAt'],
  [SHEET_NAMES.INSURANCE]: ['id', 'vehicleId', 'carName', 'nameOfCompany', 'idvValue', 'totalPremiumToBePaid', 'basicPremium', 'thirdPartyPremium', 'addOnPremium', 'depreciationReimbursement', 'engineSecure', 'consumableExpenses', 'personalBelonging', 'roadsideAssistance', 'keyReplacement', 'emergencyTransportHotel', 'taxAmount', 'totalPremiumAmount', 'claimedLastYear', 'policyInclusiveOfNcb', 'premiumOfNcb', 'cashlessPolicy', 'date', 'validityDate', 'renewalDate', 'createdAt', 'updatedAt'],
  [SHEET_NAMES.REPAIRS]: ['id', 'repairNo', 'vehicleId', 'carName', 'reasonForRepair', 'garage', 'whoTakingCar', 'insuranceToBeClaimed', 'department', 'repairStatus', 'timestamp', 'createdAt', 'updatedAt'],
  [SHEET_NAMES.CLAIMS]: ['id', 'claimNo', 'repairNo', 'vehicleId', 'vehicleName', 'registrationNo', 'dateOfAccident', 'timeOfAccident', 'accidentLocation', 'accidentReason', 'driverName', 'driverMobileNo', 'insuranceCompany', 'policyNo', 'policyValidity', 'insuranceClaim', 'estimatedClaimAmount', 'accidentPhotos', 'firRequired', 'firCopy', 'policeReport', 'otherDocuments', 'claimIntimatedDate', 'claimIntimationNo', 'surveyorName', 'surveyorMobileNo', 'surveyDate', 'surveyStatus', 'claimStatus', 'claimApprovedAmount', 'claimRejectedReason', 'claimSettlementDate', 'remarks', 'createdAt', 'updatedAt'],
  [SHEET_NAMES.VENDOR_OFFERS]: ['id', 'repairNo', 'vehicleId', 'photoOfOffer', 'insurance', 'typesOfRepair', 'approvalStatus', 'rejectionReason', 'approvedAt', 'rejectedAt', 'timestamp', 'createdAt'],
  [SHEET_NAMES.DELIVERY_PLANNING]: ['id', 'repairNo', 'vehicleId', 'garageName', 'vehicleName', 'dateVehicleReceived', 'kmAtTimeOfRepair', 'repairWorkDone', 'partsAmount', 'serviceAmount', 'insuranceClaimed', 'insuranceAmount', 'billAmount', 'billImage', 'createdAt'],
  [SHEET_NAMES.DELIVERIES]: ['id', 'repairNo', 'vehicleId', 'garageName', 'vehicleName', 'dateVehicleReceived', 'kmAtTimeOfRepair', 'repairWorkDone', 'partsAmount', 'serviceAmount', 'insuranceClaimed', 'insuranceAmount', 'billAmount', 'billImage', 'deliveryStatus', 'submittedAt', 'createdAt'],
  [SHEET_NAMES.PAYMENTS]: ['id', 'repairNo', 'vehicleId', 'garageName', 'vehicleName', 'dateVehicleReceived', 'kmAtTimeOfRepair', 'serviceAmount', 'billAmount', 'billImage', 'paymentStatus', 'timestamp', 'createdAt', 'updatedAt']
};

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headers = HEADERS[name];
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#ecfdf5').setFontColor('#065f46');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const rows = data.slice(1);
  return rows.map((row, rowIdx) => {
    const obj = { _row: rowIdx + 2 };
    headers.forEach((h, i) => {
      let val = row[i];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
        try { val = JSON.parse(val); } catch (e) {}
      }
      obj[h] = val;
    });
    return obj;
  });
}

function objectToRow(obj, headers) {
  return headers.map(h => {
    const val = obj[h];
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
  });
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = e?.parameter?.action || 'getAll';
    if (action === 'ping') {
      return createJsonResponse({ status: 'ok', message: 'Car Fleet System API connected successfully', timestamp: new Date().toISOString() });
    }
    if (action === 'getAll') {
      const result = {};
      Object.keys(SHEET_NAMES).forEach(key => {
        const name = SHEET_NAMES[key];
        const sheet = getOrCreateSheet(ss, name);
        result[key.toLowerCase()] = sheetToObjects(sheet);
      });
      return createJsonResponse({ status: 'success', data: result });
    }
    return createJsonResponse({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    const { action, sheetName, data, keyField, keyValue } = body;
    const targetSheetName = sheetName || SHEET_NAMES[body.target];
    if (!targetSheetName) return createJsonResponse({ status: 'error', message: 'Sheet name required' });
    const sheet = getOrCreateSheet(ss, targetSheetName);
    const headers = HEADERS[targetSheetName] || sheet.getDataRange().getValues()[0];

    if (action === 'add' || action === 'insert') {
      sheet.appendRow(objectToRow(data, headers));
      return createJsonResponse({ status: 'success', data });
    }
    if (action === 'update') {
      const allRows = sheet.getDataRange().getValues();
      const colIdx = headers.indexOf(keyField);
      let foundRow = -1;
      for (let i = 1; i < allRows.length; i++) {
        if (String(allRows[i][colIdx]) === String(keyValue)) { foundRow = i + 1; break; }
      }
      if (foundRow === -1) {
        sheet.appendRow(objectToRow(data, headers));
        return createJsonResponse({ status: 'success', data });
      }
      const existingData = sheetToObjects(sheet).find(r => String(r[keyField]) === String(keyValue)) || {};
      const merged = { ...existingData, ...data };
      sheet.getRange(foundRow, 1, 1, headers.length).setValues([objectToRow(merged, headers)]);
      return createJsonResponse({ status: 'success', data: merged });
    }
    if (action === 'delete') {
      const allRows = sheet.getDataRange().getValues();
      const colIdx = headers.indexOf(keyField);
      for (let i = 1; i < allRows.length; i++) {
        if (String(allRows[i][colIdx]) === String(keyValue)) { sheet.deleteRow(i + 1); break; }
      }
      return createJsonResponse({ status: 'success', deleted: true });
    }
    return createJsonResponse({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}`;

    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    toast.success('Apps Script code copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  const isConnected = status?.success;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Google Sheets Integration" icon={FileSpreadsheet} size="lg">
      <div>
        {/* Status Card */}
        <div style={{
          padding: '16px 20px', borderRadius: 14,
          background: isConnected ? '#ecfdf5' : '#f8fafc',
          border: `1.5px solid ${isConnected ? '#a7f3d0' : '#e2e8f0'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24, gap: 14
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: isConnected ? '#059669' : '#64748b',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>
                Status: {isConnected ? <span style={{ color: '#059669' }}>🟢 Connected to Google Sheet</span> : <span style={{ color: '#64748b' }}>🟡 Local Storage Mode</span>}
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                {status ? status.message : 'Paste your Google Apps Script Web App URL below to sync.'}
              </div>
            </div>
          </div>

          {isConnected && (
            <button
              onClick={handleSyncData}
              disabled={syncing}
              className="btn btn-xs btn-outline"
              style={{ fontWeight: 700, padding: '6px 12px', borderRadius: 8 }}
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Sheet'}
            </button>
          )}
        </div>

        {/* URL Input */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label" style={{ fontSize: 13, fontWeight: 700 }}>
            Google Apps Script Web App URL
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="form-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
            />
            <button
              type="button"
              onClick={handleSaveAndTest}
              disabled={testing}
              className="btn btn-primary"
              style={{ minWidth: 140 }}
            >
              {testing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Testing...</> : 'Save & Test'}
            </button>
          </div>
        </div>

        {/* 4 Step Setup Guide */}
        <div className="section-card" style={{ background: '#fafcfb', border: '1px solid #e2f0e7', padding: '18px 20px', borderRadius: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="#059669" />
              Easy 4-Step Google Sheet Setup Guide
            </div>
            <button
              type="button"
              onClick={handleCopyScript}
              className="btn btn-outline btn-xs"
              style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {copied ? <Check size={13} color="#059669" /> : <Copy size={13} />}
              {copied ? 'Copied Code!' : 'Copy Apps Script Code'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#334155' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#ecfdf5', color: '#059669', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</span>
              <span>Open your Google Sheet, click <strong>Extensions</strong> → <strong>Apps Script</strong>.</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#ecfdf5', color: '#059669', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</span>
              <span>Click the button above to <strong>Copy Apps Script Code</strong> and replace all code in <code>Code.gs</code>.</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#ecfdf5', color: '#059669', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</span>
              <span>Click <strong>Deploy</strong> → <strong>New deployment</strong> → Select <strong>Web app</strong> → Set <em>"Who has access"</em> to <strong>"Anyone"</strong> → Click <strong>Deploy</strong>.</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#ecfdf5', color: '#059669', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>4</span>
              <span>Copy the <strong>Web App URL</strong>, paste it into the field above, and click <strong>Save & Test</strong>!</span>
            </div>
          </div>
        </div>

        {/* Auto Sheet Creation Note */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#059669', fontWeight: 600, background: '#ecfdf5', padding: '10px 14px', borderRadius: 10 }}>
          <ShieldCheck size={16} />
          <span>The script automatically creates and headers all 8 tabs (Purchase_Car, Insurance, Car_Repair, etc.) automatically!</span>
        </div>

        <div className="modal-footer" style={{ padding: '20px 0 0', marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
