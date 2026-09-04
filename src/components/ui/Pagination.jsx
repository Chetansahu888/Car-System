// components/ui/Pagination.jsx
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) => {
  if (totalPages <= 1) return null;

  const from = (currentPage - 1) * itemsPerPage + 1;
  const to = Math.min(currentPage * itemsPerPage, totalItems);

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="pagination" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <span style={{ fontSize: 13, color: '#64748b' }}>
        Showing {from}–{to} of {totalItems} records
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="page-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
          <ChevronLeft size={14} />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={i} style={{ padding: '0 4px', color: '#64748b', display: 'flex', alignItems: 'center' }}>...</span>
          ) : (
            <button key={p} className={`page-btn ${currentPage === p ? 'active' : ''}`} onClick={() => onPageChange(p)}>
              {p}
            </button>
          )
        )}
        <button className="page-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
