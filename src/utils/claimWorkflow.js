// utils/claimWorkflow.js
// Workflow stages for Accident & Insurance Claims:
// Stage 1: Claim of accident (Incident Reporting & Intimation)
// Stage 2: Process of claim (Survey, Documentation & Assessment)
// Stage 3: Claim settlement (Approval, Payout & Closure)

export const isStage1Completed = (c) => {
  if (!c) return false;
  // A claim completes Stage 1 only if explicitly submitted via Stage 1 Action form
  // or if already finalized/settled
  if (c.stage1Completed === true || c.stage1Completed === 'Yes' || c.stage1Completed === 'true') {
    return true;
  }
  if (c.stage2Completed === true || c.stage3Completed === true || c.claimStatus === 'Settled') {
    return true;
  }
  return false;
};

export const isStage2Completed = (c) => {
  if (!c) return false;
  // A claim completes Stage 2 only if explicitly submitted via Stage 2 Action form
  // or if already finalized/settled
  if (c.stage2Completed === true || c.stage2Completed === 'Yes' || c.stage2Completed === 'true') {
    return true;
  }
  if (c.stage3Completed === true || c.claimStatus === 'Settled') {
    return true;
  }
  return false;
};

export const isStage3Completed = (c) => {
  if (!c) return false;
  // A claim completes Stage 3 only if finalized/settled
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
