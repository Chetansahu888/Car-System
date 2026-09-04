# 📊 Google Sheets Connection Guide — Car Management System

Follow these 4 simple steps to connect your live Google Spreadsheet with the Car Management System.

---

## 🚀 Step 1: Open Google Sheet & Apps Script
1. Open [Google Sheets](https://sheets.new) in your browser (create a new blank spreadsheet).
2. Name it e.g. **"Car Fleet ERP Database"**.
3. In the top menu, click **Extensions** → **Apps Script**.

---

## 📋 Step 2: Paste the Backend Script
1. In the Apps Script editor, open `Code.gs` and delete any placeholder code inside.
2. Copy the complete code from file [`google-apps-script/Code.gs`](file:///c:/Antigravity%20apps/Car%20System/google-apps-script/Code.gs) (or use the **"Copy Apps Script Code"** button in the app's top bar **Google Sheet** dialog).
3. Paste the code into `Code.gs` and click the **💾 Save** icon (Ctrl+S).

---

## 🌐 Step 3: Deploy as Web App
1. At the top right of Apps Script, click the blue **Deploy** button → **New deployment**.
2. Click the ⚙️ icon next to "Select type" and choose **Web app**.
3. Fill in the deployment details:
   - **Description**: `Car Fleet API`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: `Anyone` *(Crucial: Select "Anyone" so the React app can communicate with the Sheet)*.
4. Click **Deploy**.
5. When prompted, click **Authorize access** → select your Google account → click **Advanced** → click **Go to Untitled project (unsafe)** → click **Allow**.
6. Copy the generated **Web app URL** (looks like `https://script.google.com/macros/s/AKfycb.../exec`).

---

## 🔗 Step 4: Connect in the App
You can connect in two easy ways:

### Option A: Direct In-App (No Terminal Restart Needed)
1. Open the app at **http://localhost:5174/**.
2. Click the **"📊 Google Sheet"** button in the top header.
3. Paste your Web App URL into the box.
4. Click **Save & Test**. You will see:
   > 🟢 *Status: Connected to Google Sheet*
5. Click **Sync Sheet** to synchronize all data!

### Option B: Via `.env` File
1. Open [`.env`](file:///c:/Antigravity%20apps/Car%20System/.env) in the project folder.
2. Replace `VITE_SCRIPT_URL` with your URL:
```env
VITE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
VITE_PAYMENT_FORM_URL=https://docs.google.com/forms/d/YOUR_FORM_ID/viewform
```

---

## 📑 Automatic Sheet Tables Created
The script will automatically create and style all 8 sheets on the first request:
1. `Purchase_Car`
2. `Insurance`
3. `Car_Repair`
4. `Accident_Claims`
5. `Vendor_Offers`
6. `Delivery_Planning`
7. `Delivery_Car`
8. `Payment`
