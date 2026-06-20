"use client";

import React from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  onItemsPerPageChange?: (limit: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
}: PaginationProps) {
  if (totalPages <= 1 && !onItemsPerPageChange) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4 px-2 mt-4 border-t border-border-strong text-text-secondary font-label text-xs uppercase tracking-widest">
      <div className="flex items-center gap-2">
        {onItemsPerPageChange && itemsPerPage !== undefined && (
          <div className="flex items-center gap-2">
            <span>Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="bg-surface-container border border-border rounded px-2 py-1 outline-none focus:border-primary text-text-primary"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={1000}>All</option>
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-4">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 hover:text-primary disabled:opacity-30 disabled:hover:text-text-secondary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            Prev
          </button>
          
          <span className="text-text-primary">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 hover:text-primary disabled:opacity-30 disabled:hover:text-text-secondary transition-colors"
          >
            Next
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  );
}
