import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const navButtonClass =
  "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

const pageCellClass = (active: boolean) =>
  cn(
    "inline-flex h-10 min-w-10 items-center justify-center rounded-md px-2 text-sm transition-colors",
    active
      ? "bg-secondary font-semibold text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]"
      : "text-muted-foreground hover:text-foreground",
  );

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  const visiblePages = pages.filter((page) => {
    if (page === 1 || page === totalPages) return true;
    if (page >= currentPage - 1 && page <= currentPage + 1) return true;
    return false;
  });

  return (
    <nav className="mt-4 flex items-center justify-center gap-4 sm:gap-6" aria-label="Pagination">
      <button
        type="button"
        className={navButtonClass}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4" />
        Prev
      </button>

      <span className="inline-flex items-center gap-1">
        {visiblePages.map((page, index) => (
          <React.Fragment key={page}>
            {index > 0 && page - visiblePages[index - 1] > 1 && (
              <span className="inline-flex h-10 min-w-10 items-center justify-center text-sm text-muted-foreground">
                …
              </span>
            )}
            <button
              type="button"
              className={pageCellClass(currentPage === page)}
              onClick={() => onPageChange(page)}
              aria-current={currentPage === page ? "page" : undefined}
            >
              {page}
            </button>
          </React.Fragment>
        ))}
      </span>

      <button
        type="button"
        className={navButtonClass}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
};
