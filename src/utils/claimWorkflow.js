// utils/claimWorkflow.js
// Workflow stages for Accident & Insurance Claims:
// Stage 1: Claim of accident (Incident Reporting & Intimation)
// Stage 2: Process of claim (Survey, Documentation & Assessment)
// Stage 3: Claim settlement (Approval, Payout & Closure)

export const isStage1Completed = (c) => {
  if (!c) return false;
  const hasActual = !!(c.actual && String(c.actual).trim() !== '' && String(c.actual).trim() !== '—');
  const hasPolicy = !!(c.policyNo && String(c.policyNo).trim() !== '');
  const hasEstAmount = !!(c.estimatedClaimAmount && Number(c.estimatedClaimAmount) > 0);
  const isSettled = c.claimStatus === 'Settled' || !!c.claimSettlementDate;
  const isStage2or3 = c.stage2Completed === true || c.stage3Completed === true;

  // If there is NO actual, NO policyNo, and NO estimated amount, and not stage2/3/settled:
  // It CANNOT be Stage 1 completed! (Handles when data is deleted/cleared in Google Sheet)
  if (!hasActual && !hasPolicy && !hasEstAmount && !isSettled && !isStage2or3) {
    return false;
  }

  // Explicit flag
  if (c.stage1Completed === true || c.stage1Completed === 'Yes' || c.stage1Completed === 'true') {
    return true;
  }
  if (c.isProcessed === true && (hasActual || hasPolicy || hasEstAmount)) {
    return true;
  }
  if (hasActual || hasPolicy || hasEstAmount || isSettled || isStage2or3) {
    return true;
  }
  return false;
};

export const isStage2Completed = (c) => {
  if (!c) return false;
  if (c.stage2Completed === true || c.stage2Completed === 'Yes' || c.stage2Completed === 'true') {
    return true;
  }
  if (c.stage3Completed === true || c.claimStatus === 'Settled') {
    return true;
  }
  if (c.surveyStatus === 'Completed' || c.claimStatus === 'Approved') {
    return true;
  }
  return false;
};

export const isStage3Completed = (c) => {
  if (!c) return false;
  if (c.stage3Completed === true || c.stage3Completed === 'Yes' || c.stage3Completed === 'true') {
    return true;
  }
  if (c.claimStatus === 'Settled' || !!c.claimSettlementDate) {
    return true;
  }
  return false;
};

export const getClaimCurrentStage = (c) => {
  if (!c) return 'incident';
  if (!isStage1Completed(c)) return 'incident';
  if (!isStage2Completed(c)) return 'process';
  if (!isStage3Completed(c)) return 'settlement';
  return 'completed';
};
