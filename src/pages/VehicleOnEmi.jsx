// pages/VehicleOnEmi.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, CreditCard, AlertTriangle, Eye, Edit2, CheckCircle,
  Search, RefreshCw, Car, ChevronRight, Calendar, Bell, Plus,
  CheckCircle2, TrendingUp, Filter, X, Shield, ArrowUpRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCars, updateCar, onStoreUpdate, checkHasEmi, syncAllFromSheets } from '../store/dataStore';
import { formatDate, today, calcEmiDetails } from '../utils/dateUtils';
import { useAuth, PAGE_KEYS } from '../context/AuthContext';
import { ITEMS_PER_PAGE } from '../constants';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ReadOnlyNotice from '../components/shared/ReadOnlyNotice';
import SpeedingCarLoader from '../components/ui/SpeedingCarLoader';

const StatCard = ({ icon: Icon, label, value, sub, color, bgColor, alert, onClick }) => (
  <div
    className="stat-card"
    onClick={onClick}
    style={{
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.2s, box-shadow 0.2s'
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
      <div className="icon-wrap" style={{ background: bgColor, color }}>
        <Icon size={22} strokeWidth={2.2} />
      </div>
      {alert && (
        <span style={{
          fontSize: 10, fontWeight: 800, color: '#dc2626',
          background: '#fee2e2', padding: '3px 8px', borderRadius: 20,
          border: '1px solid #fecaca'
        }}>
          ALERT
        </span>
      )}
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, fontWeight: 600 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color, marginTop: 6, fontWeight: 700 }}>{sub}</div>}
  </div>
);

const FormField = ({ label, required: req, children }) => (
  <div className="form-group">
    <label className="form-label">{label}{req && <span className="required">*</span>}</label>
    {children}
  </div>
);

// ─── EMI DETAILS MODAL ─────────────────────────────────────────────────────────
const EmiDetailsModal = ({ car, onClose, onRecordPayment, onEditEmi, canEdit }) => {
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {emi.isCompleted ? (
            <Badge label="✓ EMI Fully Repaid" variant="success" />
          ) : emi.isOverdue ? (
            <Badge label={`⚠️ Overdue by ${Math.abs(emi.daysUntilNextEmi)} Days`} variant="danger" />
          ) : emi.isDueSoon ? (
            <Badge label={`🔔 Payment Due in ${emi.daysUntilNextEmi} Days!`} variant="warning" />
          ) : emi.nextEmiDate ? (
            <Badge label={`Upcoming in ${emi.daysUntilNextEmi} Days`} variant="info" />
          ) : null}

          {canEdit && !emi.isCompleted && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onRecordPayment(car)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              <CheckCircle2 size={15} /> Record Paid
            </button>
          )}
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
      <div className="modal-footer" style={{ padding: '16px 0 0', margin: 0, background: 'transparent', display: 'flex', justifyContent: 'space-between' }}>
        {canEdit && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => { onClose(); onEditEmi(car); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Edit2 size={14} /> Edit EMI Details
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

// ─── EDIT EMI MODAL ───────────────────────────────────────────────────────────
const EditEmiModal = ({ car, onClose, onSaved }) => {
  const [formData, setFormData] = useState({
    hypothecationBank: car?.hypothecationBank || '',
    loanAmount: car?.loanAmount || '',
    emiAmount: car?.emiAmount || '',
    emiStartDate: car?.emiStartDate || '',
    lastEmiDate: car?.lastEmiDate || '',
    dateOfReleaseHypothecation: car?.dateOfReleaseHypothecation || '',
    totalEmis: car?.totalEmis || '',
    paidEmis: car?.paidEmis !== undefined ? car.paidEmis : '',
    paidEmiAmount: car?.paidEmiAmount !== undefined ? car.paidEmiAmount : (calcEmiDetails(car)?.paidAmount || ''),
    hasEmi: checkHasEmi(car),
  });
  const [saving, setSaving] = useState(false);

  const set = (field, val) => {
    setFormData(f => {
      const updated = { ...f, [field]: val };
      if (field === 'paidEmis') {
        const count = Number(val);
        const emi = Number(f.emiAmount);
        if (!isNaN(count) && count >= 0 && !isNaN(emi) && emi > 0) {
          updated.paidEmiAmount = String(count * emi);
        }
      } else if (field === 'paidEmiAmount') {
        const amt = Number(val);
        const emi = Number(f.emiAmount);
        if (!isNaN(amt) && amt >= 0 && !isNaN(emi) && emi > 0) {
          updated.paidEmis = String(Math.round(amt / emi));
        }
      } else if (field === 'emiAmount') {
        const emi = Number(val);
        const count = Number(f.paidEmis);
        if (!isNaN(emi) && emi > 0 && !isNaN(count) && count > 0) {
          updated.paidEmiAmount = String(count * emi);
        }
      }
      return updated;
    });
  };

  const previewEmi = calcEmiDetails({ ...car, ...formData });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = {
        ...formData,
        hasEmi: true,
        emiStatus: 'Yes',
        paidEmiAmount: formData.paidEmiAmount || (previewEmi ? String(previewEmi.paidAmount) : ''),
        remainingLoanAmount: previewEmi ? String(previewEmi.remainingAmount) : '',
        updatedAt: new Date().toISOString()
      };
      await updateCar(car.vehicleId, updated);
      toast.success(`EMI details updated for ${car.vehicleId}`);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update EMI details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{
        background: '#f8fafc',
        borderRadius: 12,
        padding: '12px 16px',
        marginBottom: 20,
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>{car.carName}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{car.vehicleId} • {car.registrationNo}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Next EMI Date</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>
            {previewEmi.nextEmiDate ? formatDate(previewEmi.nextEmiDate) : '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FormField label="Hypothecation Bank">
          <input
            className="form-input"
            value={formData.hypothecationBank}
            onChange={e => set('hypothecationBank', e.target.value)}
            placeholder="e.g. HDFC Bank, SBI"
          />
        </FormField>
        <FormField label="Total Loan Amount (₹)">
          <input
            type="number"
            className="form-input"
            value={formData.loanAmount}
            onChange={e => set('loanAmount', e.target.value)}
            placeholder="0"
          />
        </FormField>
        <FormField label="Monthly EMI Amount (₹)">
          <input
            type="number"
            className="form-input"
            value={formData.emiAmount}
            onChange={e => set('emiAmount', e.target.value)}
            placeholder="0"
          />
        </FormField>
        <FormField label="EMI Start Date">
          <input
            type="date"
            className="form-input"
            value={formData.emiStartDate}
            onChange={e => set('emiStartDate', e.target.value)}
          />
        </FormField>
        <FormField label="Last EMI Date">
          <input
            type="date"
            className="form-input"
            value={formData.lastEmiDate}
            onChange={e => set('lastEmiDate', e.target.value)}
          />
        </FormField>
        <FormField label="Release of Hypothecation Date">
          <input
            type="date"
            className="form-input"
            value={formData.dateOfReleaseHypothecation}
            onChange={e => set('dateOfReleaseHypothecation', e.target.value)}
          />
        </FormField>
        <FormField label="Total Tenure (Months / Total EMIs)">
          <input
            type="number"
            className="form-input"
            value={formData.totalEmis}
            onChange={e => set('totalEmis', e.target.value)}
            placeholder="e.g. 36"
          />
        </FormField>
        <FormField label="EMIs Paid So Far (Count)">
          <input
            type="number"
            className="form-input"
            value={formData.paidEmis}
            onChange={e => set('paidEmis', e.target.value)}
            placeholder="e.g. 12"
          />
        </FormField>
        <FormField label="Amount Paid So Far (₹) (अब तक पे किया)">
          <input
            type="number"
            className="form-input"
            value={formData.paidEmiAmount !== undefined && formData.paidEmiAmount !== '' ? formData.paidEmiAmount : (previewEmi.paidAmount > 0 ? previewEmi.paidAmount : '')}
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
              value={previewEmi.remainingAmount > 0 ? `₹${previewEmi.remainingAmount.toLocaleString('en-IN')}` : (previewEmi.isCompleted ? '₹0 (Fully Paid)' : '—')}
              style={{
                background: '#f8fafc',
                fontWeight: 800,
                color: previewEmi.remainingAmount > 0 ? '#b45309' : '#059669',
                cursor: 'default',
                paddingRight: 84
              }}
            />
            {previewEmi.remainingEmis > 0 && (
              <span style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 11,
                fontWeight: 700,
                color: '#64748b'
              }}>
                {previewEmi.remainingEmis} EMIs left
              </span>
            )}
          </div>
        </FormField>
      </div>

      <div className="modal-footer" style={{ padding: '20px 0 0' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save EMI Details'}
        </button>
      </div>
    </form>
  );
};

// ─── RECORD PAYMENT MODAL ─────────────────────────────────────────────────────
const RecordPaymentModal = ({ car, onClose, onSaved }) => {
  const emi = calcEmiDetails(car);
  const [submitting, setSubmitting] = useState(false);
  const currentPaid = Number(car.paidEmis) || 0;
  const newPaid = currentPaid + 1;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await updateCar(car.vehicleId, {
        paidEmis: newPaid,
        lastEmiPaidDate: today(),
        updatedAt: new Date().toISOString()
      });
      toast.success(`1 EMI payment recorded for ${car.vehicleId}! (Now ${newPaid} paid)`);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to record EMI payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          width: 50, height: 50, borderRadius: '50%',
          background: '#ecfdf5', color: '#059669',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px'
        }}>
          <CheckCircle2 size={26} />
        </div>
        <h4 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
          Record Monthly EMI Payment
        </h4>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
          Confirm payment of monthly installment for <strong>{car.carName}</strong> ({car.vehicleId}).
        </p>
      </div>

      <div style={{
        background: '#f8fafc',
        border: '1.5px solid #e2e8f0',
        borderRadius: 14,
        padding: '16px',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
          <span style={{ color: '#64748b' }}>Monthly EMI Amount:</span>
          <span style={{ fontWeight: 800, color: '#059669', fontSize: 15 }}>
            {emi.emiAmount > 0 ? `₹${emi.emiAmount.toLocaleString('en-IN')}` : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
          <span style={{ color: '#64748b' }}>Hypothecation Bank:</span>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>{car.hypothecationBank || '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
          <span style={{ color: '#64748b' }}>Current Paid EMIs:</span>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>{currentPaid} of {emi.totalEmis || '?'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #e2e8f0', fontSize: 13 }}>
          <span style={{ color: '#0f172a', fontWeight: 700 }}>After This Payment:</span>
          <span style={{ fontWeight: 800, color: '#059669' }}>{newPaid} of {emi.totalEmis || '?'} paid</span>
        </div>
      </div>

      <div className="modal-footer" style={{ padding: 0, margin: 0, background: 'transparent' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={submitting}>
          {submitting ? 'Recording...' : '✓ Confirm & Mark Paid'}
        </button>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const VehicleOnEmi = () => {
  const navigate = useNavigate();
  const { canEditPage } = useAuth();
  const canEdit = canEditPage(PAGE_KEYS.VEHICLE_EMI);

  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('active'); // 'active' | 'due_soon' | 'all' | 'completed' | 'without_emi'
  const [bankFilter, setBankFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Modals
  const [detailModalCar, setDetailModalCar] = useState(null);
  const [editModalCar, setEditModalCar] = useState(null);
  const [payModalCar, setPayModalCar] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const carList = await getCars();
    setCars(carList);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const unsub = onStoreUpdate(loadData);
    return unsub;
  }, [loadData]);

  // Calculations across fleet
  const fleetStats = useMemo(() => {
    let activeEmiCount = 0;
    let dueSoonCount = 0;
    let totalMonthlyEmi = 0;
    let totalLoanPrincipal = 0;
    let totalOutstanding = 0;

    cars.forEach(car => {
      if (checkHasEmi(car)) {
        const emi = calcEmiDetails(car);
        if (!emi.isCompleted) {
          activeEmiCount++;
          totalMonthlyEmi += (emi.emiAmount || 0);
          totalOutstanding += (emi.remainingAmount || 0);
        }
        totalLoanPrincipal += (emi.loanAmount || 0);
        if (emi.isDueSoon || emi.isOverdue) {
          dueSoonCount++;
        }
      }
    });

    return {
      activeEmiCount,
      dueSoonCount,
      totalMonthlyEmi,
      totalLoanPrincipal,
      totalOutstanding,
    };
  }, [cars]);

  // Unique bank list
  const uniqueBanks = useMemo(() => {
    const banks = new Set();
    cars.forEach(c => {
      if (c.hypothecationBank && c.hypothecationBank.trim() && !['—', '-'].includes(c.hypothecationBank.trim())) {
        banks.add(c.hypothecationBank.trim());
      }
    });
    return Array.from(banks);
  }, [cars]);

  // Filtered cars
  const filteredCars = useMemo(() => {
    return cars.filter(car => {
      const hasEmi = checkHasEmi(car);
      const emi = hasEmi ? calcEmiDetails(car) : null;

      // Tab filtering
      if (tab === 'active') {
        if (!hasEmi || emi?.isCompleted) return false;
      } else if (tab === 'due_soon') {
        if (!hasEmi || emi?.isCompleted || (!emi?.isDueSoon && !emi?.isOverdue)) return false;
      } else if (tab === 'completed') {
        if (!hasEmi || !emi?.isCompleted) return false;
      } else if (tab === 'all') {
        if (!hasEmi) return false;
      } else if (tab === 'without_emi') {
        if (hasEmi) return false;
      }

      // Bank filter
      if (bankFilter !== 'all' && car.hypothecationBank !== bankFilter) {
        return false;
      }

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          car.vehicleId?.toLowerCase().includes(q) ||
          car.carName?.toLowerCase().includes(q) ||
          car.registrationNo?.toLowerCase().includes(q) ||
          car.hypothecationBank?.toLowerCase().includes(q) ||
          car.modelNo?.toLowerCase().includes(q) ||
          car.firmName?.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [cars, tab, bankFilter, search]);

  const totalPages = Math.ceil(filteredCars.length / ITEMS_PER_PAGE);
  const pagedCars = filteredCars.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div>
      {!canEdit && <ReadOnlyNotice moduleName="Vehicle on EMI Records" />}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #059669, #047857)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
            color: '#ffffff'
          }}>
            <Clock size={24} strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="page-title">Vehicle on EMI</h1>
            <p className="page-subtitle">Track active vehicle loans, calculate next EMI pay dates, balance remaining & reminders</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-outline"
            onClick={() => {
              loadData();
              syncAllFromSheets(true);
              toast.success('Refreshing EMI data from Google Sheets...');
            }}
            title="Sync with Google Sheets"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {canEdit && (
            <button
              className="btn btn-primary"
              onClick={() => navigate('/purchase-car')}
              title="Add or Manage vehicles"
            >
              <Plus size={15} /> + Add / Link Vehicle
            </button>
          )}
        </div>
      </div>

      {/* Top Stat Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard
          icon={Clock}
          label="Active EMIs Running"
          value={fleetStats.activeEmiCount}
          color="#059669"
          bgColor="#ecfdf5"
          sub={`${fleetStats.activeEmiCount} vehicles with active loans`}
          onClick={() => setTab('active')}
        />
        <StatCard
          icon={CreditCard}
          label="Monthly Commitment"
          value={`₹${fleetStats.totalMonthlyEmi.toLocaleString('en-IN')}`}
          color="#2563eb"
          bgColor="#eff6ff"
          sub="Total monthly installment"
        />
        <StatCard
          icon={Bell}
          label="Due in ≤ 7 Days"
          value={fleetStats.dueSoonCount}
          color="#d97706"
          bgColor="#fef3c7"
          alert={fleetStats.dueSoonCount > 0}
          sub={fleetStats.dueSoonCount > 0 ? `${fleetStats.dueSoonCount} payments due soon!` : 'All payments on track'}
          onClick={() => setTab('due_soon')}
        />
        <StatCard
          icon={TrendingUp}
          label="Total Balance Left"
          value={`₹${fleetStats.totalOutstanding.toLocaleString('en-IN')}`}
          color="#7c3aed"
          bgColor="#f5f3ff"
          sub="Outstanding loan balance"
        />
      </div>

      {/* Main Section Card */}
      <div className="section-card" style={{ padding: 0 }}>
        {/* Filter Navigation Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 20px',
          background: '#f8fafc',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          overflowX: 'auto'
        }}>
          {[
            { key: 'active', label: 'Active EMIs', count: fleetStats.activeEmiCount },
            { key: 'due_soon', label: 'Due Soon (≤ 7 Days)', count: fleetStats.dueSoonCount, isAlert: fleetStats.dueSoonCount > 0 },
            { key: 'all', label: 'All EMI Vehicles', count: cars.filter(c => checkHasEmi(c)).length },
            { key: 'completed', label: 'Completed Loans', count: cars.filter(c => checkHasEmi(c) && calcEmiDetails(c).isCompleted).length },
            { key: 'without_emi', label: 'Fleet Without EMI', count: cars.filter(c => !checkHasEmi(c)).length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              style={{
                padding: '14px 18px',
                border: 'none',
                background: 'transparent',
                borderBottom: tab === t.key ? '2.5px solid #059669' : '2.5px solid transparent',
                color: tab === t.key ? '#059669' : '#64748b',
                fontWeight: tab === t.key ? 800 : 600,
                fontSize: 13.5,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {t.label}
              <span style={{
                background: tab === t.key ? '#ecfdf5' : (t.isAlert ? '#fee2e2' : '#e2e8f0'),
                color: tab === t.key ? '#059669' : (t.isAlert ? '#dc2626' : '#475569'),
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Toolbar: Search & Bank Filter */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search Vehicle ID, car name, reg no, bank..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ paddingLeft: 34, height: 38 }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {uniqueBanks.length > 0 && (
              <select
                className="form-select"
                value={bankFilter}
                onChange={e => { setBankFilter(e.target.value); setPage(1); }}
                style={{ width: 'auto', minWidth: 160, height: 38 }}
              >
                <option value="all">All Banks ({uniqueBanks.length})</option>
                {uniqueBanks.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>
            Showing <strong>{filteredCars.length}</strong> vehicle{filteredCars.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
              <SpeedingCarLoader size="medium" />
            </div>
          ) : pagedCars.length === 0 ? (
            <div style={{ padding: '40px 20px' }}>
              <EmptyState
                icon={Clock}
                title="No vehicles found"
                message={search ? 'No vehicles match your search query.' : tab === 'due_soon' ? 'Great! No vehicle EMI payments due in the next 7 days.' : 'No vehicles in this filter view.'}
                action={canEdit && tab === 'without_emi' ? (
                  <button className="btn btn-primary" onClick={() => navigate('/purchase-car')}>
                    Go to Purchase Car
                  </button>
                ) : null}
              />
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehicle ID</th>
                  <th>Car Name</th>
                  <th>Reg. No.</th>
                  <th>Hypothecation Bank</th>
                  <th>Loan Amount (₹)</th>
                  <th>Monthly EMI (₹)</th>
                  <th>Paid So Far</th>
                  <th>Balance Left</th>
                  <th>Tenure Progress</th>
                  <th style={{ minWidth: 160 }}>Next EMI Date</th>
                  <th style={{ textAlign: 'center', minWidth: 130 }}>Action Button</th>
                </tr>
              </thead>
              <tbody>
                {pagedCars.map(car => {
                  const hasEmi = checkHasEmi(car);
                  const emi = hasEmi ? calcEmiDetails(car) : null;
                  const pct = emi && emi.loanAmount > 0 ? Math.min(100, Math.round((emi.paidAmount / emi.loanAmount) * 100)) : 0;

                  return (
                    <tr key={car.vehicleId}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>
                          {car.vehicleId}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{car.carName}</div>
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>
                          {car.modelNo ? `${car.modelNo} • ` : ''}{car.firmName || '—'}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{car.registrationNo}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>
                          {car.hypothecationBank || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>
                          {emi?.loanAmount > 0 ? `₹${emi.loanAmount.toLocaleString('en-IN')}` : '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, color: '#059669', fontSize: 14 }}>
                          {emi?.emiAmount > 0 ? `₹${emi.emiAmount.toLocaleString('en-IN')}` : (car.emiAmount || '—')}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {emi?.paidAmount > 0 ? `₹${emi.paidAmount.toLocaleString('en-IN')}` : '₹0'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {emi?.paidEmis} EMIs paid
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: emi?.remainingAmount > 0 ? '#b45309' : '#059669' }}>
                          {emi?.remainingAmount > 0 ? `₹${emi.remainingAmount.toLocaleString('en-IN')}` : (emi?.isCompleted ? '₹0' : '—')}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {emi?.remainingEmis} EMIs left
                        </div>
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                          <span>{pct}%</span>
                          <span style={{ color: '#64748b' }}>{emi?.paidEmis}/{emi?.totalEmis || '?'}</span>
                        </div>
                        <div style={{ height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: pct === 100 ? '#059669' : 'linear-gradient(90deg, #10b981, #059669)',
                            borderRadius: 4
                          }} />
                        </div>
                      </td>
                      <td>
                        {hasEmi ? (
                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13.5 }}>
                              {emi.nextEmiDate ? formatDate(emi.nextEmiDate) : (car.lastEmiDate ? formatDate(car.lastEmiDate) : '—')}
                            </div>
                            <div style={{ marginTop: 3 }}>
                              {emi.isCompleted ? (
                                <Badge label="✓ Completed" variant="success" />
                              ) : emi.isOverdue ? (
                                <Badge label={`⚠️ Overdue by ${Math.abs(emi.daysUntilNextEmi)}d`} variant="danger" />
                              ) : emi.isDueSoon ? (
                                <Badge label={`🔔 Due in ${emi.daysUntilNextEmi}d`} variant="warning" />
                              ) : emi.nextEmiDate ? (
                                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                  In {emi.daysUntilNextEmi} days
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <Badge label="No EMI" variant="default" />
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          {hasEmi ? (
                            <>
                              {/* Eye Button: View EMI Details */}
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                title="View Complete EMI Breakdown"
                                onClick={() => setDetailModalCar(car)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 30,
                                  height: 30,
                                  borderRadius: 8,
                                  background: '#ecfdf5',
                                  color: '#059669',
                                  border: '1.5px solid #a7f3d0'
                                }}
                              >
                                <Eye size={15} strokeWidth={2.4} />
                              </button>

                              {/* Pay / Record EMI Button */}
                              {canEdit && !emi?.isCompleted && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-xs"
                                  title="Mark this month EMI paid"
                                  onClick={() => setPayModalCar(car)}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                >
                                  <CheckCircle2 size={13} /> Pay
                                </button>
                              )}

                              {/* Edit EMI Button */}
                              {canEdit && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  title="Edit EMI Details"
                                  onClick={() => setEditModalCar(car)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 30,
                                    height: 30,
                                    borderRadius: 8,
                                    color: '#475569'
                                  }}
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                            </>
                          ) : (
                            canEdit && (
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                onClick={() => setEditModalCar(car)}
                                style={{ fontSize: 11, fontWeight: 700 }}
                              >
                                + Add EMI
                              </button>
                            )
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9' }}>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* ─── MODALS ─── */}
      {/* 1. Detail Modal */}
      {detailModalCar && (
        <Modal
          isOpen={true}
          title={`EMI Details — ${detailModalCar.carName}`}
          onClose={() => setDetailModalCar(null)}
          maxWidth="720px"
        >
          <EmiDetailsModal
            car={detailModalCar}
            onClose={() => setDetailModalCar(null)}
            onRecordPayment={(car) => {
              setDetailModalCar(null);
              setPayModalCar(car);
            }}
            onEditEmi={(car) => {
              setDetailModalCar(null);
              setEditModalCar(car);
            }}
            canEdit={canEdit}
          />
        </Modal>
      )}

      {/* 2. Edit Modal */}
      {editModalCar && (
        <Modal
          isOpen={true}
          title={`Edit EMI Details — ${editModalCar.carName} (${editModalCar.vehicleId})`}
          onClose={() => setEditModalCar(null)}
          maxWidth="640px"
        >
          <EditEmiModal
            car={editModalCar}
            onClose={() => setEditModalCar(null)}
            onSaved={loadData}
          />
        </Modal>
      )}

      {/* 3. Record Payment Modal */}
      {payModalCar && (
        <Modal
          isOpen={true}
          title="Record Monthly EMI Payment"
          onClose={() => setPayModalCar(null)}
          maxWidth="460px"
        >
          <RecordPaymentModal
            car={payModalCar}
            onClose={() => setPayModalCar(null)}
            onSaved={loadData}
          />
        </Modal>
      )}
    </div>
  );
};

export default VehicleOnEmi;
