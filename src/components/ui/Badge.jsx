// components/ui/Badge.jsx
const variants = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  gray: 'badge-gray',
  purple: 'badge-purple',
};

const statusMap = {
  'Available': 'success',
  'Not Available': 'warning',
  'Expiring Soon': 'warning',
  'Approved': 'success',
  'Rejected': 'danger',
  'Pending': 'warning',
  'In Progress': 'info',
  'Completed': 'success',
  'Created': 'info',
  'Offer Received': 'purple',
  'Delivery Planned': 'info',
  'Vehicle Received': 'info',
  'Delivery Submitted': 'success',
  'Payment Pending': 'warning',
  'Payment Form Opened': 'info',
  'Payment Submitted': 'purple',
  'Payment Completed': 'success',
  'Delivery Pending': 'warning',
  'Claim Not Intimated': 'gray',
  'Claim Intimated': 'info',
  'Survey Pending': 'warning',
  'Survey Completed': 'purple',
  'Claim Under Process': 'info',
  'Settled': 'success',
};

const Badge = ({ label, variant, icon: Icon }) => {
  const v = variant || statusMap[label] || 'gray';
  return (
    <span className={`badge ${variants[v] || 'badge-gray'}`}>
      {Icon && <Icon size={10} />}
      {label}
    </span>
  );
};

export default Badge;
