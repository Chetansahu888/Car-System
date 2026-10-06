// pages/CarReport.jsx
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Car, Shield, Clock, Wrench, AlertTriangle, Search, Printer,
  ChevronDown, CheckCircle, XCircle, AlertCircle, FileText,
  Calendar, CreditCard, Building, User, Phone, MapPin, Fuel,
  Hash, ShieldCheck, RefreshCw, Eye, Tag, Check, X,
  ArrowRight, ShieldAlert, FileSpreadsheet, ChevronRight,
  DollarSign, Activity, FileCheck, Layers, FileDown, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getCars, getInsurance, getRepairs, getClaims,
  getVendorOffers, getPayments, getChallans, getFastags,
  getInsuranceRenewals, getDeliveries, checkHasEmi, onStoreUpdate, syncAllFromSheets
} from '../store/dataStore';
import {
  formatDate, daysUntil, calcInsuranceRenewal, calcEarliestCoverRenewal,
  calcEmiDetails, today
} from '../utils/dateUtils';
import { openDocument } from '../utils/fileUtils';
import { useAuth } from '../context/AuthContext';
import SpeedingCarLoader from '../components/ui/SpeedingCarLoader';
import EmptyState from '../components/ui/EmptyState';

// Helper: Format currency in standard Indian format
const formatINR = (val) => {
  if (val === undefined || val === null || val === '') return '—';
  const num = Number(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return String(val);
  return '₹' + num.toLocaleString('en-IN');
};

// Helper: Get direct displayable image URL (converts Google Drive links to direct thumbnails)
const getInvoiceImageSrc = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.includes('drive.google.com')) {
    const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
    }
  }
  return trimmed;
};

export default function CarReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cars, setCars] = useState([]);
  const [insuranceList, setInsuranceList] = useState([]);
  const [repairsList, setRepairsList] = useState([]);
  const [claimsList, setClaimsList] = useState([]);
  const [offersList, setOffersList] = useState([]);
  const [paymentsList, setPaymentsList] = useState([]);
  const [deliveriesList, setDeliveriesList] = useState([]);
  const [challansList, setChallansList] = useState([]);
  const [fastagsList, setFastagsList] = useState([]);
  const [renewalsList, setRenewalsList] = useState([]);

  // Search & Selection state
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'purchase' | 'insurance' | 'emi' | 'repairs' | 'accidents'
  const [previewInvoiceModal, setPreviewInvoiceModal] = useState(null);

  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Load all data
  const loadAllData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const [
        cData, iData, rData, clData, oData, pData, delData, chData, ftData, renData
      ] = await Promise.all([
        getCars(),
        getInsurance(),
        getRepairs(),
        getClaims(),
        getVendorOffers(),
        getPayments(),
        getDeliveries(),
        getChallans(),
        getFastags(),
        getInsuranceRenewals(),
      ]);

      setCars(cData || []);
      setInsuranceList(iData || []);
      setRepairsList(rData || []);
      setClaimsList(clData || []);
      setOffersList(oData || []);
      setPaymentsList(pData || []);
      setDeliveriesList(delData || []);
      setChallansList(chData || []);
      setFastagsList(ftData || []);
      setRenewalsList(renData || []);
    } catch (err) {
      console.error('Failed to load report data:', err);
      toast.error('Failed to load vehicle report data');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData(true);
    const cleanup = onStoreUpdate(() => loadAllData(false));
    return cleanup;
  }, [loadAllData]);

  // Handle URL param or initial selection
  useEffect(() => {
    if (cars.length === 0) return;

    const urlVehicleId = searchParams.get('car') || searchParams.get('id');
    const urlReg = searchParams.get('reg');

    if (urlVehicleId) {
      const found = cars.find(c => c.vehicleId?.toLowerCase() === urlVehicleId.toLowerCase());
      if (found) {
        setSelectedVehicleId(found.vehicleId);
        return;
      }
    }

    if (urlReg) {
      const cleanReg = urlReg.replace(/\s+/g, '').toLowerCase();
      const found = cars.find(c => c.registrationNo?.replace(/\s+/g, '').toLowerCase() === cleanReg);
      if (found) {
        setSelectedVehicleId(found.vehicleId);
        return;
      }
    }

    // Default select first vehicle if none selected yet
    if (!selectedVehicleId && cars.length > 0) {
      setSelectedVehicleId(cars[0].vehicleId);
    }
  }, [cars, searchParams, selectedVehicleId]);

  // Click outside search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered cars list for search dropdown
  const filteredCars = useMemo(() => {
    if (!searchQuery.trim()) return cars;
    const q = searchQuery.toLowerCase().trim();
    const cleanQ = q.replace(/[^a-z0-9]/g, '');

    return cars.filter(c => {
      const reg = (c.registrationNo || '').toLowerCase();
      const cleanReg = reg.replace(/[^a-z0-9]/g, '');
      const vId = (c.vehicleId || '').toLowerCase();
      const name = (c.carName || '').toLowerCase();
      const model = (c.modelNo || '').toLowerCase();
      const firm = (c.firmName || '').toLowerCase();
      const owner = (c.nameOfOwner || '').toLowerCase();

      return (
        reg.includes(q) ||
        cleanReg.includes(cleanQ) ||
        vId.includes(q) ||
        name.includes(q) ||
        model.includes(q) ||
        firm.includes(q) ||
        owner.includes(q)
      );
    });
  }, [cars, searchQuery]);

  // Current selected car object
  const currentCar = useMemo(() => {
    return cars.find(c => c.vehicleId === selectedVehicleId) || null;
  }, [cars, selectedVehicleId]);

  // Match helper
  const isMatchForCurrentCar = useCallback((item) => {
    if (!currentCar) return false;
    const vId = currentCar.vehicleId;
    const reg = currentCar.registrationNo ? currentCar.registrationNo.replace(/\s+/g, '').toUpperCase() : '';
    const name = currentCar.carName ? currentCar.carName.toLowerCase().trim() : '';

    if (item.vehicleId && item.vehicleId === vId) return true;
    if (item.registrationNo && reg && item.registrationNo.replace(/\s+/g, '').toUpperCase() === reg) return true;
    if (item.carName && name && item.carName.toLowerCase().trim() === name) return true;
    if (item.vehicleName && name && item.vehicleName.toLowerCase().trim() === name) return true;
    return false;
  }, [currentCar]);

  // 1. Matched Insurance record
  const currentInsurance = useMemo(() => {
    if (!currentCar) return null;
    return insuranceList.find(i => isMatchForCurrentCar(i)) || null;
  }, [currentCar, insuranceList, isMatchForCurrentCar]);

  // Matched renewals history
  const carRenewals = useMemo(() => {
    if (!currentCar) return [];
    return renewalsList.filter(r => isMatchForCurrentCar(r));
  }, [currentCar, renewalsList, isMatchForCurrentCar]);

  // 2. Matched EMI calculations
  const emiInfo = useMemo(() => {
    if (!currentCar) return null;
    const hasEmi = checkHasEmi(currentCar);
    const details = calcEmiDetails(currentCar);
    return { hasEmi, ...details };
  }, [currentCar]);

  // 3. Matched Repairs
  const carRepairs = useMemo(() => {
    if (!currentCar) return [];
    const matched = repairsList.filter(r => isMatchForCurrentCar(r));
    return matched.sort((a, b) => {
      const tA = new Date(a.dateOfAccident || a.timestamp || a.createdAt || 0).getTime();
      const tB = new Date(b.dateOfAccident || b.timestamp || b.createdAt || 0).getTime();
      return tB - tA;
    });
  }, [currentCar, repairsList, isMatchForCurrentCar]);

  // Summary of parts repaired & replaced across all repairs
  const partsSummary = useMemo(() => {
    if (carRepairs.length === 0) return [];
    const countMap = {};

    carRepairs.forEach(rep => {
      const offer = offersList.find(o => o.repairNo === rep.repairNo);
      const delivery = deliveriesList.find(d => d.repairNo === rep.repairNo);
      let foundParts = [];

      if (delivery?.repairWorkDone) {
        foundParts = String(delivery.repairWorkDone).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
      } else if (offer?.typesOfRepair && Array.isArray(offer.typesOfRepair) && offer.typesOfRepair.length > 0) {
        foundParts = offer.typesOfRepair;
      } else if (rep.typesOfRepair) {
        foundParts = Array.isArray(rep.typesOfRepair) ? rep.typesOfRepair : String(rep.typesOfRepair).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
      } else if (rep.reasonForRepair) {
        foundParts = [rep.reasonForRepair];
      }

      foundParts.forEach(part => {
        const clean = String(part).trim();
        if (clean) {
          countMap[clean] = (countMap[clean] || 0) + 1;
        }
      });
    });

    return Object.entries(countMap).map(([part, count]) => ({ part, count })).sort((a, b) => b.count - a.count);
  }, [carRepairs, offersList, deliveriesList]);

  // Total repair expenditure across payments, deliveries, bills, offers
  const totalRepairSpent = useMemo(() => {
    let sum = 0;
    carRepairs.forEach(rep => {
      const pm = paymentsList.find(p => p.repairNo === rep.repairNo);
      const del = deliveriesList.find(d => d.repairNo === rep.repairNo);
      const off = offersList.find(o => o.repairNo === rep.repairNo);

      const raw = pm?.billAmount || del?.billAmount || rep.billAmount || 
        ((del?.partsAmount || del?.serviceAmount) ? (Number(del?.partsAmount || 0) + Number(del?.serviceAmount || 0)) : null) ||
        off?.totalAmount || off?.offerAmount;

      if (raw !== undefined && raw !== null && raw !== '') {
        const num = Number(String(raw).replace(/[^0-9.-]+/g, ''));
        if (!isNaN(num) && num > 0) sum += num;
      }
    });
    return sum;
  }, [carRepairs, paymentsList, deliveriesList, offersList]);

  // Breakdown metrics for repairs (Total, Accidental, Normal, Invoiced)
  const repairMetrics = useMemo(() => {
    let accidentalCount = 0;
    let normalCount = 0;
    carRepairs.forEach(rep => {
      const isAcc = rep.repairType === 'Accident' || 
                    rep.repairType === 'Accidental' || 
                    rep.insuranceToBeClaimed === 'Yes' || 
                    claimsList.some(c => c.repairNo === rep.repairNo || (c.vehicleId === rep.vehicleId && c.dateOfAccident === rep.dateOfAccident));
      if (isAcc) accidentalCount++;
      else normalCount++;
    });
    return {
      total: carRepairs.length,
      accidental: accidentalCount,
      normal: normalCount
    };
  }, [carRepairs, claimsList]);

  // Aggregate financial breakdown for repair cards
  const repairFinancials = useMemo(() => {
    let partsTotal = 0;
    let serviceTotal = 0;
    let insuranceTotal = 0;

    carRepairs.forEach(rep => {
      const del = deliveriesList.find(d => d.repairNo === rep.repairNo);
      const claim = claimsList.find(c => c.repairNo === rep.repairNo || (c.vehicleId === rep.vehicleId && c.dateOfAccident === rep.dateOfAccident));
      if (del?.partsAmount) {
        const p = Number(String(del.partsAmount).replace(/[^0-9.-]+/g, ''));
        if (!isNaN(p)) partsTotal += p;
      }
      if (del?.serviceAmount) {
        const s = Number(String(del.serviceAmount).replace(/[^0-9.-]+/g, ''));
        if (!isNaN(s)) serviceTotal += s;
      }
      if (del?.insuranceAmount || claim?.claimApprovedAmount) {
        const ins = Number(String(del?.insuranceAmount || claim?.claimApprovedAmount).replace(/[^0-9.-]+/g, ''));
        if (!isNaN(ins)) insuranceTotal += ins;
      }
    });

    const netCompany = Math.max(0, totalRepairSpent - insuranceTotal);

    return {
      partsTotal,
      serviceTotal,
      insuranceTotal,
      netCompany
    };
  }, [carRepairs, deliveriesList, claimsList, totalRepairSpent]);

  // Helper: Synthesize complete repair audit details across all modules
  const getRepairAuditDetails = useCallback((rep, idx = 0) => {
    const offer = offersList.find(o => o.repairNo === rep.repairNo);
    const payment = paymentsList.find(p => p.repairNo === rep.repairNo);
    const delivery = deliveriesList.find(d => d.repairNo === rep.repairNo);
    const claim = claimsList.find(c => c.repairNo === rep.repairNo || (c.vehicleId === rep.vehicleId && c.dateOfAccident === rep.dateOfAccident));

    // 1. Accidental vs Normal
    const isAccidental = rep.repairType === 'Accident' || 
                         rep.repairType === 'Accidental' || 
                         rep.insuranceToBeClaimed === 'Yes' || 
                         !!claim;

    // 2. Reason (Kiyu repair kiye)
    const reason = rep.reasonForRepair || rep.problem || rep.accidentReason || claim?.accidentReason || 'Routine maintenance / checkup';

    // 3. What got repaired (Kya repair huaa)
    let partsList = [];
    if (delivery?.repairWorkDone) {
      partsList = String(delivery.repairWorkDone).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    } else if (offer?.typesOfRepair && Array.isArray(offer.typesOfRepair) && offer.typesOfRepair.length > 0) {
      partsList = offer.typesOfRepair;
    } else if (rep.typesOfRepair) {
      partsList = Array.isArray(rep.typesOfRepair) ? rep.typesOfRepair : String(rep.typesOfRepair).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    } else if (rep.repairWorkDone) {
      partsList = String(rep.repairWorkDone).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    }

    // 4. Cost / Expense (Kitna kharcha aaya)
    let cost = null;
    let costLabel = '';
    let costBadgeColor = '#475569';
    let costBadgeBg = '#f1f5f9';

    const partsCost = delivery?.partsAmount ? Number(String(delivery.partsAmount).replace(/[^0-9.-]+/g, '')) : null;
    const serviceCost = delivery?.serviceAmount ? Number(String(delivery.serviceAmount).replace(/[^0-9.-]+/g, '')) : null;

    if (payment?.billAmount) {
      cost = Number(String(payment.billAmount).replace(/[^0-9.-]+/g, ''));
      if (payment.paymentStatus === 'Payment Completed') {
        costLabel = 'Paid';
        costBadgeColor = '#166534';
        costBadgeBg = '#dcfce7';
      } else {
        costLabel = 'Invoiced';
        costBadgeColor = '#9a3412';
        costBadgeBg = '#ffedd5';
      }
    } else if (delivery?.billAmount) {
      cost = Number(String(delivery.billAmount).replace(/[^0-9.-]+/g, ''));
      costLabel = 'Billed';
      costBadgeColor = '#1e40af';
      costBadgeBg = '#dbeafe';
    } else if (rep.billAmount) {
      cost = Number(String(rep.billAmount).replace(/[^0-9.-]+/g, ''));
      costLabel = 'Billed';
      costBadgeColor = '#1e40af';
      costBadgeBg = '#dbeafe';
    } else if (partsCost !== null || serviceCost !== null) {
      cost = (partsCost || 0) + (serviceCost || 0);
      costLabel = 'Itemized';
      costBadgeColor = '#1e40af';
      costBadgeBg = '#dbeafe';
    } else if (offer?.totalAmount || offer?.offerAmount) {
      cost = Number(String(offer.totalAmount || offer.offerAmount).replace(/[^0-9.-]+/g, ''));
      costLabel = 'Quoted';
      costBadgeColor = '#854d0e';
      costBadgeBg = '#fef9c3';
    } else if (claim?.claimApprovedAmount) {
      cost = Number(String(claim.claimApprovedAmount).replace(/[^0-9.-]+/g, ''));
      costLabel = 'Approved Claim';
      costBadgeColor = '#065f46';
      costBadgeBg = '#d1fae5';
    }

    const insuranceCovered = delivery?.insuranceAmount || claim?.claimApprovedAmount || null;

    return {
      carNumber: rep.registrationNo || currentCar?.registrationNo || '—',
      carModel: rep.carName || rep.vehicleName || currentCar?.carName || '—',
      repairNo: rep.repairNo || `REP-${String(idx + 1).padStart(4, '0')}`,
      date: rep.dateOfAccident || rep.timestamp || rep.createdAt,
      isAccidental,
      reason,
      partsList,
      cost,
      costLabel,
      costBadgeColor,
      costBadgeBg,
      partsCost,
      serviceCost,
      insuranceCovered,
      garage: delivery?.garageName || rep.garage || rep.garageName || '—',
      custodian: rep.whoTakingCar || rep.driverName || '—',
      status: payment?.paymentStatus || delivery?.deliveryStatus || rep.repairStatus || 'Created',
      claimNo: claim?.claimNo || null,
      claimStatus: claim?.claimFinalStatus || claim?.claimStatus || null,
      offerSubmitted: !!offer,
      invoiceUrl: (() => {
        const rawBill = delivery?.billImage || delivery?.billPhoto || delivery?.billDoc || delivery?.invoice || delivery?.invoiceImage || delivery?.invoiceFile ||
                        payment?.billImage || payment?.invoice || payment?.invoiceImage || payment?.invoiceFile ||
                        rep?.billImage || rep?.invoiceImage || rep?.invoice || rep?.billDoc ||
                        offer?.photoOfOffer || offer?.offerImage ||
                        claim?.paymentReceipt || claim?.claimBill || null;
        if (!rawBill) return null;
        if (typeof rawBill === 'object') {
          return rawBill.url || rawBill.dataUrl || rawBill.fileUrl || rawBill.preview || null;
        }
        if (typeof rawBill === 'string' && rawBill.trim() !== '') return rawBill.trim();
        return null;
      })()
    };
  }, [offersList, paymentsList, deliveriesList, claimsList, currentCar]);

  // 4. Matched Claims / Accidents
  const carClaims = useMemo(() => {
    if (!currentCar) return [];
    const matched = claimsList.filter(c => {
      if (isMatchForCurrentCar(c)) return true;
      if (c.repairNo && carRepairs.some(r => r.repairNo === c.repairNo)) return true;
      return false;
    });

    return matched.sort((a, b) => {
      const tA = new Date(a.dateOfAccident || a.timestamp || a.createdAt || 0).getTime();
      const tB = new Date(b.dateOfAccident || b.timestamp || b.createdAt || 0).getTime();
      return tB - tA;
    });
  }, [currentCar, claimsList, carRepairs, isMatchForCurrentCar]);

  // 5. Matched Challans & Fastags
  const carChallans = useMemo(() => {
    if (!currentCar) return [];
    const matched = challansList.filter(ch => isMatchForCurrentCar(ch));
    return matched.sort((a, b) => {
      const tA = new Date(a.dateOfChallan || a.timestamp || a.createdAt || 0).getTime();
      const tB = new Date(b.dateOfChallan || b.timestamp || b.createdAt || 0).getTime();
      return tB - tA;
    });
  }, [currentCar, challansList, isMatchForCurrentCar]);

  const challanMetrics = useMemo(() => {
    const total = carChallans.length;
    let pendingCount = 0;
    let paidCount = 0;
    let totalAmount = 0;
    let pendingAmount = 0;
    let paidAmount = 0;

    carChallans.forEach(ch => {
      const amt = Number(String(ch.challanAmount || ch.amount || 0).replace(/[^0-9.-]+/g, '')) || 0;
      totalAmount += amt;
      const st = ch.paymentStatus || ch.status || 'Pending';
      if (st === 'Paid') {
        paidCount += 1;
        paidAmount += amt;
      } else {
        pendingCount += 1;
        pendingAmount += amt;
      }
    });

    return {
      total,
      pendingCount,
      paidCount,
      totalAmount,
      pendingAmount,
      paidAmount
    };
  }, [carChallans]);

  const carFastag = useMemo(() => {
    if (!currentCar) return null;
    return fastagsList.find(ft => isMatchForCurrentCar(ft)) || null;
  }, [currentCar, fastagsList, isMatchForCurrentCar]);

  // Select a car handler
  const handleSelectCar = (car) => {
    setSelectedVehicleId(car.vehicleId);
    setSearchQuery('');
    setIsDropdownOpen(false);
    setSearchParams({ car: car.vehicleId });
  };

  // Next / Previous car navigators
  const currentIndex = cars.findIndex(c => c.vehicleId === selectedVehicleId);
  const handlePrevCar = () => {
    if (cars.length === 0) return;
    const prevIdx = (currentIndex - 1 + cars.length) % cars.length;
    handleSelectCar(cars[prevIdx]);
  };
  const handleNextCar = () => {
    if (cars.length === 0) return;
    const nextIdx = (currentIndex + 1) % cars.length;
    handleSelectCar(cars[nextIdx]);
  };

  // Manual refresh sync with Google Sheets
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await syncAllFromSheets();
      await loadAllData(false);
      toast.success('Fleet records synchronized with Google Sheets');
    } catch (e) {
      toast.error('Sync failed');
    } finally {
      setRefreshing(false);
    }
  };

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // Insurance Renewal Calculations
  const insuranceRenewalDetails = useMemo(() => {
    if (!currentInsurance) {
      if (currentCar?.dateOfInsurance) {
        const exp = calcInsuranceRenewal(currentCar.dateOfInsurance, 1);
        const daysLeft = exp ? daysUntil(exp) : null;
        return {
          nextRenewalDate: exp,
          daysLeft,
          lastRenewalDate: currentCar.dateOfInsurance,
          company: currentCar.nameOfCompany || '—',
          policyNo: '—',
          status: daysLeft === null ? 'Unknown' : (daysLeft < 0 ? 'Expired' : (daysLeft <= 30 ? 'Due Soon' : 'Active')),
        };
      }
      return null;
    }

    const earliestRenewal = calcEarliestCoverRenewal(
      currentInsurance.odEndDate,
      currentInsurance.tpEndDate,
      currentInsurance.paEndDate
    ) || (currentInsurance.date ? calcInsuranceRenewal(currentInsurance.date, 1) : null);

    const daysLeft = earliestRenewal ? daysUntil(earliestRenewal) : null;
    const lastRenewalDate = currentInsurance.date || currentInsurance.dateOfInsurance || currentInsurance.timestamp || null;

    let status = 'Active';
    if (daysLeft !== null) {
      if (daysLeft < 0) status = 'Expired';
      else if (daysLeft <= 30) status = 'Due Soon';
      else status = 'Active';
    }

    return {
      nextRenewalDate: earliestRenewal,
      daysLeft,
      lastRenewalDate,
      renewalId: currentInsurance.renewalId || null,
      insuranceId: currentInsurance.insuranceId || '—',
      company: currentInsurance.nameOfCompany || currentCar?.nameOfCompany || '—',
      policyNo: currentInsurance.tpPolicyNo || currentInsurance.policyNo || '—',
      status,
      odEndDate: currentInsurance.odEndDate,
      tpEndDate: currentInsurance.tpEndDate,
      paEndDate: currentInsurance.paEndDate,
      totalPremium: currentInsurance.totalPremiumAmount || currentInsurance.totalPremiumToBePaid || currentCar?.insuranceAmount,
    };
  }, [currentInsurance, currentCar]);

  if (loading) {
    return <SpeedingCarLoader message="Loading Vehicle Report..." />;
  }

  return (
    <div className="car-report-page" style={{ paddingBottom: 60, maxWidth: 1240, margin: '0 auto' }}>
      {/* ─── PRINT-ONLY FORMAL AUDIT HEADER ─── */}
      <div className="print-only" style={{ display: 'none', marginBottom: 24, borderBottom: '2px solid #0f172a', paddingBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px', textTransform: 'uppercase' }}>
              Passary Fleet Management System
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginTop: 2 }}>
              Vehicle Report
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Document ID: REPORT-{currentCar?.vehicleId || 'NA'} • Confidential Corporate Record
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
            <div><strong>Date Generated:</strong> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div><strong>Authorized Auditor:</strong> {currentUser?.name || 'Administrator'}</div>
            <div><strong>Department:</strong> {currentUser?.department || 'Operations / Fleet'}</div>
          </div>
        </div>
      </div>

      {/* ─── SCREEN TOP HEADER ─── */}
      <div className="no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: '#0f172a', color: '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <FileText size={20} strokeWidth={2.2} />
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.2px' }}>
                  Vehicle Report
                </h1>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn btn-outline"
              style={{
                background: '#ffffff', borderColor: '#cbd5e1', color: '#334155',
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
                fontSize: 13, fontWeight: 600
              }}
              title="Synchronize records with Google Sheets"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Sync Data'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="btn btn-primary"
              style={{
                background: '#0f172a', borderColor: '#0f172a', color: '#ffffff',
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8,
                fontSize: 13, fontWeight: 700
              }}
            >
              <Printer size={15} />
              <span>Print Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── PROFESSIONAL SEARCH & VEHICLE SELECTOR ─── */}
      <div className="no-print" style={{
        background: '#ffffff', borderRadius: 12, padding: '16px 20px',
        border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          {/* Search Dropdown Combo Box */}
          <div ref={searchContainerRef} style={{ position: 'relative', flex: '1 1 360px', minWidth: 280 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Select Fleet Vehicle
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex' }}>
                <Search size={16} />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by registration number, vehicle ID, make or owner..."
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                style={{
                  width: '100%', padding: '9px 36px 9px 36px',
                  borderRadius: 8, border: '1px solid #cbd5e1',
                  background: '#ffffff', fontSize: 13.5, fontWeight: 600, color: '#0f172a',
                  outline: 'none', transition: 'border-color 0.2s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b'
                  }}
                >
                  <X size={12} />
                </button>
              ) : (
                <div
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    color: '#64748b', cursor: 'pointer'
                  }}
                >
                  <ChevronDown size={16} />
                </div>
              )}
            </div>

            {/* Dropdown Results List */}
            {isDropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
                background: '#ffffff', borderRadius: 10, border: '1px solid #cbd5e1',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)', maxHeight: 340, overflowY: 'auto'
              }}>
                <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{filteredCars.length} VEHICLES MATCHED</span>
                  <span>Select to switch</span>
                </div>

                {filteredCars.length === 0 ? (
                  <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    No vehicle found matching "{searchQuery}"
                  </div>
                ) : (
                  filteredCars.map(car => {
                    const isSelected = car.vehicleId === selectedVehicleId;
                    const carRepCount = repairsList.filter(r => r.vehicleId === car.vehicleId || r.registrationNo === car.registrationNo).length;
                    const carAccCount = claimsList.filter(c => c.vehicleId === car.vehicleId || c.registrationNo === car.registrationNo).length;
                    const hasEmi = checkHasEmi(car);

                    return (
                      <div
                        key={car.vehicleId}
                        onClick={() => handleSelectCar(car)}
                        style={{
                          padding: '10px 14px', borderBottom: '1px solid #f1f5f9',
                          background: isSelected ? '#f8fafc' : '#ffffff',
                          cursor: 'pointer', transition: 'background 0.15s',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = '#ffffff'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            fontFamily: 'monospace', fontWeight: 800, fontSize: 12.5,
                            background: '#f1f5f9', color: '#0f172a',
                            border: '1px solid #cbd5e1', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.4px'
                          }}>
                            {car.registrationNo || 'NO-REG'}
                          </span>

                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                              {car.carName || 'Vehicle'} {car.modelNo ? `(${car.modelNo})` : ''}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span>{car.vehicleId}</span>
                              {car.firmName && <span>• {car.firmName}</span>}
                              {car.fuelType && <span>• {car.fuelType}</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {hasEmi && (
                            <span style={{ fontSize: 10.5, fontWeight: 700, background: '#f1f5f9', color: '#2563eb', padding: '2px 6px', borderRadius: 4 }}>
                              EMI
                            </span>
                          )}
                          {carRepCount > 0 && (
                            <span style={{ fontSize: 10.5, fontWeight: 700, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: 4 }}>
                              {carRepCount} Repairs
                            </span>
                          )}
                          {carAccCount > 0 && (
                            <span style={{ fontSize: 10.5, fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: 4 }}>
                              {carAccCount} Claims
                            </span>
                          )}
                          {isSelected && <Check size={14} color="#059669" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Stepper Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              {currentIndex >= 0 ? `Vehicle ${currentIndex + 1} of ${cars.length}` : `${cars.length} Fleet Assets`}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={handlePrevCar}
                className="btn btn-outline"
                style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#334155' }}
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={handleNextCar}
                className="btn btn-outline"
                style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#334155' }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>

      {!currentCar ? (
        <EmptyState
          title="No Vehicle Selected"
          message="Please select a vehicle from the search bar above to view its report."
          actionText="Select First Vehicle"
          onAction={() => cars.length > 0 && handleSelectCar(cars[0])}
        />
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════════
              EXECUTIVE VEHICLE PROFILE HEADER & HIGHLIGHTED STATS
             ══════════════════════════════════════════════════════════════════ */}
          <div className="vehicle-profile-card" style={{
            background: '#ffffff', borderRadius: 14,
            border: '1.5px solid #cbd5e1',
            borderTop: '4px solid #0f172a',
            padding: '24px 28px', marginBottom: 22,
            boxShadow: '0 4px 18px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)'
          }}>
            {/* Header Identity Row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* Registration Badge */}
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 900, fontSize: 15,
                    background: '#f8fafc', color: '#0f172a',
                    border: '1.5px solid #334155', padding: '4px 12px', borderRadius: 6,
                    letterSpacing: '0.8px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}>
                    {currentCar.registrationNo || 'UNREGISTERED'}
                  </span>

                  <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 9px', borderRadius: 6 }}>
                    ID: {currentCar.vehicleId}
                  </span>

                  {currentCar.fuelType && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 9px', borderRadius: 6 }}>
                      {currentCar.fuelType}
                    </span>
                  )}

                  {currentCar.firmName && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 9px', borderRadius: 6 }}>
                      {currentCar.firmName}
                    </span>
                  )}
                </div>

                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '14px 0 6px', letterSpacing: '-0.3px' }}>
                  {currentCar.carName || 'Vehicle Asset'} {currentCar.modelNo ? `• ${currentCar.modelNo}` : ''}
                </h2>

                <div style={{ fontSize: 13, color: '#475569', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  {currentCar.nameOfOwner && (
                    <span><strong style={{ color: '#64748b', fontWeight: 600 }}>Registered Owner:</strong> <strong style={{ color: '#0f172a' }}>{currentCar.nameOfOwner}</strong></span>
                  )}
                  {currentCar.dateOfPurchase && (
                    <span><strong style={{ color: '#64748b', fontWeight: 600 }}>Acquired:</strong> <strong style={{ color: '#0f172a' }}>{formatDate(currentCar.dateOfPurchase)}</strong></span>
                  )}
                  {currentCar.vehicleAssignTo && (
                    <span><strong style={{ color: '#64748b', fontWeight: 600 }}>Custodian:</strong> <strong style={{ color: '#0f172a' }}>{currentCar.vehicleAssignTo}</strong></span>
                  )}
                </div>
              </div>

              {/* Status Verification Badge */}
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 800,
                  background: carClaims.length > 0 ? '#fef2f2' : '#f0fdf4',
                  color: carClaims.length > 0 ? '#b91c1c' : '#15803d',
                  border: `1.5px solid ${carClaims.length > 0 ? '#fca5a5' : '#86efac'}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                  {carClaims.length > 0 ? (
                    <>
                      <AlertTriangle size={15} strokeWidth={2.5} />
                      <span>{carClaims.length} Recorded Accident {carClaims.length === 1 ? 'Claim' : 'Claims'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={15} strokeWidth={2.5} />
                      <span>Clean Record • Zero Incidents</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 4 Highlighted Executive KPI Cards */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14, marginTop: 22, paddingTop: 20, borderTop: '1.5px solid #e2e8f0'
            }}>
              {/* 1. Acquisition Value */}
              <div style={{
                background: '#f8fafc', padding: '16px 18px', borderRadius: 10,
                border: '1.5px solid #cbd5e1', borderLeft: '4px solid #0f172a',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Acquisition Value
                </div>
                <div style={{ fontSize: 21, fontWeight: 900, color: '#0f172a', marginTop: 6, letterSpacing: '-0.2px' }}>
                  {formatINR(currentCar.valueOfCar)}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
                  {currentCar.dateOfPurchase ? `Date: ${formatDate(currentCar.dateOfPurchase)}` : 'Value not logged'}
                </div>
              </div>

              {/* 2. Insurance Policy Renewal */}
              <div style={{
                background: '#f8fafc', padding: '16px 18px', borderRadius: 10,
                border: '1.5px solid #cbd5e1',
                borderLeft: `4px solid ${insuranceRenewalDetails?.daysLeft < 0 ? '#dc2626' : (insuranceRenewalDetails?.daysLeft <= 30 ? '#d97706' : '#059669')}`,
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Insurance Renewal
                </div>
                <div style={{ fontSize: 21, fontWeight: 900, color: '#0f172a', marginTop: 6, letterSpacing: '-0.2px' }}>
                  {insuranceRenewalDetails?.nextRenewalDate ? formatDate(insuranceRenewalDetails.nextRenewalDate) : 'Not Logged'}
                </div>
                <div style={{
                  fontSize: 12, marginTop: 4, fontWeight: 700,
                  color: insuranceRenewalDetails?.daysLeft < 0 ? '#dc2626' : (insuranceRenewalDetails?.daysLeft <= 30 ? '#d97706' : '#059669')
                }}>
                  {insuranceRenewalDetails?.daysLeft !== null ? (
                    insuranceRenewalDetails.daysLeft < 0
                      ? `Expired ${Math.abs(insuranceRenewalDetails.daysLeft)} days ago`
                      : `Active • Due in ${insuranceRenewalDetails.daysLeft} days`
                  ) : 'No renewal logged'}
                </div>
              </div>

              {/* 3. Financing / Loan */}
              <div style={{
                background: '#f8fafc', padding: '16px 18px', borderRadius: 10,
                border: '1.5px solid #cbd5e1', borderLeft: '4px solid #2563eb',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Financing & Loan
                </div>
                <div style={{ fontSize: 21, fontWeight: 900, color: '#0f172a', marginTop: 6, letterSpacing: '-0.2px' }}>
                  {emiInfo.hasEmi ? `${formatINR(emiInfo.emiAmount)} / mo` : 'No Active Loan'}
                </div>
                <div style={{ fontSize: 12, color: emiInfo.hasEmi ? '#1e40af' : '#64748b', marginTop: 4, fontWeight: 600 }}>
                  {emiInfo.hasEmi
                    ? (emiInfo.isCompleted ? 'Loan Term Completed' : `${emiInfo.paidEmis || 0} of ${emiInfo.totalEmis || 0} EMIs Paid`)
                    : '100% Owned Outright'}
                </div>
              </div>

              {/* 4. Maintenance Orders */}
              <div style={{
                background: '#f8fafc', padding: '16px 18px', borderRadius: 10,
                border: '1.5px solid #cbd5e1', borderLeft: '4px solid #d97706',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Maintenance & Service
                </div>
                <div style={{ fontSize: 21, fontWeight: 900, color: '#0f172a', marginTop: 6, letterSpacing: '-0.2px' }}>
                  {carRepairs.length} {carRepairs.length === 1 ? 'Service Order' : 'Service Orders'}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 600 }}>
                  Total Invoiced: {formatINR(totalRepairSpent)}
                </div>
              </div>
            </div>
          </div>

          {/* ─── PROFESSIONAL CORPORATE TABS ─── */}
          <div className="no-print" style={{
            display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 20,
            borderBottom: '1px solid #cbd5e1'
          }}>
            {[
              { id: 'all', label: 'All Sections' },
              { id: 'purchase', label: 'Purchase Profile' },
              { id: 'insurance', label: 'Insurance & Renewal', count: carRenewals.length || null },
              { id: 'emi', label: 'Loan & EMI', count: emiInfo.hasEmi ? `${emiInfo.remainingEmis || 0} left` : null },
              { id: 'repairs', label: 'Maintenance & Parts', count: carRepairs.length },
              { id: 'accidents', label: 'Incident & Claims', count: carClaims.length, alert: carClaims.length > 0 },
              { id: 'fastag', label: 'FASTag Toll', count: carFastag ? (carFastag.fastagStatus || 'Active') : null },
              { id: 'challans', label: 'Traffic Challans', count: carChallans.length, alert: challanMetrics.pendingCount > 0 },
            ].map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                    border: 'none', background: 'transparent',
                    color: active ? '#0f172a' : '#64748b',
                    fontWeight: active ? 700 : 500, fontSize: 13,
                    borderBottom: active ? '2.5px solid #0f172a' : '2.5px solid transparent',
                    cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap'
                  }}
                >
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span style={{
                      fontSize: 11, padding: '1px 6px', borderRadius: 4,
                      background: tab.alert ? '#fee2e2' : '#f1f5f9',
                      color: tab.alert ? '#dc2626' : '#475569',
                      fontWeight: 700
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 1: VEHICLE PURCHASE & REGISTRATION PROFILE
             ══════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'purchase') && (
            <div className="report-card print-page-break" style={{
              background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0',
              padding: '22px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div className="print-only" style={{ display: 'none', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #cbd5e1', fontSize: 11, color: '#475569' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><strong>Vehicle Report</strong> • {currentCar.carName || 'Vehicle'} ({currentCar.registrationNo || '—'})</span>
                  <span>Asset ID: <strong>{currentCar.vehicleId}</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    1. Purchase & Registration Profile
                  </h3>
                </div>

                {currentCar.copyOfRegistration && (
                  <button
                    type="button"
                    onClick={() => openDocument(currentCar.copyOfRegistration?.url || currentCar.copyOfRegistration, `${currentCar.registrationNo}_RC`)}
                    className="btn btn-outline"
                    style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5, color: '#0f172a', borderColor: '#cbd5e1' }}
                  >
                    <FileText size={13} />
                    <span>View Registration (RC)</span>
                  </button>
                )}
              </div>

              {/* 3 Structured Attribute Tables */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* Column 1: Asset Technical Identity */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Technical Specifications
                  </div>
                  <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Registration No.</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{currentCar.registrationNo || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Asset ID</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{currentCar.vehicleId || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Make & Model</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{currentCar.carName || '—'} {currentCar.modelNo ? `(${currentCar.modelNo})` : ''}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Fuel Classification</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{currentCar.fuelType || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Chassis Serial No.</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#334155' }}>{currentCar.chassisNo || '—'}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Engine Serial No.</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#334155' }}>{currentCar.engineNo || '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Column 2: Commercial Procurement */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Procurement & Pricing
                  </div>
                  <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Acquisition Date</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{formatDate(currentCar.dateOfPurchase)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Invoice Value</td>
                        <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0f172a' }}>{formatINR(currentCar.valueOfCar)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Dealer / Supplier</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{currentCar.companyPurchasedFrom || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Supplier Contact</td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>{currentCar.companyMobileNo || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Service Manager</td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>
                          {currentCar.servicePersonName || '—'} {currentCar.servicePersonMobileNo ? `• ${currentCar.servicePersonMobileNo}` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>RTO & Registration Tax</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{formatINR(currentCar.rtoAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Column 3: Corporate Ownership & Custody */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Title & Custody Assignment
                  </div>
                  <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Corporate Entity</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{currentCar.firmName || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Title Owner Name</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{currentCar.nameOfOwner || '—'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Assigned Custodian</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{currentCar.vehicleAssignTo || 'Unassigned'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Employee Code & Tel</td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>
                          {currentCar.employeeId || '—'} {currentCar.assigneeMobileNo ? `• ${currentCar.assigneeMobileNo}` : ''}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Pollution (PUC) Expiry</td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>
                          {currentCar.pollutionDate ? formatDate(currentCar.pollutionDate) : 'Not Logged'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Lien Release Date</td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>
                          {currentCar.dateOfReleaseHypothecation ? formatDate(currentCar.dateOfReleaseHypothecation) : 'Under Hypothecation'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 2: INSURANCE & RENEWAL SCHEDULE
             ══════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'insurance') && (
            <div className="report-card print-page-break" style={{
              background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0',
              padding: '22px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div className="print-only" style={{ display: 'none', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #cbd5e1', fontSize: 11, color: '#475569' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><strong>Vehicle Report</strong> • {currentCar.carName || 'Vehicle'} ({currentCar.registrationNo || '—'})</span>
                  <span>Asset ID: <strong>{currentCar.vehicleId}</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    2. Insurance Policy & Renewal Schedule
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(currentInsurance?.copyOfInsurance || currentCar?.copyOfInsurance) && (
                    <button
                      type="button"
                      onClick={() => openDocument((currentInsurance?.copyOfInsurance || currentCar?.copyOfInsurance)?.url || currentInsurance?.copyOfInsurance || currentCar?.copyOfInsurance, `${currentCar.registrationNo}_Insurance`)}
                      className="btn btn-outline"
                      style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5, color: '#0f172a', borderColor: '#cbd5e1' }}
                    >
                      <FileText size={13} />
                      <span>View Policy Document</span>
                    </button>
                  )}
                </div>
              </div>

              {/* RENEWAL TIMELINE AUDIT CALLOUT (CORPORATE EXECUTIVE CARD) */}
              <div style={{
                background: '#f8fafc', borderRadius: 8, padding: '16px 20px',
                border: '1px solid #e2e8f0', marginBottom: 18,
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16
              }}>
                {/* 1. Next Scheduled Renewal */}
                <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Next Scheduled Renewal Date
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {insuranceRenewalDetails?.nextRenewalDate ? formatDate(insuranceRenewalDetails.nextRenewalDate) : 'Not Scheduled'}
                  </div>
                  <div style={{
                    fontSize: 11.5, fontWeight: 700, marginTop: 2,
                    color: insuranceRenewalDetails?.daysLeft < 0 ? '#dc2626' : (insuranceRenewalDetails?.daysLeft <= 30 ? '#d97706' : '#059669')
                  }}>
                    {insuranceRenewalDetails?.daysLeft !== null ? (
                      insuranceRenewalDetails.daysLeft < 0
                        ? `Policy Expired (${Math.abs(insuranceRenewalDetails.daysLeft)} days overdue)`
                        : `${insuranceRenewalDetails.daysLeft} days remaining for renewal`
                    ) : 'No validity recorded'}
                  </div>
                </div>

                {/* 2. Previous Renewal Date */}
                <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Previous Policy / Renewal Date
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {insuranceRenewalDetails?.lastRenewalDate ? formatDate(insuranceRenewalDetails.lastRenewalDate) : 'Initial Vehicle Policy'}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                    {insuranceRenewalDetails?.renewalId ? `Log ID: ${insuranceRenewalDetails.renewalId}` : 'Initial Acquisition Policy'}
                  </div>
                </div>

                {/* 3. Underwriter & Policy Number */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Underwriter & Total Invoiced Premium
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {insuranceRenewalDetails?.company || 'Not Specified'}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>
                    Premium: <strong>{formatINR(insuranceRenewalDetails?.totalPremium)}</strong> • {insuranceRenewalDetails?.policyNo || 'Policy No. Pending'}
                  </div>
                </div>
              </div>

              {currentInsurance ? (
                <>
                  {/* Coverage Details Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {/* Coverage Breakdown Table */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Coverage Matrix & Policy Terms
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Third Party Policy No.</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{currentInsurance.tpPolicyNo || '—'}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Own Damage (OD) Cover</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {currentInsurance.odStartDate ? formatDate(currentInsurance.odStartDate) : '—'} to {currentInsurance.odEndDate ? formatDate(currentInsurance.odEndDate) : '—'} ({currentInsurance.odTenure || '1'} Yr)
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Third Party (TP) Cover</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {currentInsurance.tpStartDate ? formatDate(currentInsurance.tpStartDate) : '—'} to {currentInsurance.tpEndDate ? formatDate(currentInsurance.tpEndDate) : '—'} ({currentInsurance.tpTenure || '3'} Yrs)
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Personal Accident (CPA)</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {currentInsurance.paCoverType || 'Owner-Driver CPA (₹15L)'} {currentInsurance.paEndDate ? `(Valid till ${formatDate(currentInsurance.paEndDate)})` : ''}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>CPA Nominee & Relation</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {currentInsurance.paNomineeName || '—'} {currentInsurance.paNomineeRelation ? `(${currentInsurance.paNomineeRelation})` : ''}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Direct Broker / Agent</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{currentInsurance.agentName || 'Direct Corporate'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Premium Schedule Table */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Valuation & Premium Schedule
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Insured Declared Value (IDV)</td>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0f172a' }}>{formatINR(currentInsurance.idvValue)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Basic OD Net Premium</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{formatINR(currentInsurance.basicPremium)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Third Party Statutory Premium</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{formatINR(currentInsurance.thirdPartyPremium)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Add-on Covers Surcharge</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{formatINR(currentInsurance.addOnPremium)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Goods & Services Tax (GST)</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{formatINR(currentInsurance.taxAmount)}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>Total Invoiced Premium</td>
                            <td style={{ padding: '8px 12px', fontWeight: 900, color: '#059669' }}>
                              {formatINR(currentInsurance.totalPremiumAmount || currentInsurance.totalPremiumToBePaid)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Endorsements Checklist */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Active Policy Endorsements
                      </div>
                      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                        {[
                          { label: 'Zero Depreciation Cover', active: currentInsurance.depreciationReimbursement },
                          { label: 'Engine & Gearbox Protection', active: currentInsurance.engineSecure },
                          { label: '24x7 Roadside Assistance (RSA)', active: currentInsurance.roadsideAssistance },
                          { label: 'Consumable Items Coverage', active: currentInsurance.consumableExpenses },
                          { label: 'Key & Lock Replacement Cover', active: currentInsurance.keyReplacement },
                          { label: 'Return to Invoice (RTI)', active: currentInsurance.returnToInvoice },
                          { label: 'Cashless Garage Authorization', active: currentInsurance.cashlessPolicy === 'Yes' },
                        ].map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: idx < 6 ? '1px dashed #f1f5f9' : 'none' }}>
                            <span style={{ color: item.active ? '#0f172a' : '#94a3b8', fontWeight: item.active ? 600 : 400 }}>
                              {item.label}
                            </span>
                            <span style={{
                              fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                              background: item.active ? '#f0fdf4' : '#f8fafc',
                              color: item.active ? '#166534' : '#94a3b8',
                              border: `1px solid ${item.active ? '#bbf7d0' : '#e2e8f0'}`
                            }}>
                              {item.active ? 'Included' : 'Not Included'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Historical Renewals Table */}
                  {carRenewals.length > 0 && (
                    <div style={{ marginTop: 18 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                        Policy Renewal Historical Log
                      </div>
                      <div style={{ overflowX: 'auto', border: '1.5px solid #cbd5e1', borderRadius: 8, background: '#ffffff' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 640 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                              <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Renewal ID</th>
                              <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Effective Date</th>
                              <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Underwriter / Insurer</th>
                              <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Coverage Scope</th>
                              <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Duration</th>
                              <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Invoiced Premium</th>
                            </tr>
                          </thead>
                          <tbody>
                            {carRenewals.map((r, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{r.renewalId || r['Renewal ID'] || `REINS-${i+1}`}</td>
                                <td style={{ padding: '10px 14px', color: '#334155' }}>{formatDate(r.date || r['Date'] || r.timestamp)}</td>
                                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{r.nameOfCompany || r['Name Of Company'] || '—'}</td>
                                <td style={{ padding: '10px 14px', color: '#334155' }}>{r.coverType || r['Cover Type'] || 'Comprehensive'}</td>
                                <td style={{ padding: '10px 14px', color: '#334155' }}>{r.tenure || r['Tenure'] || '1 Year'}</td>
                                <td style={{ padding: '10px 14px', fontWeight: 800, color: '#059669' }}>{formatINR(r.totalPremium || r['Total Premium Amount'] || r.totalPremiumToBePaid)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: '20px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: 13 }}>
                  No standalone insurance profile filed in system. Acquisition records note insurance date: <strong>{currentCar.dateOfInsurance ? formatDate(currentCar.dateOfInsurance) : 'Pending'}</strong>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 3: VEHICLE LOAN & EMI AMORTIZATION
             ══════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'emi') && (
            <div className="report-card print-page-break" style={{
              background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0',
              padding: '22px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div className="print-only" style={{ display: 'none', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #cbd5e1', fontSize: 11, color: '#475569' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><strong>Vehicle Report</strong> • {currentCar.carName || 'Vehicle'} ({currentCar.registrationNo || '—'})</span>
                  <span>Asset ID: <strong>{currentCar.vehicleId}</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    3. Financing & Loan Amortization (EMI)
                  </h3>
                </div>

                <div>
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: emiInfo.hasEmi ? (emiInfo.isCompleted ? '#f0fdf4' : '#f8fafc') : '#f8fafc',
                    color: emiInfo.hasEmi ? (emiInfo.isCompleted ? '#166534' : '#0f172a') : '#64748b',
                    border: '1px solid #cbd5e1'
                  }}>
                    {emiInfo.hasEmi ? (emiInfo.isCompleted ? 'Loan Term Completed' : 'Active Financial Facility') : 'Outright Asset (No Lien)'}
                  </span>
                </div>
              </div>

              {emiInfo.hasEmi ? (
                <>
                  {/* Amortization Progress Strip */}
                  {emiInfo.totalEmis > 0 && (
                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                          Principal Repayment Progress: {emiInfo.paidEmis || 0} of {emiInfo.totalEmis} Installments Settled
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                          {Math.round(((emiInfo.paidEmis || 0) / emiInfo.totalEmis) * 100)}%
                        </span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, Math.round(((emiInfo.paidEmis || 0) / emiInfo.totalEmis) * 100))}%`,
                          height: '100%', background: '#0f172a', borderRadius: 4
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 6 }}>
                        <span>Settled: {formatINR(emiInfo.paidAmount)}</span>
                        <span>Outstanding Principal: {formatINR(emiInfo.remainingAmount)}</span>
                      </div>
                    </div>
                  )}

                  {/* 3 Structured Attribute Tables */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Financier & Sanction Terms
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Lending Institution</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{currentCar.hypothecationBank || '—'}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Sanctioned Principal</td>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0f172a' }}>{formatINR(emiInfo.loanAmount || currentCar.loanAmount)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Monthly Installment</td>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0f172a' }}>{formatINR(emiInfo.emiAmount || currentCar.emiAmount)}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Loan Account / EMI ID</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#334155' }}>{currentCar.emiNo || '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Installment Tenure Tracking
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Total Loan Tenure</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{emiInfo.totalEmis || currentCar.totalEmis || '—'} Months</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Settled Installments</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#166534' }}>{emiInfo.paidEmis ?? currentCar.paidEmis ?? 0} EMIs</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Balance Installments</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#991b1b' }}>{emiInfo.remainingEmis ?? 0} EMIs</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Balance Principal</td>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: '#991b1b' }}>{formatINR(emiInfo.remainingAmount || currentCar.remainingLoanAmount)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Maturity & Repayment Dates
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Inception Date</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{formatDate(currentCar.emiStartDate)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Final Maturity Date</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{formatDate(currentCar.lastEmiDate)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Next Repayment Due</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>
                              {emiInfo.isCompleted ? 'Facility Closed' : (emiInfo.nextEmiDate ? formatDate(emiInfo.nextEmiDate) : '—')}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Repayment Status</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: emiInfo.isCompleted ? '#166534' : '#475569' }}>
                              {emiInfo.isCompleted
                                ? 'No Outstanding Dues'
                                : (emiInfo.daysUntilNextEmi !== null
                                    ? (emiInfo.daysUntilNextEmi < 0 ? `Overdue by ${Math.abs(emiInfo.daysUntilNextEmi)} days` : `Due in ${emiInfo.daysUntilNextEmi} days`)
                                    : 'Regular')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '20px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: 13 }}>
                  This vehicle is an unencumbered company asset. No hypothecation or active loan liability is recorded.
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 4: MAINTENANCE & PARTS SERVICED LOG
             ══════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'repairs') && (
            <div className="report-card print-page-break" style={{
              background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0',
              padding: '22px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div className="print-only" style={{ display: 'none', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #cbd5e1', fontSize: 11, color: '#475569' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><strong>Vehicle Report</strong> • {currentCar.carName || 'Vehicle'} ({currentCar.registrationNo || '—'})</span>
                  <span>Asset ID: <strong>{currentCar.vehicleId}</strong></span>
                </div>
              </div>

              {/* Section Header with Clean Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    4. Maintenance History & Parts Servicing Log
                  </h3>
                </div>

                <div>
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: carRepairs.length > 0 ? '#f0fdf4' : '#f8fafc',
                    color: carRepairs.length > 0 ? '#166534' : '#64748b',
                    border: `1px solid ${carRepairs.length > 0 ? '#bbf7d0' : '#cbd5e1'}`
                  }}>
                    {carRepairs.length > 0 ? `${carRepairs.length} Service Orders on Record` : 'No Maintenance Records'}
                  </span>
                </div>
              </div>

              {/* RENEWAL / AUDIT TIMELINE CALLOUT (MATCHING SECTION 2 EXECUTIVE CALLOUT) */}
              <div style={{
                background: '#f8fafc', borderRadius: 8, padding: '16px 20px',
                border: '1px solid #e2e8f0', marginBottom: 18,
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16
              }}>
                {/* 1. Total Maintenance Cost */}
                <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Total Maintenance Expenditure
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {formatINR(totalRepairSpent)}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 2, color: totalRepairSpent > 0 ? '#059669' : '#64748b' }}>
                    {carRepairs.length} Total Service Order(s) Logged
                  </div>
                </div>

                {/* 2. Latest Job Order & Date */}
                <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Latest Service Order & Date
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {carRepairs.length > 0 ? `#${carRepairs[0].repairNo || 'REP-0001'}` : 'No Orders Filed'}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                    {carRepairs.length > 0 ? `Date: ${formatDate(carRepairs[0].dateOfAccident || carRepairs[0].timestamp || carRepairs[0].createdAt)}` : 'Initial Vehicle Intake'}
                  </div>
                </div>

                {/* 3. Incident & Issue Classification */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Incident & Issue Classification
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {repairMetrics.accidental} Accidental • {repairMetrics.normal} Routine
                  </div>
                  <div style={{ fontSize: 11.5, color: repairMetrics.accidental > 0 ? '#991b1b' : '#475569', marginTop: 2, fontWeight: repairMetrics.accidental > 0 ? 600 : 400 }}>
                    {repairMetrics.accidental > 0 ? 'Accidental damage records on file' : 'All standard routine maintenance'}
                  </div>
                </div>
              </div>

              {carRepairs.length > 0 ? (
                <>
                  {/* 3 STRUCTURED ATTRIBUTE TABLES (MATCHING SECTION 2'S 3-CARD GRID) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {/* Card 1: Service Facility & Job Profile */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Service Facility & Job Profile
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Registered Vehicle</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{currentCar.registrationNo || '—'}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Vehicle Make / Model</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{currentCar.carName || '—'}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Latest Job Order No.</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                              #{carRepairs[0].repairNo || 'REP-0001'}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Primary Workshop / Facility</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>
                              {carRepairs[0].garage || carRepairs[0].garageName || '—'}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Operating Custodian / Driver</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {carRepairs[0].whoTakingCar || carRepairs[0].driverName || '—'}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Current Job Status</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {carRepairs[0].repairStatus || 'Created'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Card 2: Valuation & Expenditure Schedule */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Valuation & Expenditure Schedule
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Total Maintenance Invoiced</td>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0f172a' }}>{formatINR(totalRepairSpent)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Replacement Parts Billed</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{formatINR(repairFinancials.partsTotal)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Workshop Labor Charges</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{formatINR(repairFinancials.serviceTotal)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Insurance Claim Settlement</td>
                            <td style={{ padding: '8px 12px', color: '#166534', fontWeight: 600 }}>{formatINR(repairFinancials.insuranceTotal)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Company Net Out-of-Pocket</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{formatINR(repairFinancials.netCompany)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>Latest Invoicing Status</td>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: '#059669' }}>
                              {getRepairAuditDetails(carRepairs[0], 0).costLabel || 'Settled'}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>Invoice / Bill Copy</td>
                            <td style={{ padding: '8px 12px' }}>
                              {(() => {
                                const latestAudit = getRepairAuditDetails(carRepairs[0], 0);
                                if (!latestAudit.invoiceUrl) {
                                  return <span style={{ color: '#94a3b8', fontSize: 12 }}>Pending Upload</span>;
                                }
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <button
                                      type="button"
                                      onClick={() => setPreviewInvoiceModal({
                                        url: latestAudit.invoiceUrl,
                                        repairNo: latestAudit.repairNo,
                                        garage: latestAudit.garage,
                                        cost: latestAudit.cost
                                      })}
                                      style={{
                                        width: 44, height: 44, borderRadius: 6, border: '1.5px solid #cbd5e1',
                                        overflow: 'hidden', cursor: 'pointer', background: '#f8fafc',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        padding: 0, flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                                      }}
                                      title="Click to zoom invoice copy"
                                    >
                                      <img
                                        src={getInvoiceImageSrc(latestAudit.invoiceUrl)}
                                        alt="Invoice Copy"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          if (e.target.parentNode) {
                                            e.target.parentNode.innerHTML = '<span style="font-size:10px;font-weight:700;color:#059669;">BILL</span>';
                                          }
                                        }}
                                      />
                                    </button>
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => setPreviewInvoiceModal({
                                          url: latestAudit.invoiceUrl,
                                          repairNo: latestAudit.repairNo,
                                          garage: latestAudit.garage,
                                          cost: latestAudit.cost
                                        })}
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 5,
                                          padding: '4px 10px', borderRadius: 5, fontSize: 11.5, fontWeight: 700,
                                          background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        <Eye size={12} /> View Invoice
                                      </button>
                                      <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 3 }}>
                                        Garage Bill Attached
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Card 3: Parts Servicing & Damage Scope */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Parts Servicing & Damage Scope
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Issue Classification</td>
                            <td style={{ padding: '8px 12px' }}>
                              {getRepairAuditDetails(carRepairs[0], 0).isAccidental ? (
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                                  Accident
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
                                  Normal Service
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Primary Fault / Reason</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>
                              {carRepairs[0].reasonForRepair || 'Routine maintenance'}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Insurance Claim Scope</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {getRepairAuditDetails(carRepairs[0], 0).claimNo ? `Claim #${getRepairAuditDetails(carRepairs[0], 0).claimNo}` : 'Direct Company Settlement'}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Parts Changed / Work Done</td>
                            <td style={{ padding: '8px 12px' }}>
                              {getRepairAuditDetails(carRepairs[0], 0).partsList.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {getRepairAuditDetails(carRepairs[0], 0).partsList.map((p, pi) => (
                                    <span key={pi} style={{ fontSize: 10.5, background: '#f8fafc', color: '#334155', padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontWeight: 600 }}>
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: '#64748b' }}>Under Assessment / Inspection</span>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Total Parts Cataloged</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>
                              {partsSummary.length} Unique Part Types
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* HISTORICAL MAINTENANCE TABLE (MATCHING SECTION 2 POLICY RENEWAL HISTORICAL LOG) */}
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                      Maintenance & Service Orders Historical Log
                    </div>
                    <div style={{ overflowX: 'auto', border: '1.5px solid #cbd5e1', borderRadius: 8, background: '#ffffff' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 920 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Job Order</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Service Date</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Issue Classification</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Reason / Nature of Problem</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Parts Serviced / Work Performed</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Workshop & Driver</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Invoiced (₹)</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Invoice Copy</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {carRepairs.map((rep, idx) => {
                            const audit = getRepairAuditDetails(rep, idx);

                            return (
                              <tr key={rep.repairNo || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                  #{audit.repairNo}
                                </td>
                                <td style={{ padding: '10px 14px', color: '#334155', whiteSpace: 'nowrap' }}>
                                  {formatDate(audit.date)}
                                </td>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  {audit.isAccidental ? (
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                                      Accident
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
                                      Normal Service
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px', maxWidth: 220, color: '#0f172a', fontWeight: 600 }}>
                                  <div>{audit.reason || '—'}</div>
                                  {audit.claimNo && (
                                    <div style={{ fontSize: 11, color: '#991b1b', marginTop: 2 }}>
                                      Claim #{audit.claimNo}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px', maxWidth: 220 }}>
                                  {audit.partsList.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                      {audit.partsList.map((p, pi) => (
                                        <span key={pi} style={{ fontSize: 10.5, background: '#f8fafc', color: '#334155', padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontWeight: 600 }}>
                                          {p}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px', color: '#334155', whiteSpace: 'nowrap' }}>
                                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{audit.garage}</div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>Driver: {audit.custodian}</div>
                                </td>
                                <td style={{ padding: '10px 14px', fontWeight: 800, color: audit.cost ? '#059669' : '#0f172a', whiteSpace: 'nowrap' }}>
                                  {audit.cost ? formatINR(audit.cost) : '—'}
                                </td>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  {audit.invoiceUrl ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <button
                                        type="button"
                                        onClick={() => setPreviewInvoiceModal({
                                          url: audit.invoiceUrl,
                                          repairNo: audit.repairNo,
                                          garage: audit.garage,
                                          cost: audit.cost
                                        })}
                                        style={{
                                          width: 32, height: 32, borderRadius: 5, border: '1px solid #cbd5e1',
                                          overflow: 'hidden', cursor: 'pointer', background: '#f8fafc',
                                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                          padding: 0, flexShrink: 0
                                        }}
                                        title="Click to view invoice copy"
                                      >
                                        <img
                                          src={getInvoiceImageSrc(audit.invoiceUrl)}
                                          alt="Invoice"
                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            if (e.target.parentNode) {
                                              e.target.parentNode.innerHTML = '<span style="font-size:9px;font-weight:700;color:#059669;">BILL</span>';
                                            }
                                          }}
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPreviewInvoiceModal({
                                          url: audit.invoiceUrl,
                                          repairNo: audit.repairNo,
                                          garage: audit.garage,
                                          cost: audit.cost
                                        })}
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 4,
                                          padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                                          background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        <Eye size={11} /> View
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                                    background: audit.status === 'Payment Completed' ? '#f0fdf4' : '#fef3c7',
                                    color: audit.status === 'Payment Completed' ? '#166534' : '#92400e',
                                    border: `1px solid ${audit.status === 'Payment Completed' ? '#bbf7d0' : '#fde68a'}`
                                  }}>
                                    {audit.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '20px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: 13 }}>
                  No workshop repair logs or maintenance invoices recorded for this vehicle.
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 5: ACCIDENTAL INCIDENTS & CLAIMS LOG
             ══════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'accidents') && (
            <div className="report-card print-page-break" style={{
              background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0',
              padding: '22px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div className="print-only" style={{ display: 'none', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #cbd5e1', fontSize: 11, color: '#475569' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><strong>Vehicle Report</strong> • {currentCar.carName || 'Vehicle'} ({currentCar.registrationNo || '—'})</span>
                  <span>Asset ID: <strong>{currentCar.vehicleId}</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    5. Accidental Damage & Insurance Claims Log
                  </h3>
                </div>

                <div>
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: carClaims.length > 0 ? '#fef2f2' : '#f0fdf4',
                    color: carClaims.length > 0 ? '#991b1b' : '#166534',
                    border: `1px solid ${carClaims.length > 0 ? '#fecaca' : '#bbf7d0'}`
                  }}>
                    {carClaims.length > 0 ? `${carClaims.length} Incident Records` : 'Zero Incident Records'}
                  </span>
                </div>
              </div>

              {carClaims.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: 8, color: '#475569', fontSize: 13 }}>
                  <CheckCircle size={32} color="#059669" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>Zero Accident Records on File</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {carClaims.map((claim, idx) => (
                    <div
                      key={claim.claimNo || idx}
                      style={{
                        background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0',
                        padding: '16px 18px'
                      }}
                    >
                      {/* Incident Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 10, marginBottom: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: 4 }}>
                              INCIDENT #{idx + 1}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                              Claim File: {claim.claimNo}
                            </span>
                            {claim.repairNo && (
                              <span style={{ fontSize: 12, color: '#64748b' }}>
                                (Linked Job Order: {claim.repairNo})
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                            <span><strong>Date:</strong> {formatDate(claim.dateOfAccident)}</span>
                            {claim.timeOfAccident && <span><strong>Time:</strong> {claim.timeOfAccident}</span>}
                            {claim.accidentLocation && <span><strong>Location:</strong> {claim.accidentLocation}</span>}
                          </div>
                        </div>

                        <div>
                          <span style={{
                            fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                            background: claim.claimStatus === 'Settled' ? '#f0fdf4' : '#fef3c7',
                            color: claim.claimStatus === 'Settled' ? '#166534' : '#92400e',
                            border: `1px solid ${claim.claimStatus === 'Settled' ? '#bbf7d0' : '#fde68a'}`
                          }}>
                            Status: {claim.claimFinalStatus || claim.claimStatus || 'Claim Under Process'}
                          </span>
                        </div>
                      </div>

                      {/* 3 Attribute Tables for Incident */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                        <div style={{ border: '1px solid #f1f5f9', background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                            Incident & Damage Details
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', lineHeight: 1.4 }}>
                            {claim.accidentReason || claim.reasonForRepair || 'Damage details specified in assessment report.'}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 8 }}>
                            <div>Operating Custodian: <strong>{claim.driverName || '—'}</strong></div>
                            <div>Custodian Tel: <strong>{claim.driverMobileNo || claim.driverMobile || '—'}</strong></div>
                          </div>
                        </div>

                        <div style={{ border: '1px solid #f1f5f9', background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                            Claim Financials
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                            <div>Estimated Claim Amount: <strong>{formatINR(claim.estimatedClaimAmount)}</strong></div>
                            <div>Final Approved Settlement: <strong style={{ color: '#166534' }}>{formatINR(claim.claimApprovedAmount || claim.finalApprovedClaimAmount)}</strong></div>
                            <div>Settlement Mode: <strong>{claim.claimMode || 'Cashless Garage'}</strong></div>
                          </div>
                        </div>

                        <div style={{ border: '1px solid #f1f5f9', background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                            Surveyor & Resolution
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                            <div>Assigned Surveyor: <strong>{claim.surveyorName || '—'} {claim.surveyorMobileNo ? `(${claim.surveyorMobileNo})` : ''}</strong></div>
                            <div>Actual Settlement Date: <strong>{claim.claimSettlementDate ? formatDate(claim.claimSettlementDate) : 'Under Assessment'}</strong></div>
                            {claim.settlementRefNo && <div>Payment Ref / UTR: <span style={{ fontFamily: 'monospace' }}>{claim.settlementRefNo}</span></div>}
                          </div>
                        </div>
                      </div>

                      {/* Supporting Documentation */}
                      {(claim.accidentPhotos || claim.policeReport || claim.firCopy || claim.paymentReceipt || claim.otherDocuments) && (
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b' }}>Attached Documents:</span>
                          {claim.accidentPhotos && (
                            <button
                              type="button"
                              onClick={() => openDocument(claim.accidentPhotos?.url || claim.accidentPhotos, `${claim.claimNo}_Photos`)}
                              className="btn btn-outline"
                              style={{ fontSize: 11, padding: '3px 8px', color: '#0f172a', borderColor: '#cbd5e1' }}
                            >
                              Incident Photos
                            </button>
                          )}
                          {(claim.policeReport || claim.firCopy) && (
                            <button
                              type="button"
                              onClick={() => openDocument((claim.policeReport || claim.firCopy)?.url || claim.policeReport || claim.firCopy, `${claim.claimNo}_PoliceReport`)}
                              className="btn btn-outline"
                              style={{ fontSize: 11, padding: '3px 8px', color: '#0f172a', borderColor: '#cbd5e1' }}
                            >
                              Police / FIR Filing
                            </button>
                          )}
                          {claim.otherDocuments && (
                            <button
                              type="button"
                              onClick={() => openDocument(claim.otherDocuments?.url || claim.otherDocuments, `${claim.claimNo}_SurveyDoc`)}
                              className="btn btn-outline"
                              style={{ fontSize: 11, padding: '3px 8px', color: '#0f172a', borderColor: '#cbd5e1' }}
                            >
                              Survey Report
                            </button>
                          )}
                          {claim.paymentReceipt && (
                            <button
                              type="button"
                              onClick={() => openDocument(claim.paymentReceipt?.url || claim.paymentReceipt, `${claim.claimNo}_Receipt`)}
                              className="btn btn-outline"
                              style={{ fontSize: 11, padding: '3px 8px', color: '#0f172a', borderColor: '#cbd5e1' }}
                            >
                              Settlement Receipt
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 6: FASTAG ELECTRONIC TOLL & TRANSIT PROFILE
             ══════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'fastag') && (
            <div className="report-card print-page-break" style={{
              background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0',
              padding: '22px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div className="print-only" style={{ display: 'none', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #cbd5e1', fontSize: 11, color: '#475569' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><strong>Vehicle Report</strong> • {currentCar.carName || 'Vehicle'} ({currentCar.registrationNo || '—'})</span>
                  <span>Asset ID: <strong>{currentCar.vehicleId}</strong></span>
                </div>
              </div>

              {/* Section Header with Clean Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    6. FASTag Electronic Toll & Transit Profile
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {carFastag?.documentUrl && (
                    <button
                      type="button"
                      onClick={() => openDocument(carFastag.documentUrl, `fastag_${currentCar.registrationNo || 'doc'}`)}
                      className="no-print"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                        background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1',
                        cursor: 'pointer'
                      }}
                    >
                      <FileText size={13} /> View FASTag Document
                    </button>
                  )}
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: carFastag ? (carFastag.fastagStatus === 'Active' ? '#f0fdf4' : '#fef3c7') : '#f8fafc',
                    color: carFastag ? (carFastag.fastagStatus === 'Active' ? '#166534' : '#92400e') : '#475569',
                    border: `1px solid ${carFastag ? (carFastag.fastagStatus === 'Active' ? '#bbf7d0' : '#fde68a') : '#cbd5e1'}`
                  }}>
                    {carFastag ? (carFastag.fastagStatus || 'Active') : 'No Tag Linked'}
                  </span>
                </div>
              </div>

              {/* RENEWAL / AUDIT TIMELINE CALLOUT (MATCHING EXECUTIVE CALLOUT) */}
              <div style={{
                background: '#f8fafc', borderRadius: 8, padding: '16px 20px',
                border: '1px solid #e2e8f0', marginBottom: 18,
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16
              }}>
                {/* 1. Wallet Balance */}
                <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Prepaid Wallet Balance
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {carFastag?.balance !== undefined && carFastag?.balance !== null ? formatINR(carFastag.balance) : '—'}
                  </div>
                  <div style={{
                    fontSize: 11.5, fontWeight: 700, marginTop: 2,
                    color: carFastag && Number(carFastag.balance || 0) <= Number(carFastag.lowBalanceLimit || 200) ? '#dc2626' : '#059669'
                  }}>
                    {carFastag ? (
                      Number(carFastag.balance || 0) <= Number(carFastag.lowBalanceLimit || 200)
                        ? `Low Balance Warning (Min: ${formatINR(carFastag.lowBalanceLimit || 200)})`
                        : `Sufficient Balance (Threshold: ${formatINR(carFastag.lowBalanceLimit || 200)})`
                    ) : 'No wallet account attached'}
                  </div>
                </div>

                {/* 2. Issuing Bank / NPCI */}
                <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Issuing Bank / NPCI Provider
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {carFastag?.bankName || carFastag?.issuingBank || 'Not Configured'}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                    Class: <strong>{carFastag?.vehicleClass || 'VC4 - Car / Jeep / Van'}</strong>
                  </div>
                </div>

                {/* 3. Electronic Tag ID */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Electronic RFID Tag Identifier
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 4, fontFamily: 'monospace' }}>
                    {carFastag?.tagId || 'TAG NOT LINKED'}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>
                    Wallet ID: <strong>{carFastag?.walletId || '—'}</strong>
                  </div>
                </div>
              </div>

              {carFastag ? (
                <>
                  {/* 3 STRUCTURED ATTRIBUTE TABLES */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {/* Card 1: Tag & Provider Profile */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Toll Tag & Provider Specifications
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Tag Barcode / RFID</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{carFastag.tagId || '—'}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Issuing Bank / NPCI</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{carFastag.bankName || carFastag.issuingBank || '—'}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Assigned Vehicle Class</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{carFastag.vehicleClass || 'VC4 - Car / Jeep / Van'}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Registered Vehicle</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{currentCar.registrationNo || '—'}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Account Status</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                background: carFastag.fastagStatus === 'Active' ? '#f0fdf4' : '#fef3c7',
                                color: carFastag.fastagStatus === 'Active' ? '#166534' : '#92400e',
                                border: `1px solid ${carFastag.fastagStatus === 'Active' ? '#bbf7d0' : '#fde68a'}`
                              }}>
                                {carFastag.fastagStatus || 'Active'}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Card 2: Wallet & Balance Breakdown */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Wallet & Liquidity Schedule
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Current Wallet Balance</td>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0f172a' }}>{formatINR(carFastag.balance || 0)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Low Balance Threshold</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{formatINR(carFastag.lowBalanceLimit || 200)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Prepaid Wallet ID</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#334155' }}>{carFastag.walletId || '—'}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Linked Mobile Number</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{carFastag.linkedMobile || '—'}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>Liquidity Status</td>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: Number(carFastag.balance || 0) <= Number(carFastag.lowBalanceLimit || 200) ? '#dc2626' : '#059669' }}>
                              {Number(carFastag.balance || 0) <= Number(carFastag.lowBalanceLimit || 200) ? 'Recharge Recommended' : 'Optimal Balance'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Card 3: Timeline & Compliance */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Validity & Compliance Horizon
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Activation Date</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{carFastag.activationDate ? formatDate(carFastag.activationDate) : '—'}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Tag Expiry Horizon</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{carFastag.expiryDate ? formatDate(carFastag.expiryDate) : '5-Year NPCI Standard'}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>KYC Compliance</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#059669' }}>Verified Fleet Commercial</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Special Remarks / Notes</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>{carFastag.remarks || 'Standard fleet electronic toll tag'}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Tag Slip / Barcode Copy</td>
                            <td style={{ padding: '8px 12px' }}>
                              {carFastag.documentUrl ? (
                                <button
                                  type="button"
                                  onClick={() => openDocument(carFastag.documentUrl, `fastag_${currentCar.registrationNo}`)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                                    background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Eye size={12} /> View Slip
                                </button>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '20px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: 13 }}>
                  No FASTag electronic toll record configured for this vehicle in fleet records.
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 7: TRAFFIC POLICE CHALLANS & ENFORCEMENT LOG
             ══════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'all' || activeTab === 'challans') && (
            <div className="report-card print-page-break" style={{
              background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0',
              padding: '22px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div className="print-only" style={{ display: 'none', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #cbd5e1', fontSize: 11, color: '#475569' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><strong>Vehicle Report</strong> • {currentCar.carName || 'Vehicle'} ({currentCar.registrationNo || '—'})</span>
                  <span>Asset ID: <strong>{currentCar.vehicleId}</strong></span>
                </div>
              </div>

              {/* Section Header with Clean Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    7. Traffic Police Challans & Enforcement Log
                  </h3>
                </div>

                <div>
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: challanMetrics.pendingCount > 0 ? '#fef2f2' : (carChallans.length > 0 ? '#f0fdf4' : '#f8fafc'),
                    color: challanMetrics.pendingCount > 0 ? '#991b1b' : (carChallans.length > 0 ? '#166534' : '#475569'),
                    border: `1px solid ${challanMetrics.pendingCount > 0 ? '#fecaca' : (carChallans.length > 0 ? '#bbf7d0' : '#cbd5e1')}`
                  }}>
                    {challanMetrics.pendingCount > 0
                      ? `${challanMetrics.pendingCount} Pending Violations`
                      : (carChallans.length > 0 ? 'All Challans Settled' : 'Zero Violations Logged')}
                  </span>
                </div>
              </div>

              {/* RENEWAL / AUDIT TIMELINE CALLOUT (MATCHING EXECUTIVE CALLOUT) */}
              <div style={{
                background: '#f8fafc', borderRadius: 8, padding: '16px 20px',
                border: '1px solid #e2e8f0', marginBottom: 18,
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16
              }}>
                {/* 1. Total Penalty Incurred */}
                <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Total Violations Incurred
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {formatINR(challanMetrics.totalAmount)}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                    {carChallans.length} Total Notice(s) Filed
                  </div>
                </div>

                {/* 2. Outstanding Unpaid Dues */}
                <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Outstanding Unpaid Dues
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: challanMetrics.pendingAmount > 0 ? '#dc2626' : '#0f172a', marginTop: 4 }}>
                    {formatINR(challanMetrics.pendingAmount)}
                  </div>
                  <div style={{
                    fontSize: 11.5, fontWeight: 700, marginTop: 2,
                    color: challanMetrics.pendingCount > 0 ? '#dc2626' : '#059669'
                  }}>
                    {challanMetrics.pendingCount > 0 ? `${challanMetrics.pendingCount} Pending Enforcement Notice(s)` : 'Zero Outstanding Dues'}
                  </div>
                </div>

                {/* 3. Settled vs Pending Clearance */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Settlement & Clearance Status
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {challanMetrics.paidCount} Paid • {challanMetrics.pendingCount} Pending
                  </div>
                  <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>
                    Cleared Penalties: <strong>{formatINR(challanMetrics.paidAmount)}</strong>
                  </div>
                </div>
              </div>

              {carChallans.length > 0 ? (
                <>
                  {/* 3 STRUCTURED ATTRIBUTE TABLES */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {/* Card 1: Enforcement & Vehicle Profile */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Enforcement & Notice Profile
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Registered Vehicle</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{currentCar.registrationNo || '—'}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Latest Notice No.</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                              #{carChallans[0].challanNo || 'CHL-0001'}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Notice Issue Date</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {formatDate(carChallans[0].dateOfChallan || carChallans[0].timestamp || carChallans[0].createdAt)}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Driver on Duty</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>
                              {carChallans[0].driverName || '—'}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Driver Contact</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {carChallans[0].driverMobile || '—'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Card 2: Penalty & Settlement Schedule */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Penalty & Settlement Schedule
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Total Cumulative Penalties</td>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0f172a' }}>{formatINR(challanMetrics.totalAmount)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Total Penalties Cleared</td>
                            <td style={{ padding: '8px 12px', color: '#166534', fontWeight: 600 }}>{formatINR(challanMetrics.paidAmount)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Outstanding Dues</td>
                            <td style={{ padding: '8px 12px', color: challanMetrics.pendingAmount > 0 ? '#dc2626' : '#334155', fontWeight: 700 }}>
                              {formatINR(challanMetrics.pendingAmount)}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Latest Notice Penalty</td>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0f172a' }}>
                              {formatINR(carChallans[0].challanAmount || carChallans[0].amount)}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>Latest Notice Status</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                background: (carChallans[0].paymentStatus || carChallans[0].status) === 'Paid' ? '#f0fdf4' : '#fee2e2',
                                color: (carChallans[0].paymentStatus || carChallans[0].status) === 'Paid' ? '#166534' : '#991b1b',
                                border: `1px solid ${(carChallans[0].paymentStatus || carChallans[0].status) === 'Paid' ? '#bbf7d0' : '#fca5a5'}`
                              }}>
                                {carChallans[0].paymentStatus || carChallans[0].status || 'Pending'}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Card 3: Violation Scope & Jurisdiction */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Violation Scope & Jurisdiction
                      </div>
                      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b', width: '45%' }}>Primary Offense</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>
                              {carChallans[0].reasonCategory || 'Traffic Offense'}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Violation Details</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {carChallans[0].reasonDetails || carChallans[0].remarks || 'Standard violation notice'}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Jurisdiction / Location</td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {carChallans[0].location || 'State Jurisdiction'}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Payment Transaction</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#334155' }}>
                              {carChallans[0].transactionId || '—'}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>Notice Document Copy</td>
                            <td style={{ padding: '8px 12px' }}>
                              {carChallans[0].documentUrl ? (
                                <button
                                  type="button"
                                  onClick={() => openDocument(carChallans[0].documentUrl, `challan_${carChallans[0].challanNo || 'doc'}`)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                                    background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Eye size={12} /> View Notice
                                </button>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* HISTORICAL CHALLANS TABLE */}
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                      Traffic Violations & Challans Historical Log
                    </div>
                    <div style={{ overflowX: 'auto', border: '1.5px solid #cbd5e1', borderRadius: 8, background: '#ffffff' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 860 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Notice No.</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Date</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Offense Category & Reason</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Location / City</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Driver</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Penalty (₹)</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Notice Copy</th>
                            <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {carChallans.map((ch, idx) => {
                            const isPaid = (ch.paymentStatus || ch.status) === 'Paid';
                            const amt = Number(String(ch.challanAmount || ch.amount || 0).replace(/[^0-9.-]+/g, '')) || 0;

                            return (
                              <tr key={ch.challanNo || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                  #{ch.challanNo || `CHL-${idx + 1}`}
                                </td>
                                <td style={{ padding: '10px 14px', color: '#334155', whiteSpace: 'nowrap' }}>
                                  {formatDate(ch.dateOfChallan || ch.timestamp || ch.createdAt)}
                                </td>
                                <td style={{ padding: '10px 14px', maxWidth: 220, color: '#0f172a' }}>
                                  <div style={{ fontWeight: 600 }}>{ch.reasonCategory || 'Traffic Offense'}</div>
                                  {ch.reasonDetails && (
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                      {ch.reasonDetails}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px', color: '#334155' }}>
                                  {ch.location || '—'}
                                </td>
                                <td style={{ padding: '10px 14px', color: '#334155', whiteSpace: 'nowrap' }}>
                                  <div>{ch.driverName || '—'}</div>
                                  {ch.driverMobile && <div style={{ fontSize: 11, color: '#64748b' }}>{ch.driverMobile}</div>}
                                </td>
                                <td style={{ padding: '10px 14px', fontWeight: 800, color: isPaid ? '#059669' : '#dc2626', whiteSpace: 'nowrap' }}>
                                  {formatINR(amt)}
                                </td>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  {ch.documentUrl ? (
                                    <button
                                      type="button"
                                      onClick={() => openDocument(ch.documentUrl, `challan_${ch.challanNo || 'doc'}`)}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                                        background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Eye size={11} /> View
                                    </button>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                                    background: isPaid ? '#f0fdf4' : '#fee2e2',
                                    color: isPaid ? '#166534' : '#991b1b',
                                    border: `1px solid ${isPaid ? '#bbf7d0' : '#fca5a5'}`
                                  }}>
                                    {ch.paymentStatus || ch.status || 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '20px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: 8, color: '#64748b', fontSize: 13 }}>
                  Zero traffic police notices or penalty challans logged against this vehicle.
                </div>
              )}
            </div>
          )}

          {/* ─── FORMAL AUDIT SIGN-OFF BLOCK FOR PRINT ─── */}
          <div className="print-only print-signoff" style={{ display: 'none', marginTop: 24, paddingTop: 14, borderTop: '1px solid #94a3b8' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30, textAlign: 'center', fontSize: 11 }}>
              <div>
                <div style={{ height: 35, borderBottom: '1px solid #64748b', marginBottom: 4 }} />
                <div><strong>Fleet Operations Officer</strong></div>
                <div style={{ fontSize: 9.5, color: '#64748b' }}>Inspection & Verification</div>
              </div>
              <div>
                <div style={{ height: 35, borderBottom: '1px solid #64748b', marginBottom: 4 }} />
                <div><strong>Finance & Accounts Auditor</strong></div>
                <div style={{ fontSize: 9.5, color: '#64748b' }}>Financial Ledger Reconciliation</div>
              </div>
              <div>
                <div style={{ height: 35, borderBottom: '1px solid #64748b', marginBottom: 4 }} />
                <div><strong>Executive Management Signatory</strong></div>
                <div style={{ fontSize: 9.5, color: '#64748b' }}>Approved & Certified</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── INVOICE / BILL PREVIEW MODAL ─── */}
      {previewInvoiceModal && (
        <div
          className="no-print"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setPreviewInvoiceModal(null)}
        >
          <div
            style={{
              background: '#ffffff', borderRadius: 12, maxWidth: 840, width: '100%',
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                  Garage Invoice / Maintenance Bill
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {previewInvoiceModal.repairNo && <span>Job Order: <strong>#{previewInvoiceModal.repairNo}</strong> • </span>}
                  {previewInvoiceModal.garage && <span>Workshop: <strong>{previewInvoiceModal.garage}</strong></span>}
                  {previewInvoiceModal.cost && <span> • Billed: <strong>{formatINR(previewInvoiceModal.cost)}</strong></span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => openDocument(previewInvoiceModal.url, `invoice_${previewInvoiceModal.repairNo || 'bill'}`)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1',
                    cursor: 'pointer'
                  }}
                >
                  <ExternalLink size={13} /> Open Full / New Tab
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewInvoiceModal(null)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: '#f1f5f9', color: '#475569', border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{
              padding: 20, overflowY: 'auto', display: 'flex',
              alignItems: 'center', justifyContent: 'center', background: '#0b0f19',
              minHeight: 300, maxHeight: 'calc(90vh - 100px)'
            }}>
              {previewInvoiceModal.url && (
                <img
                  src={getInvoiceImageSrc(previewInvoiceModal.url)}
                  alt="Invoice Copy"
                  style={{
                    maxWidth: '100%', maxHeight: 'calc(90vh - 140px)',
                    objectFit: 'contain', borderRadius: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const fallback = document.getElementById('modal-img-fallback');
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
              )}
              <div id="modal-img-fallback" style={{ display: 'none', textAlign: 'center', color: '#ffffff', padding: 24 }}>
                <FileText size={42} color="#10b981" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: 14, fontWeight: 700 }}>Direct Image Preview Unavailable</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, marginBottom: 14 }}>
                  The invoice document is stored as a secured or external file.
                </div>
                <button
                  type="button"
                  onClick={() => openDocument(previewInvoiceModal.url)}
                  style={{
                    padding: '8px 16px', borderRadius: 6, fontSize: 12.5, fontWeight: 700,
                    background: '#10b981', color: '#ffffff', border: 'none', cursor: 'pointer'
                  }}
                >
                  Open Invoice Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── LANDSCAPE PRINT FORMATTING ─── */}
      <style>{`
        @page {
          size: A4 landscape;
          margin: 8mm 10mm;
        }

        @media print {
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 9.5pt !important;
            line-height: 1.3 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide screen headers, navigations, sidebars and all interactive buttons */
          .no-print,
          .sidebar,
          .header,
          .mobile-menu-btn,
          button,
          .btn {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          /* Full-width container reset */
          .car-report-page,
          .main-content,
          .app-layout {
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* Header Banner in Landscape */
          .print-only:first-of-type {
            margin-bottom: 10px !important;
            padding-bottom: 8px !important;
            border-bottom: 2px solid #0f172a !important;
          }

          /* Vehicle Profile Card in Landscape */
          .vehicle-profile-card {
            border: 1.5px solid #94a3b8 !important;
            border-top: 3.5px solid #0f172a !important;
            border-radius: 8px !important;
            padding: 12px 16px !important;
            margin-bottom: 12px !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .vehicle-profile-card h2 {
            font-size: 18px !important;
            margin: 6px 0 4px !important;
          }

          /* 4 KPI cards grid row in landscape */
          .vehicle-profile-card > div:last-child {
            margin-top: 10px !important;
            padding-top: 10px !important;
            gap: 10px !important;
          }

          .vehicle-profile-card > div:last-child > div {
            padding: 8px 12px !important;
            border-radius: 6px !important;
            border: 1px solid #cbd5e1 !important;
          }

          .vehicle-profile-card > div:last-child > div > div:nth-child(2) {
            font-size: 16px !important;
            margin-top: 2px !important;
          }

          /* Break each major section to a new page */
          .print-page-break {
            page-break-before: always !important;
            break-before: page !important;
          }

          /* Report Section Cards */
          .report-card {
            box-shadow: none !important;
            border: 1.5px solid #cbd5e1 !important;
            border-radius: 8px !important;
            padding: 14px 18px !important;
            margin-bottom: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .report-card h3 {
            font-size: 14px !important;
          }

          /* Clean Landscape Tables */
          table {
            width: 100% !important;
            page-break-inside: auto !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          th, td {
            padding: 6px 9px !important;
            font-size: 8.5pt !important;
          }

          /* Formal Signoff Block */
          .print-signoff {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-top: 18px !important;
            padding-top: 12px !important;
          }

          /* Ensure high fidelity borders and background colors in PDF output */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
