// components/shared/WorkflowTimeline.jsx
import { Check, Clock, Circle } from 'lucide-react';

const STEPS = [
  { key: 'Created', label: 'Repair Created', meta: 'Repair record opened' },
  { key: 'Offer Received', label: 'Offer Received', meta: 'Vendor quotation submitted' },
  { key: 'Approved', label: 'Approved', meta: 'Offer approved' },
  { key: 'Delivery Planned', label: 'Delivery Planned', meta: 'Delivery planning submitted' },
  { key: 'Vehicle Received', label: 'Vehicle Received', meta: 'Vehicle back from garage' },
  { key: 'Delivery Submitted', label: 'Delivery Submitted', meta: 'Delivery confirmed' },
  { key: 'Payment Completed', label: 'Payment Completed', meta: 'Payment settled' },
];

const ORDER = STEPS.map(s => s.key);

const WorkflowTimeline = ({ repairStatus }) => {
  const currentIdx = ORDER.indexOf(repairStatus);

  return (
    <div className="workflow-timeline">
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx || repairStatus === step.key && idx === currentIdx && idx === ORDER.length - 1;
        const active = idx === currentIdx;
        const status = done ? 'done' : active ? 'active' : 'pending';

        return (
          <div key={step.key} className={`timeline-step ${status}`}>
            <div className={`timeline-dot ${status}`}>
              {done ? <Check size={14} /> : active ? <Circle size={10} fill="currentColor" /> : null}
            </div>
            <div className="timeline-content">
              <div className="timeline-label" style={{ color: done ? '#4ade80' : active ? '#a5b4fc' : '#64748b' }}>
                {step.label}
              </div>
              <div className="timeline-meta">{step.meta}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WorkflowTimeline;
