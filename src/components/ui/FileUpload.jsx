// components/ui/FileUpload.jsx
import { Upload, File, X, Eye, CheckCircle2, HardDrive, Loader2, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { uploadFileToDrive } from '../../api/googleSheetsClient';
import { compressImage } from '../../utils/imageCompressor';

const FileUpload = ({ value, onChange, accept = '*', label = 'Upload File', id }) => {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;

    setUploading(true);

    try {
      // 1. Lightning-fast auto-compress image in milliseconds
      const { dataUrl, size, type } = await compressImage(file);

      const initialFileObj = {
        name: file.name,
        url: dataUrl,
        type: type || file.type,
        size: size || file.size,
      };

      onChange(initialFileObj);

      // 2. Upload lightweight file to Google Drive folder
      const driveUrl = await uploadFileToDrive(dataUrl, file.name, type || file.type);
      if (driveUrl) {
        onChange({
          name: file.name,
          url: driveUrl,
          type: type || file.type,
          size: size || file.size,
          isDrive: true,
        });
      }
    } catch (err) {
      console.warn('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isDriveLink = value?.url && value.url.includes('drive.google.com');

  return (
    <div>
      {value?.url ? (
        <div className="file-upload-area has-file" style={{
          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
          padding: '12px 16px', background: '#ecfdf5', border: '1.5px solid #a7f3d0',
          borderRadius: 12, transition: 'all 0.2s'
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: uploading ? '#10b981' : '#059669',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#ffffff', flexShrink: 0
          }}>
            {uploading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <File size={18} />
            )}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: '#0f172a',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {value.name || 'Uploaded File'}
            </div>
            <div style={{ fontSize: 11.5, color: '#059669', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, fontWeight: 600 }}>
              {uploading ? (
                <span style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Loader2 size={12} className="animate-spin" /> Auto-optimizing & uploading to Drive...
                </span>
              ) : isDriveLink ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#059669' }}>
                  <HardDrive size={12} /> Saved in Google Drive (Fast)
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={12} /> Ready ({formatSize(value.size)})
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {value.url && (
              <a
                href={value.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-xs"
                title="View / Open File"
                style={{ color: '#059669', background: '#ffffff', border: '1px solid #d1fae5', borderRadius: 8 }}
              >
                <Eye size={14} />
              </a>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => onChange(null)}
              title="Remove File"
              style={{ color: '#ef4444', background: '#ffffff', border: '1px solid #fee2e2', borderRadius: 8 }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`file-upload-area ${dragging ? 'dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          style={{ cursor: 'pointer', transition: 'all 0.2s' }}
        >
          <Upload size={22} style={{ color: '#059669', marginBottom: 8 }} />
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Fast upload (Auto-compressed & saved in Drive)</div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        id={id}
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  );
};

export default FileUpload;
