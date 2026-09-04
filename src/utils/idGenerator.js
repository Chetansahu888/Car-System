// utils/idGenerator.js

const pad = (n, len = 4) => String(n).padStart(len, '0');

export const generateVehicleId = (existingCars = []) => {
  const maxId = existingCars.reduce((max, car) => {
    const num = parseInt((car.vehicleId || '').replace('CAR-', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `CAR-${pad(maxId + 1)}`;
};

export const generateRepairNo = (existingRepairs = []) => {
  const maxId = existingRepairs.reduce((max, r) => {
    const num = parseInt((r.repairNo || '').replace('REP-', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `REP-${pad(maxId + 1)}`;
};

export const generateClaimNo = (existingClaims = []) => {
  const maxId = existingClaims.reduce((max, c) => {
    const num = parseInt((c.claimNo || '').replace('CLM-', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `CLM-${pad(maxId + 1)}`;
};

export const generateId = () => `id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
