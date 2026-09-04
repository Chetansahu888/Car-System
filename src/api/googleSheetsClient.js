// api/googleSheetsClient.js

export const getScriptUrl = () => {
  const envUrl = import.meta.env.VITE_SCRIPT_URL;
  const customUrl = localStorage.getItem('cms_script_url');
  
  if (customUrl && customUrl.trim().startsWith('http')) {
    return customUrl.trim();
  }
  if (envUrl && envUrl.trim().startsWith('http') && !envUrl.includes('YOUR_GOOGLE_APPS_SCRIPT_URL')) {
    return envUrl.trim();
  }
  return null;
};

export const setScriptUrl = (url) => {
  if (!url) {
    localStorage.removeItem('cms_script_url');
  } else {
    localStorage.setItem('cms_script_url', url.trim());
  }
};

export const testConnection = async (urlToTest) => {
  const url = urlToTest || getScriptUrl();
  if (!url) {
    return { success: false, message: 'No Google Apps Script URL provided.' };
  }
  try {
    const endpoint = `${url}?action=ping&_t=${Date.now()}`;
    const res = await fetch(endpoint, { method: 'GET', mode: 'cors' });
    const json = await res.json();
    if (json.status === 'ok' || json.status === 'success') {
      return { success: true, message: 'Google Sheets & Drive connected successfully!', data: json };
    }
    return { success: false, message: json.message || 'Received unexpected response from script.' };
  } catch (err) {
    return {
      success: false,
      message: `Failed to connect: ${err.message}`
    };
  }
};

export const uploadFileToDrive = async (fileData, filename, mimeType) => {
  const url = getScriptUrl();
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        action: 'upload_file',
        fileData: fileData,
        filename: filename,
        mimeType: mimeType
      })
    });
    const json = await res.json();
    if (json.status === 'success' && json.url) {
      return json.url;
    }
    return null;
  } catch (err) {
    console.warn('Direct Google Drive upload failed, file will sync with record:', err);
    return null;
  }
};

export const fetchFromSheet = async (action = 'getAll', sheetName = null) => {
  const url = getScriptUrl();
  if (!url) return null;
  try {
    const query = sheetName ? `sheet=${encodeURIComponent(sheetName)}` : `action=${encodeURIComponent(action)}`;
    const res = await fetch(`${url}?${query}&_t=${Date.now()}`, { mode: 'cors' });
    const json = await res.json();
    if (json.status === 'success') {
      return json.data;
    }
    return null;
  } catch (err) {
    console.warn('Google Sheets fetch failed, falling back to local store:', err);
    return null;
  }
};

export const sendToSheet = async (payload) => {
  const url = getScriptUrl();
  if (!url) return null;
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) {
    console.warn('Google Sheets POST failed:', err);
    return false;
  }
};
