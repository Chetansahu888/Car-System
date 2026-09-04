// constants/index.js

export const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'LPG'];

export const REPAIR_STATUS = {
  CREATED: 'Created',
  OFFER_RECEIVED: 'Offer Received',
  APPROVED: 'Approved',
  DELIVERY_PLANNED: 'Delivery Planned',
  VEHICLE_RECEIVED: 'Vehicle Received',
  DELIVERY_SUBMITTED: 'Delivery Submitted',
  PAYMENT_PENDING: 'Payment Pending',
  PAYMENT_COMPLETED: 'Payment Completed',
};

export const CLAIM_STATUS_STEPS = [
  'Claim Not Intimated',
  'Claim Intimated',
  'Survey Pending',
  'Survey Completed',
  'Claim Under Process',
  'Approved',
  'Settled',
];

export const PAYMENT_STATUS = {
  PENDING: 'Payment Pending',
  FORM_OPENED: 'Payment Form Opened',
  SUBMITTED: 'Payment Submitted',
  COMPLETED: 'Payment Completed',
};

export const INSURANCE_STATUS = {
  AVAILABLE: 'Available',
  NOT_AVAILABLE: 'Not Available',
  EXPIRING_SOON: 'Expiring Soon',
};

export const APPROVAL_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const DELIVERY_STATUS = {
  PENDING: 'Delivery Pending',
  SUBMITTED: 'Delivery Submitted',
};

export const SURVEY_STATUS = ['Pending', 'Scheduled', 'Completed'];

export const TYPES_OF_REPAIR = [
  'Denting',
  'Painting',
  'Mechanical',
  'Electrical',
  'Glass Replacement',
  'Tyre Replacement',
  'Engine Work',
  'AC Repair',
  'Body Work',
  'Other',
];

export const DEPARTMENTS = [
  'Sales',
  'Marketing',
  'Operations',
  'HR',
  'Finance',
  'IT',
  'Admin',
  'Management',
];

export const ITEMS_PER_PAGE = 10;
