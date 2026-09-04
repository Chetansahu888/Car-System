// utils/fileUtils.js

export const openDocument = (docUrl, filename = 'document') => {
  if (!docUrl) return;

  // 1. Direct Web / Google Drive link
  if (typeof docUrl === 'string' && docUrl.startsWith('http')) {
    window.open(docUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // 2. Base64 Data URL (Convert to Object URL so browser won't block it)
  if (typeof docUrl === 'string' && docUrl.startsWith('data:')) {
    try {
      const arr = docUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const newWin = window.open(blobUrl, '_blank');
      if (!newWin) {
        // Fallback: download if popups are blocked
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    } catch (e) {
      console.error('Error opening base64 document:', e);
    }
  }

  // Fallback
  window.open(docUrl, '_blank');
};
