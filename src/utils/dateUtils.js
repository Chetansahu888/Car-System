// utils/dateUtils.js
import { format, addYears, subDays, subMonths, differenceInDays, parseISO, isValid } from 'date-fns';

export const createTimestamp = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
};

export const parseAnyDate = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isValid(dateStr) ? dateStr : null;
  if (typeof dateStr !== 'string') return null;
  
  // if format M/D/YYYY HH:mm:ss or M/D/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) {
    const parts = dateStr.split(' ');
    const [p1, p2, year] = parts[0].split('/').map(Number);
    // if p1 <= 12 and p2 > 12 -> month/day/year
    // if p1 > 12 -> day/month/year
    let month = p1;
    let day = p2;
    if (p1 > 12) {
      day = p1;
      month = p2;
    }
    const d = new Date(year, month - 1, day);
    if (parts[1]) {
      const [h, m, s] = parts[1].split(':').map(Number);
      if (!isNaN(h)) d.setHours(h);
      if (!isNaN(m)) d.setMinutes(m);
      if (!isNaN(s)) d.setSeconds(s);
    }
    return isValid(d) ? d : null;
  }
  
  try {
    const d = parseISO(dateStr);
    if (isValid(d)) return d;
  } catch {}
  
  const d = new Date(dateStr);
  return isValid(d) ? d : null;
};

export const formatDate = (date) => {
  if (!date) return '—';
  try {
    const d = parseAnyDate(date);
    if (!d) return date;
    return format(d, 'dd/MM/yyyy');
  } catch {
    return date;
  }
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  try {
    const d = parseAnyDate(date);
    if (!d) return date;
    return format(d, 'dd/MM/yyyy HH:mm');
  } catch {
    return date;
  }
};

export const toInputDate = (date) => {
  if (!date) return '';
  try {
    const d = parseAnyDate(date);
    if (!d) return '';
    return format(d, 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

// Insurance renewal: date + 1 year - 1 day
export const calcInsuranceRenewal = (insuranceDate) => {
  if (!insuranceDate) return null;
  try {
    const d = parseAnyDate(insuranceDate);
    if (!d) return null;
    return subDays(addYears(d, 1), 1);
  } catch {
    return null;
  }
};

// Pollution renewal: date + 1 year
export const calcPollutionRenewal = (pollutionDate) => {
  if (!pollutionDate) return null;
  try {
    const d = parseAnyDate(pollutionDate);
    if (!d) return null;
    return addYears(d, 1);
  } catch {
    return null;
  }
};

// Insurance reminder: renewal date - 7 days
export const calcInsuranceReminder = (renewalDate) => {
  if (!renewalDate) return null;
  const d = parseAnyDate(renewalDate);
  if (!d) return null;
  return subDays(d, 7);
};

// Pollution reminder: renewal date - 6 months
export const calcPollutionReminder = (pollutionRenewal) => {
  if (!pollutionRenewal) return null;
  const d = parseAnyDate(pollutionRenewal);
  if (!d) return null;
  return subMonths(d, 6);
};

export const daysUntil = (date) => {
  if (!date) return null;
  const d = parseAnyDate(date);
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return differenceInDays(target, now);
};

export const today = () => format(new Date(), 'yyyy-MM-dd');

export const calcEmiDetails = (car) => {
  if (!car) return null;

  const rawLoan = car.loanAmount ? Number(String(car.loanAmount).replace(/[^0-9.-]+/g, '')) : 0;
  const rawEmi = car.emiAmount ? Number(String(car.emiAmount).replace(/[^0-9.-]+/g, '')) : 0;
  const rawCarVal = car.valueOfCar ? Number(String(car.valueOfCar).replace(/[^0-9.-]+/g, '')) : 0;

  const loanAmount = rawLoan > 0 ? rawLoan : (rawCarVal > 0 ? rawCarVal : 0);
  const emiAmount = rawEmi > 0 ? rawEmi : 0;

  const startDate = car.emiStartDate ? parseAnyDate(car.emiStartDate) : null;
  const lastDate = car.lastEmiDate ? parseAnyDate(car.lastEmiDate) : null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let totalEmis = car.totalEmis ? Number(car.totalEmis) : 0;
  if (!totalEmis && startDate && lastDate && lastDate >= startDate) {
    const diffMonths = (lastDate.getFullYear() - startDate.getFullYear()) * 12 + (lastDate.getMonth() - startDate.getMonth()) + 1;
    totalEmis = Math.max(1, diffMonths);
  } else if (!totalEmis && loanAmount > 0 && emiAmount > 0) {
    totalEmis = Math.round(loanAmount / emiAmount);
  }

  let nextEmiDate = null;
  let isCompleted = false;

  if (lastDate && now > lastDate) {
    isCompleted = true;
  }

  const payDay = lastDate ? lastDate.getDate() : (startDate ? startDate.getDate() : 10);

  if (!isCompleted && (lastDate || startDate || emiAmount > 0)) {
    const thisMonthDue = new Date(now.getFullYear(), now.getMonth(), payDay);
    if (thisMonthDue >= now) {
      nextEmiDate = thisMonthDue;
    } else {
      nextEmiDate = new Date(now.getFullYear(), now.getMonth() + 1, payDay);
    }
    if (lastDate && nextEmiDate > lastDate) {
      nextEmiDate = lastDate;
    }
  }

  let paidEmis = car.paidEmis !== undefined && car.paidEmis !== '' ? Number(car.paidEmis) : null;
  const explicitPaid = (car.paidEmiAmount !== undefined && car.paidEmiAmount !== '')
    ? Number(String(car.paidEmiAmount).replace(/[^0-9.-]+/g, ''))
    : ((car.paidAmount !== undefined && car.paidAmount !== '') ? Number(String(car.paidAmount).replace(/[^0-9.-]+/g, '')) : null);

  if (paidEmis === null || isNaN(paidEmis)) {
    if (explicitPaid !== null && !isNaN(explicitPaid) && emiAmount > 0) {
      paidEmis = Math.round(explicitPaid / emiAmount);
    } else if (isCompleted && totalEmis > 0) {
      paidEmis = totalEmis;
    } else if (startDate && now >= startDate) {
      const elapsedMonths = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
      const passed = now.getDate() >= payDay ? 1 : 0;
      paidEmis = Math.min(totalEmis > 0 ? totalEmis : 999, Math.max(0, elapsedMonths + passed));
    } else {
      paidEmis = 0;
    }
  }

  const remainingEmis = totalEmis > 0 ? Math.max(0, totalEmis - paidEmis) : 0;
  const paidAmount = (explicitPaid !== null && !isNaN(explicitPaid) && explicitPaid >= 0)
    ? explicitPaid
    : (emiAmount > 0 ? (paidEmis * emiAmount) : (loanAmount > 0 && totalEmis > 0 ? Math.round((paidEmis / totalEmis) * loanAmount) : 0));
  const remainingAmount = loanAmount > 0 ? Math.max(0, loanAmount - paidAmount) : (emiAmount > 0 && remainingEmis > 0 ? remainingEmis * emiAmount : 0);

  let daysUntilNextEmi = null;
  let isOverdue = false;
  let isDueSoon = false;

  if (nextEmiDate) {
    daysUntilNextEmi = differenceInDays(nextEmiDate, now);
    if (daysUntilNextEmi < 0) isOverdue = true;
    if (daysUntilNextEmi >= 0 && daysUntilNextEmi <= 7) isDueSoon = true;
  }

  return {
    loanAmount,
    emiAmount,
    totalEmis,
    paidEmis,
    remainingEmis,
    paidAmount,
    remainingAmount,
    nextEmiDate,
    daysUntilNextEmi,
    isOverdue,
    isDueSoon,
    isCompleted,
    payDay,
  };
};
