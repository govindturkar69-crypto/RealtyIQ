"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  label?: string;
  disabled?: boolean;
}

export function Pagination({
  page,
  totalPages,
  onChange,
  label = "Property pagination",
  disabled = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-center gap-2 py-6">
      <Button variant="outline" size="sm" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" /> Prev
      </Button>
      <span className="text-sm text-muted-foreground" aria-live="polite">Page {page} of {totalPages}</span>
      <Button variant="outline" size="sm" disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)}>
        Next <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
