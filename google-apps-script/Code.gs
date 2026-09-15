/**
 * =========================================================================
 * UNIVERSAL GOOGLE APPS SCRIPT CONNECTOR
 * FMS Sheet:
 * - Car Repair Form: Writes Columns A:I (1 to 9)
 * - Vendor Offer Form: Writes Col K (Actual 1), Col M (Photo), Col N (Ins),
 *   Col O (Types), Col P (Garage Name), Col Q (Expected Repair Completion Date)
 * - Approval Form: Writes Col S (Actual 2 / Col 19)
 * - Delivery Form: Writes Col V (Actual 3), Col X (Date Received), Col Y (KM),
 *   Col Z (Work Done), Col AA (Parts), Col AB (Service), Col AC (Insurance Claimed),
 *   Col AD (Insurance Amount), Col AE (Bill Amount), Col AF (Bill Image)
 * - Formulas in Col L (Delay 1), Col T (Delay 2), Col W (Delay 3) are 100% PROTECTED!
 * =========================================================================
 * Google Drive Folder:
 * https://drive.google.com/drive/folders/1Ggn-bW9osS62VVJa5W8JRlS3rzyQAGEY
 * =========================================================================
 */

const DRIVE_FOLDER_ID = '1Ggn-bW9osS62VVJa5W8JRlS3rzyQAGEY';

function formatCustomTimestamp(d) {
  const date = d || new Date();
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Kolkata', 'M/d/yyyy HH:mm:ss');
}

// ─── SMART HEADER DETECTION ───────────────────────────────────────────────────
function findHeaderRowInfo(sheet) {
  const sName = sheet.getName().trim().toLowerCase();

  // FMS sheet explicitly uses Row 6 as the header row
  if (sName === 'fms' || sName === 'car_repair' || sName.includes('repair')) {
    const lastCol = Math.max(sheet.getLastColumn(), 35);
    const r6 = sheet.getRange(6, 1, 1, lastCol).getValues()[0];
    return { headerRowIndex: 6, headers: r6 };
  }

  const maxScanRows = Math.min(sheet.getLastRow(), 15);
  if (maxScanRows === 0) return { headerRowIndex: 1, headers: [] };

  const scanRange = sheet.getRange(1, 1, maxScanRows, Math.max(sheet.getLastColumn(), 1)).getValues();
  const knownHeaderKeys = ['timestamp', 'carrepairno', 'vehicleid', 'carname', 'registrationno', 'reasonforrepair', 'garage', 'department', 'user', 'email', 'name', 'password', 'role', 'accessiblesteps', 'dashboard'];

  let bestRowIndex = 1;
  let maxScore = 0;

  for (let r = 0; r < scanRange.length; r++) {
    const row = scanRange[r];
    let score = 0;
    for (let c = 0; c < row.length; c++) {
      const cellVal = normalizeKey(row[c]);
      if (cellVal && knownHeaderKeys.some(k => cellVal.includes(k))) {
        score++;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestRowIndex = r + 1;
    }
  }

  if (maxScore === 0) bestRowIndex = 1;
  const rawHeaders = scanRange[bestRowIndex - 1] || [];
  return { headerRowIndex: bestRowIndex, headers: rawHeaders };
}

// ─── GET ENDPOINT ─────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = e?.parameter?.action || 'get_all';
    const sheetName = e?.parameter?.sheet;

    if (action === 'ping') {
      const sheetsList = ss.getSheets().map(s => s.getName());
      return createJsonResponse({
        status: 'ok',
        message: 'Google Sheet & Google Drive connected successfully!',
        availableSheets: sheetsList,
        spreadsheetName: ss.getName(),
        driveFolderId: DRIVE_FOLDER_ID,
        timestamp: formatCustomTimestamp()
      });
    }

    if (sheetName) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return createJsonResponse({ status: 'error', message: `Sheet "${sheetName}" not found` });
      return createJsonResponse({ status: 'success', sheet: sheetName, data: getSheetDataSmart(sheet) });
    }

    const allData = {};
    ss.getSheets().forEach(sheet => {
      allData[sheet.getName()] = getSheetDataSmart(sheet);
    });
    return createJsonResponse({ status: 'success', data: allData });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// ─── POST ENDPOINT ────────────────────────────────────────────────────
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    const { action, sheetName, data, keyField, keyValue, fileData, filename, mimeType } = body;

    // ─── 0. DIRECT FILE UPLOAD ───
    if (action === 'upload_file') {
      if (!fileData) return createJsonResponse({ status: 'error', message: 'fileData is required' });
      const uploadResult = saveBase64FileToDrive(fileData, filename || 'uploaded_file', mimeType);
      return createJsonResponse(uploadResult);
    }

    if (!sheetName) return createJsonResponse({ status: 'error', message: 'sheetName is required' });

    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      if ((sheetName.toLowerCase().includes('repair') || sheetName.toLowerCase() === 'fms') && ss.getSheetByName('FMS')) {
        sheet = ss.getSheetByName('FMS');
      } else if (sheetName.toLowerCase().includes('insurance')) {
        const found = ss.getSheets().find(s => {
          const n = s.getName().trim().toLowerCase();
          return n.includes('insurance of vehicle') || n.includes('insurance_of_vehicle') || n === 'insurance';
        });
        if (found) sheet = found;
      } else if (sheetName.toLowerCase().includes('login') || sheetName.toLowerCase().includes('user')) {
        const found = ss.getSheets().find(s => {
          const n = s.getName().trim().toLowerCase();
          return n === 'login page' || n === 'login' || n === 'users' || n.includes('login');
        });
        if (found) sheet = found;
      }
      
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          sheet.appendRow(Object.keys(data));
        }
      }
    }

    // ─── SPECIAL 0.5: SYNC ALL USERS / INIT LOGIN PAGE ───
    if ((action === 'sync_all_users' || action === 'init_login_sheet') && (sheetName.toLowerCase().includes('login') || sheetName.toLowerCase().includes('user'))) {
      const LOGIN_HEADERS = [
        'Timestamp', 'Name', 'User', 'Password', 'Role', 'Department',
        'Dashboard', 'Purchase Car', 'Challan', 'Fastag', 'Insurance', 'Car Repair',
        'Accident / Claims', 'Vendor Offers', 'Approvals', 'Delivery Of Car', 'Payment'
      ];
      const userList = Array.isArray(data) ? data : (body.users || (data ? [data] : []));
      sheet.clear();
      sheet.appendRow(LOGIN_HEADERS);
      sheet.getRange(1, 1, 1, LOGIN_HEADERS.length)
        .setFontWeight('bold')
        .setBackground('#059669')
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center');
      sheet.setFrozenRows(1);

      userList.forEach(u => {
        if (!u) return;
        const rowVals = LOGIN_HEADERS.map(h => {
          const v = findValueByHeader(u, h);
          return v !== undefined && v !== null ? v : '';
        });
        sheet.appendRow(rowVals);
      });

      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, LOGIN_HEADERS.length).setFontSize(10).setVerticalAlignment('middle');
      }

      return createJsonResponse({
        status: 'success',
        message: `Login Page sheet populated with ${userList.length} users and all step columns!`,
        headers: LOGIN_HEADERS,
        rowCount: lastRow
      });
    }

    const { headerRowIndex, headers } = findHeaderRowInfo(sheet);
    const processedData = convertAllBase64ToDriveUrls(data) || {};

    if (processedData && typeof processedData === 'object' && Object.keys(processedData).length > 0) {
      if (!processedData['Timestamp'] && !processedData['timestamp']) {
        processedData['Timestamp'] = formatCustomTimestamp();
      }
    }

    const sName = sheet.getName().trim().toLowerCase();
    const isFMS = (sName === 'fms' || sName === 'car_repair');

    // ─── SPECIAL 1: SUBMIT VENDOR OFFER TO FMS ───
    // Col K: Actual 1 | Col M: Photo | Col N: Insurance | Col O: Types | Col P: Garage Name | Col Q: Expected Date
    // Col L (Delay 1 / Col 12) is NEVER overwritten!
    if (isFMS && (action === 'submit_vendor_offer' || (processedData && (processedData['Photo Of Offer'] !== undefined || processedData['Photo of Offer'] !== undefined || processedData['typesOfRepair'] !== undefined || processedData['Types Of Repair'] !== undefined)))) {
      const allRows = sheet.getDataRange().getValues();
      const repairNoToFind = String(keyValue || processedData['repairNo'] || processedData['Car Repair No.'] || '').trim();
      let targetRowIndex = -1;

      for (let r = headerRowIndex; r < allRows.length; r++) {
        if (String(allRows[r][1]).trim().toLowerCase() === repairNoToFind.toLowerCase()) {
          targetRowIndex = r + 1;
          break;
        }
      }

      if (targetRowIndex !== -1) {
        const actualTimestamp = processedData['Actual 1'] || processedData['actualDate'] || processedData['timestamp'] || formatCustomTimestamp();
        let photoUrl = processedData['Photo Of Offer'] || processedData['Photo of Offer'] || processedData['photoOfOffer'] || '';
        if (typeof photoUrl === 'object' && photoUrl?.url) photoUrl = photoUrl.url;

        let insuranceVal = processedData['Insurance'] || processedData['insurance'] || 'No';
        let typesVal = processedData['Types Of Repair'] || processedData['Types of Repair'] || processedData['typesOfRepair'] || '';
        if (Array.isArray(typesVal)) typesVal = typesVal.join(', ');

        let garageNameVal = processedData['Garage Name'] || processedData['garageName'] || processedData['garage'] || '';
        let expectedDateVal = processedData['Expected Repair Completion Date'] || processedData['Expected Completion Date'] || processedData['expectedCompletionDate'] || processedData['Date of Delivery From Garage'] || '';

        // Dynamic header lookup
        let colActual = -1, colPhoto = -1, colIns = -1, colTypes = -1, colGarage = -1, colExpectedDate = -1;
        for (let i = 0; i < headers.length; i++) {
          const h = normalizeKey(headers[i]);
          if (h === 'actual1' || h === 'actual') colActual = i + 1;
          else if (h === 'photoofoffer' || h === 'photo') colPhoto = i + 1;
          else if (h === 'insurance' && i >= 9 && i < 16) colIns = i + 1;
          else if (h === 'typesofrepair' || h === 'types') colTypes = i + 1;
          else if (h === 'garagename' || (h === 'garage' && i >= 9 && i < 17)) colGarage = i + 1;
          else if (h.includes('expectedrepaircompletion') || h.includes('expectedcompletion') || h.includes('repaircompletion')) {
            colExpectedDate = i + 1;
          }
        }

        // 1. Write Actual 1 (Col K / 11)
        if (colActual > 0) sheet.getRange(targetRowIndex, colActual).setValue(actualTimestamp);
        else sheet.getRange(targetRowIndex, 11).setValue(actualTimestamp);

        // 2. Col L (Delay 1 / 12) is NEVER touched (Formula stays intact!)

        // 3. Write Photo Of Offer (Col M / 13)
        if (colPhoto > 0) sheet.getRange(targetRowIndex, colPhoto).setValue(photoUrl);
        else sheet.getRange(targetRowIndex, 13).setValue(photoUrl);

        // 4. Write Insurance (Col N / 14)
        if (colIns > 0) sheet.getRange(targetRowIndex, colIns).setValue(insuranceVal);
        else sheet.getRange(targetRowIndex, 14).setValue(insuranceVal);

        // 5. Write Types Of Repair (Col O / 15)
        if (colTypes > 0) sheet.getRange(targetRowIndex, colTypes).setValue(typesVal);
        else sheet.getRange(targetRowIndex, 15).setValue(typesVal);

        // 6. Write Garage Name (Col P / 16)
        if (colGarage > 0) sheet.getRange(targetRowIndex, colGarage).setValue(garageNameVal);
        else sheet.getRange(targetRowIndex, 16).setValue(garageNameVal);

        // 7. Write Expected Repair Completion Date (Col Q / 17)
        if (expectedDateVal) {
          if (colExpectedDate > 0) sheet.getRange(targetRowIndex, colExpectedDate).setValue(expectedDateVal);
          else sheet.getRange(targetRowIndex, 17).setValue(expectedDateVal);
        }

        return createJsonResponse({
          status: 'success',
          action: 'vendor_offer_updated',
          row: targetRowIndex,
          actualDate: actualTimestamp,
          expectedCompletionDate: expectedDateVal,
          data: processedData
        });
      }
    }

    // ─── SPECIAL 2: SUBMIT APPROVAL TO FMS ───
    // Col S: Actual 2 (Col 19)
    // Col T (Delay 2 / Col 20) is NEVER overwritten!
    if (isFMS && (action === 'submit_approval' || (action === 'update' && (processedData['Actual 2'] || processedData['actualDate2'] || processedData['approvedAt'])))) {
      const allRows = sheet.getDataRange().getValues();
      const repairNoToFind = String(keyValue || processedData['repairNo'] || processedData['Car Repair No.'] || '').trim();
      let targetRowIndex = -1;

      for (let r = headerRowIndex; r < allRows.length; r++) {
        if (String(allRows[r][1]).trim().toLowerCase() === repairNoToFind.toLowerCase()) {
          targetRowIndex = r + 1;
          break;
        }
      }

      if (targetRowIndex !== -1) {
        const actualTimestamp2 = processedData['Actual 2'] || processedData['approvedAt'] || processedData['actualDate2'] || formatCustomTimestamp();
        
        let colActual2 = -1;
        for (let i = 0; i < headers.length; i++) {
          const h = normalizeKey(headers[i]);
          if (h === 'actual2' || h === 'actualdate2') {
            colActual2 = i + 1;
            break;
          }
        }

        // Write Actual 2 strictly to Col S (Col 19) or found header
        if (colActual2 > 0) sheet.getRange(targetRowIndex, colActual2).setValue(actualTimestamp2);
        else sheet.getRange(targetRowIndex, 19).setValue(actualTimestamp2);

        // Col T (Delay 2 / Col 20) is NEVER touched (Formula stays intact!)

        return createJsonResponse({
          status: 'success',
          action: 'approval_updated',
          row: targetRowIndex,
          actualDate2: actualTimestamp2,
          data: processedData
        });
      }
    }

    // ─── SPECIAL 3: SUBMIT DELIVERY OF CAR TO FMS ───
    // Col V (22): Actual 3 | Col X (24): Date Received | Col Y (25): KM | Col Z (26): Work Done
    // Col AA (27): Parts | Col AB (28): Service | Col AC (29): Insurance Claimed | Col AD (30): Insurance Amount
    // Col AE (31): Bill Amount | Col AF (32): Bill Image
    // Col W (Delay 3 / Col 23) is NEVER overwritten!
    if (isFMS && (action === 'submit_delivery' || action === 'submit_delivery_of_car')) {
      const allRows = sheet.getDataRange().getValues();
      const repairNoToFind = String(keyValue || processedData['repairNo'] || processedData['Car Repair No.'] || '').trim();
      let targetRowIndex = -1;

      for (let r = headerRowIndex; r < allRows.length; r++) {
        if (String(allRows[r][1]).trim().toLowerCase() === repairNoToFind.toLowerCase()) {
          targetRowIndex = r + 1;
          break;
        }
      }

      if (targetRowIndex !== -1) {
        const actualTimestamp3 = processedData['Actual 3'] || processedData['actualDate3'] || processedData['deliveredAt'] || formatCustomTimestamp();
        const dateReceivedVal = processedData['Date Of Vechile Received Back'] || processedData['Date Of Vehicle Received Back'] || processedData['dateVehicleReceived'] || '';
        const kmVal = processedData['K.M at The Time Of Repair'] || processedData['KM at The Time Of Repair'] || processedData['kmAtTimeOfRepair'] || '';
        const workVal = processedData['Reapir Work Done'] || processedData['Repair Work Done'] || processedData['repairWorkDone'] || '';
        const partsVal = processedData['Parts Amount'] || processedData['partsAmount'] || '';
        const serviceVal = processedData['Service Amount'] || processedData['serviceAmount'] || '';
        const insClaimedVal = processedData['Insurance Claimed (If Any)'] || processedData['Insurance Claimed'] || processedData['insuranceClaimed'] || 'No';
        const insAmtVal = processedData['Insurance Amount ( If Claimed )'] || processedData['Insurance Amount (If Claimed)'] || processedData['insuranceAmount'] || '';
        const billAmtVal = processedData['Bill Amount'] || processedData['billAmount'] || '';
        
        let billImgVal = processedData['Bill Image'] || processedData['billImage'] || '';
        if (typeof billImgVal === 'object' && billImgVal?.url) billImgVal = billImgVal.url;

        // Dynamic header index lookup
        let colActual3 = -1, colDateRec = -1, colKM = -1, colWork = -1, colParts = -1, colService = -1, colInsCl = -1, colInsAmt = -1, colBillAmt = -1, colBillImg = -1;
        for (let i = 0; i < headers.length; i++) {
          const h = normalizeKey(headers[i]);
          if (h === 'actual3' || h === 'actualdate3') colActual3 = i + 1;
          else if (h.includes('vechilereceived') || h.includes('vehiclereceived') || h.includes('datereceived')) colDateRec = i + 1;
          else if (h.includes('kmat') || h.includes('km') || h.includes('odometer')) colKM = i + 1;
          else if (h.includes('workdone') || h.includes('reapirwork') || h.includes('repairwork')) colWork = i + 1;
          else if (h === 'partsamount' || h.includes('parts')) colParts = i + 1;
          else if (h === 'serviceamount' || h.includes('service')) colService = i + 1;
          else if (h.includes('insuranceclaimed')) colInsCl = i + 1;
          else if (h.includes('insuranceamount')) colInsAmt = i + 1;
          else if (h === 'billamount' || h.includes('billamt')) colBillAmt = i + 1;
          else if (h === 'billimage' || h.includes('billphoto') || h.includes('invoice')) colBillImg = i + 1;
        }

        // 1. Write Actual 3 (Col V / Col 22)
        if (colActual3 > 0) sheet.getRange(targetRowIndex, colActual3).setValue(actualTimestamp3);
        else sheet.getRange(targetRowIndex, 22).setValue(actualTimestamp3);

        // 2. Col W (Delay 3 / Col 23) is NEVER touched (Formula stays intact!)

        // 3. Write Date Of Vehicle Received Back (Col X / Col 24)
        if (colDateRec > 0) sheet.getRange(targetRowIndex, colDateRec).setValue(dateReceivedVal);
        else sheet.getRange(targetRowIndex, 24).setValue(dateReceivedVal);

        // 4. Write K.M at The Time Of Repair (Col Y / Col 25)
        if (colKM > 0) sheet.getRange(targetRowIndex, colKM).setValue(kmVal);
        else sheet.getRange(targetRowIndex, 25).setValue(kmVal);

        // 5. Write Repair Work Done (Col Z / Col 26)
        if (colWork > 0) sheet.getRange(targetRowIndex, colWork).setValue(workVal);
        else sheet.getRange(targetRowIndex, 26).setValue(workVal);

        // 6. Write Parts Amount (Col AA / Col 27)
        if (colParts > 0) sheet.getRange(targetRowIndex, colParts).setValue(partsVal);
        else sheet.getRange(targetRowIndex, 27).setValue(partsVal);

        // 7. Write Service Amount (Col AB / Col 28)
        if (colService > 0) sheet.getRange(targetRowIndex, colService).setValue(serviceVal);
        else sheet.getRange(targetRowIndex, 28).setValue(serviceVal);

        // 8. Write Insurance Claimed (Col AC / Col 29)
        if (colInsCl > 0) sheet.getRange(targetRowIndex, colInsCl).setValue(insClaimedVal);
        else sheet.getRange(targetRowIndex, 29).setValue(insClaimedVal);

        // 9. Write Insurance Amount (Col AD / Col 30)
        if (colInsAmt > 0) sheet.getRange(targetRowIndex, colInsAmt).setValue(insAmtVal);
        else sheet.getRange(targetRowIndex, 30).setValue(insAmtVal);

        // 10. Write Bill Amount (Col AE / Col 31)
        if (colBillAmt > 0) sheet.getRange(targetRowIndex, colBillAmt).setValue(billAmtVal);
        else sheet.getRange(targetRowIndex, 31).setValue(billAmtVal);

        // 11. Write Bill Image Drive URL (Col AF / Col 32)
        if (colBillImg > 0) sheet.getRange(targetRowIndex, colBillImg).setValue(billImgVal);
        else sheet.getRange(targetRowIndex, 32).setValue(billImgVal);

        return createJsonResponse({
          status: 'success',
          action: 'delivery_updated',
          row: targetRowIndex,
          actualDate3: actualTimestamp3,
          data: processedData
        });
      }
    }

    // ─── 1. ADD ROW (Car Repair Form: Strictly Columns A to I) ───
    if (action === 'add' || action === 'insert' || !action) {
      let insertRowIndex = headerRowIndex + 1; // Row 7 for FMS

      const lastRow = Math.max(sheet.getLastRow(), headerRowIndex);
      if (lastRow > headerRowIndex) {
        const checkRange = sheet.getRange(headerRowIndex + 1, 1, lastRow - headerRowIndex, Math.min(sheet.getLastColumn(), 2)).getValues();
        let foundEmpty = false;
        for (let i = 0; i < checkRange.length; i++) {
          const c1 = String(checkRange[i][0] || '').trim();
          const c2 = String(checkRange[i][1] || '').trim();
          if (c1 === '' && c2 === '') {
            insertRowIndex = headerRowIndex + 1 + i;
            foundEmpty = true;
            break;
          }
        }
        if (!foundEmpty) {
          insertRowIndex = lastRow + 1;
        }
      } else {
        insertRowIndex = headerRowIndex + 1; // Row 7
      }

      if (isFMS) {
        // 🔒 STRICTLY WRITE ONLY COLUMNS A TO I (1 to 9). COLUMNS J:ZZ WILL NEVER BE TOUCHED!
        const fms9Values = [
          findValueByHeader(processedData, 'Timestamp') || formatCustomTimestamp(),
          findValueByHeader(processedData, 'Car Repair No.') || '',
          findValueByHeader(processedData, 'Vehicle ID') || '',
          findValueByHeader(processedData, 'Car Name') || '',
          findValueByHeader(processedData, 'Reason For Repair') || '',
          findValueByHeader(processedData, 'Which Garage Is It Going For Repair') || '',
          findValueByHeader(processedData, 'Who Is Taking The Car') || '',
          findValueByHeader(processedData, 'Insurance to be claimed') || '',
          findValueByHeader(processedData, 'Department') || ''
        ];
        sheet.getRange(insertRowIndex, 1, 1, 9).setValues([fms9Values]);
        return createJsonResponse({ status: 'success', action: 'added', row: insertRowIndex, data: processedData });
      } else {
        const rowValues = mapDataToHeaders(processedData, headers, sheet);
        sheet.getRange(insertRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
        return createJsonResponse({ status: 'success', action: 'added', row: insertRowIndex, data: processedData });
      }
    }

    // ─── 2. UPDATE ROW ───
    if (action === 'update') {
      const allRows = sheet.getDataRange().getValues();
      let headerColIndex = -1;

      for (let i = 0; i < headers.length; i++) {
        const normH = normalizeKey(headers[i]);
        const normK = normalizeKey(keyField);
        if (normH === normK || ((normK === 'user' || normK === 'email') && (normH === 'user' || normH === 'email' || normH === 'useremail' || normH === 'username'))) {
          headerColIndex = i;
          break;
        }
      }

      let targetRowIndex = -1;
      if (headerColIndex !== -1) {
        for (let r = headerRowIndex; r < allRows.length; r++) {
          if (String(allRows[r][headerColIndex]).trim().toLowerCase() === String(keyValue).trim().toLowerCase()) {
            targetRowIndex = r + 1;
            break;
          }
        }
      }

      if (targetRowIndex === -1) {
        return doPost({ ...e, postData: { contents: JSON.stringify({ ...body, action: 'add' }) } });
      }

      if (isFMS) {
        // 🔒 UPDATE STRICTLY COLUMNS A TO I (1 to 9). NEVER TOUCH J:ZZ!
        const existingRowData = allRows[targetRowIndex - 1];
        const fms9Values = [
          findValueByHeader(processedData, 'Timestamp') || existingRowData[0] || formatCustomTimestamp(),
          findValueByHeader(processedData, 'Car Repair No.') || existingRowData[1] || '',
          findValueByHeader(processedData, 'Vehicle ID') || existingRowData[2] || '',
          findValueByHeader(processedData, 'Car Name') || existingRowData[3] || '',
          findValueByHeader(processedData, 'Reason For Repair') || existingRowData[4] || '',
          findValueByHeader(processedData, 'Which Garage Is It Going For Repair') || existingRowData[5] || '',
          findValueByHeader(processedData, 'Who Is Taking The Car') || existingRowData[6] || '',
          findValueByHeader(processedData, 'Insurance to be claimed') || existingRowData[7] || '',
          findValueByHeader(processedData, 'Department') || existingRowData[8] || ''
        ];
        sheet.getRange(targetRowIndex, 1, 1, 9).setValues([fms9Values]);
        return createJsonResponse({ status: 'success', action: 'updated', row: targetRowIndex, data: processedData });
      } else {
        const existingRowData = allRows[targetRowIndex - 1];
        const updatedRowData = headers.map((header, colIdx) => {
          const val = findValueByHeader(processedData, header);
          return (val !== undefined && val !== null && val !== '') ? formatValueForSheet(val) : existingRowData[colIdx];
        });
        sheet.getRange(targetRowIndex, 1, 1, headers.length).setValues([updatedRowData]);
        return createJsonResponse({ status: 'success', action: 'updated', row: targetRowIndex, data: processedData });
      }
    }

    // ─── 3. DELETE ROW ───
    if (action === 'delete') {
      const allRows = sheet.getDataRange().getValues();
      let headerColIndex = -1;

      for (let i = 0; i < headers.length; i++) {
        const normH = normalizeKey(headers[i]);
        const normK = normalizeKey(keyField);
        if (normH === normK || ((normK === 'user' || normK === 'email') && (normH === 'user' || normH === 'email' || normH === 'useremail' || normH === 'username'))) {
          headerColIndex = i;
          break;
        }
      }

      if (headerColIndex !== -1) {
        for (let r = headerRowIndex; r < allRows.length; r++) {
          if (String(allRows[r][headerColIndex]).trim().toLowerCase() === String(keyValue).trim().toLowerCase()) {
            if (isFMS) {
              sheet.getRange(r + 1, 1, 1, 9).clearContent();
            } else {
              sheet.deleteRow(r + 1);
            }
            return createJsonResponse({ status: 'success', action: 'deleted', row: r + 1 });
          }
        }
      }
      return createJsonResponse({ status: 'error', message: 'Record not found' });
    }

    return createJsonResponse({ status: 'error', message: `Unknown action: ${action}` });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// ─── GOOGLE DRIVE UPLOADER ────────────────────────────────────────────────────
function saveBase64FileToDrive(base64String, filename, mimeType) {
  try {
    let folder;
    try {
      folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    } catch (e) {
      folder = DriveApp.getRootFolder();
    }

    let cleanBase64 = base64String;
    let detectedMime = mimeType || 'application/octet-stream';

    if (base64String.indexOf(';base64,') !== -1) {
      const parts = base64String.split(';base64,');
      detectedMime = parts[0].replace('data:', '') || detectedMime;
      cleanBase64 = parts[1];
    }

    const safeName = (filename || 'document_' + Date.now()).replace(/[^a-zA-Z0-9._-]/g, '_');
    const decodedBytes = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(decodedBytes, detectedMime, safeName);
    const file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}

    return {
      status: 'success',
      url: file.getUrl(),
      fileId: file.getId(),
      filename: safeName
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function convertAllBase64ToDriveUrls(dataObj) {
  if (!dataObj || typeof dataObj !== 'object') return dataObj;
  const result = { ...dataObj };

  for (const [key, val] of Object.entries(result)) {
    if (typeof val === 'string' && val.startsWith('data:')) {
      const fieldNameClean = key.replace(/[^a-zA-Z0-9]/g, '_');
      const upload = saveBase64FileToDrive(val, fieldNameClean + '_' + Date.now() + '.png', 'image/png');
      if (upload.status === 'success') {
        result[key] = upload.url;
      }
    } else if (val && typeof val === 'object' && val.url) {
      if (typeof val.url === 'string' && val.url.startsWith('data:')) {
        const upload = saveBase64FileToDrive(val.url, val.name || key + '_' + Date.now(), val.type);
        if (upload.status === 'success') {
          result[key] = upload.url;
        }
      } else {
        result[key] = val.url;
      }
    }
  }
  return result;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function normalizeKey(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findValueByHeader(dataObj, headerName) {
  if (!dataObj || typeof dataObj !== 'object') return undefined;
  if (dataObj[headerName] !== undefined) return dataObj[headerName];
  const target = normalizeKey(headerName);
  for (const [k, v] of Object.entries(dataObj)) {
    if (normalizeKey(k) === target) return v;
  }
  return undefined;
}

function formatValueForSheet(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'object') {
    if (val.url) return val.url;
    return JSON.stringify(val);
  }
  return val;
}

function mapDataToHeaders(dataObj, headers, sheet) {
  if (!headers || headers.length === 0) {
    const keys = Object.keys(dataObj);
    sheet.appendRow(keys);
    headers = keys;
  }
  return headers.map(header => {
    const val = findValueByHeader(dataObj, header);
    return formatValueForSheet(val);
  });
}

function getSheetDataSmart(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const { headerRowIndex, headers } = findHeaderRowInfo(sheet);
  if (data.length <= headerRowIndex) return [];

  const rows = data.slice(headerRowIndex);
  return rows.map((row, rowIdx) => {
    const obj = { _row: headerRowIndex + rowIdx + 1 };
    let hasValidData = false;

    headers.forEach((header, colIdx) => {
      let val = row[colIdx];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone() || 'Asia/Kolkata', 'M/d/yyyy HH:mm:ss');
      }
      if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
        try { val = JSON.parse(val); } catch (e) {}
      }
      if (val !== '' && val !== null && val !== undefined) {
        const cleanVal = String(val).trim().toLowerCase();
        if (cleanVal !== '02-' && cleanVal !== 'who' && cleanVal !== 'how' && cleanVal !== 'when' && cleanVal !== 'timestamp' && cleanVal !== 'car repair no.') {
          hasValidData = true;
        }
      }
      if (header) {
        obj[header] = val;
      }
    });

    return hasValidData ? obj : null;
  }).filter(Boolean);
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
