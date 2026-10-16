import React, { useEffect, useMemo, useState } from "react";
import LoadingState from "./LoadingState";

/* =========================================================
 * Helpers
 * ======================================================= */

/**
 * Retrieve a value using a string accessor or a function.
 *
 * Supports nested properties, such as "user.name".
 */
const getValue = (row, accessor) => {
  if (!accessor) {
    return undefined;
  }

  if (typeof accessor === "function") {
    return accessor(row);
  }

  return accessor.split(".").reduce(
    (acc, part) => (acc == null ? undefined : acc[part]),
    row
  );
};

/**
 * Determine the unique sorting key for a column.
 */
const getSortKey = (column) =>
  column.id ||
  (typeof column.accessor === "string"
    ? column.accessor
    : null);

/* =========================================================
 * Component
 * ======================================================= */

export default function DataTable({
  data = [],
  columns = [],
  rowsPerPageOptions = [5, 10, 25, 50],
  defaultRowsPerPage = 10,
  searchPlaceholder = "Search records...",
  emptyMessage = "No records found",
  isLoading = false,
  getRowKey = (row, index) => row.id ?? row._id ?? index,
}) {
  /* =======================================================
   * State
   * ===================================================== */

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(
    defaultRowsPerPage
  );

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  /* =======================================================
   * Filter
   * ===================================================== */

  const filteredData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return data;
    }

    return data.filter((row) =>
      columns.some((column) => {
        if (!column.accessor) {
          return false;
        }

        const value = getValue(row, column.accessor);

        return (
          value != null &&
          String(value).toLowerCase().includes(query)
        );
      })
    );
  }, [data, columns, searchQuery]);

  /* =======================================================
   * Sort
   * ===================================================== */

  const sortedData = useMemo(() => {
    if (!sortConfig.key) {
      return filteredData;
    }

    const column = columns.find(
      (item) => getSortKey(item) === sortConfig.key
    );

    if (!column) {
      return filteredData;
    }

    return [...filteredData].sort((a, b) => {
      const aValue = getValue(a, column.accessor);
      const bValue = getValue(b, column.accessor);

      // Keep empty values at the bottom in both directions.
      if (aValue == null && bValue == null) {
        return 0;
      }

      if (aValue == null) {
        return 1;
      }

      if (bValue == null) {
        return -1;
      }

      let comparison = 0;

      if (
        typeof aValue === "number" &&
        typeof bValue === "number"
      ) {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(
          String(bValue),
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          }
        );
      }

      return sortConfig.direction === "asc"
        ? comparison
        : -comparison;
    });
  }, [filteredData, columns, sortConfig]);

  /* =======================================================
   * Pagination
   * ===================================================== */

  const totalResults = sortedData.length;

  const totalPages = Math.max(
    1,
    Math.ceil(totalResults / rowsPerPage)
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const startIndex =
    (safeCurrentPage - 1) * rowsPerPage;

  const endIndex = Math.min(
    startIndex + rowsPerPage,
    totalResults
  );

  const paginatedData = useMemo(
    () =>
      sortedData.slice(
        startIndex,
        startIndex + rowsPerPage
      ),
    [sortedData, startIndex, rowsPerPage]
  );

  /* =======================================================
   * Keep Current Page Valid
   * ===================================================== */

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /* =======================================================
   * Sort Handler
   * ===================================================== */

  const handleSort = (column) => {
    if (column.sortable === false) {
      return;
    }

    const sortKey = getSortKey(column);

    if (!sortKey) {
      return;
    }

    const direction =
      sortConfig.key === sortKey &&
      sortConfig.direction === "asc"
        ? "desc"
        : "asc";

    setSortConfig({
      key: sortKey,
      direction,
    });

    setCurrentPage(1);
  };

  /* =======================================================
   * Page Handler
   * ===================================================== */

  const goToPage = (page) => {
    setCurrentPage(
      Math.min(Math.max(page, 1), totalPages)
    );
  };

  /* =======================================================
   * Render Cell
   * ===================================================== */

  const renderCell = (column, row) => {
    if (column.render) {
      return column.render(row);
    }

    const value = getValue(row, column.accessor);

    return value ?? "—";
  };

  /* =======================================================
   * Page Numbers
   * ===================================================== */

  const pageNumbers = useMemo(() => {
    const pages = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }

      return pages;
    }

    pages.push(1);

    if (safeCurrentPage > 3) {
      pages.push("...");
    }

    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(
      totalPages - 1,
      safeCurrentPage + 1
    );

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (safeCurrentPage < totalPages - 2) {
      pages.push("...");
    }

    pages.push(totalPages);

    return pages;
  }, [safeCurrentPage, totalPages]);

  /* =======================================================
   * Empty State
   * ===================================================== */

  const EmptyState = () => {
    const hasSearch = searchQuery.trim().length > 0;

    return (
      <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <i
            className="bi bi-inbox text-xl text-slate-400"
            aria-hidden="true"
          />
        </div>

        <p className="font-bold text-slate-800">
          {hasSearch
            ? "No matching records"
            : emptyMessage}
        </p>

        <p className="mt-1 max-w-sm text-xs text-slate-500">
          {hasSearch
            ? `No records matched "${searchQuery}".`
            : "There are currently no records to display."}
        </p>

        {hasSearch && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="mt-3 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 active:scale-95"
          >
            <i
              className="bi bi-x-circle mr-1.5"
              aria-hidden="true"
            />
            Clear search
          </button>
        )}
      </div>
    );
  };

  /* =======================================================
   * Main Render
   * ===================================================== */

  return (
    <div className="w-full overflow-hidden text-xs">
      {/* ===================================================
          TOOLBAR
      ================================================== */}

      <div className="flex flex-col gap-3 border-b border-slate-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Rows per page and result count */}
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <span>Show</span>

            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
              }}
              aria-label="Rows per page"
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
            >
              {rowsPerPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <span>entries</span>
          </label>

          <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 sm:inline-flex">
            {totalResults}{" "}
            {totalResults === 1 ? "result" : "results"}
          </span>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72 md:w-80">
          <i
            className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search records"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95"
            >
              <i
                className="bi bi-x-lg text-xs"
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>

      {/* Mobile result count */}
      <div className="px-3 pb-2 pt-2 sm:hidden">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>
            {totalResults}{" "}
            {totalResults === 1 ? "result" : "results"}
          </span>

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="font-semibold text-blue-600"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

      {/* ===================================================
          DESKTOP TABLE
      ================================================== */}

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-300 bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700">
              {columns.map((column, index) => {
                const sortKey = getSortKey(column);

                const sortable =
                  column.sortable !== false &&
                  !!sortKey;

                const sorted = sortConfig.key === sortKey;

                return (
                  <th
                    key={column.id || index}
                    onClick={() =>
                      sortable && handleSort(column)
                    }
                    aria-sort={
                      sorted
                        ? sortConfig.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : sortable
                          ? "none"
                          : undefined
                    }
                    className={[
                      "whitespace-nowrap px-3 py-2.5",
                      sortable
                        ? "cursor-pointer select-none hover:bg-slate-200"
                        : "",
                      column.className || "",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-1.5">
                      {sortable && (
                        <span
                          className={`flex flex-col text-[7px] leading-[7px] ${
                            sorted
                              ? "text-blue-600"
                              : "text-slate-400"
                          }`}
                          aria-hidden="true"
                        >
                          <i
                            className={`bi bi-caret-up-fill ${
                              sorted &&
                              sortConfig.direction === "asc"
                                ? "opacity-100"
                                : "opacity-30"
                            }`}
                          />

                          <i
                            className={`bi bi-caret-down-fill ${
                              sorted &&
                              sortConfig.direction === "desc"
                                ? "opacity-100"
                                : "opacity-30"
                            }`}
                          />
                        </span>
                      )}

                      <span>{column.header}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={Math.max(columns.length, 1)}>
                  <LoadingState />
                </td>
              </tr>
            ) : paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => (
                <tr
                  key={getRowKey(row, startIndex + rowIndex)}
                  className="group transition-colors hover:bg-blue-50/50"
                >
                  {columns.map((column, columnIndex) => (
                    <td
                      key={column.id || columnIndex}
                      className={`px-3 py-2.5 ${
                        column.cellClassName || ""
                      }`}
                    >
                      {renderCell(column, row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Math.max(columns.length, 1)}>
                  <EmptyState />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===================================================
          MOBILE CARDS
      ================================================== */}

      <div className="px-2 pb-2 sm:hidden">
        {isLoading ? (
          <LoadingState />
        ) : paginatedData.length > 0 ? (
          <div className="space-y-2.5">
            {paginatedData.map((row, rowIndex) => {
              const firstColumn = columns[0];

              return (
                <article
                  key={getRowKey(row, startIndex + rowIndex)}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow active:shadow"
                >
                  {/* Primary field */}
                  {firstColumn && (
                    <div className="border-b border-slate-100 bg-slate-50 px-3 py-3">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {firstColumn.header}
                      </div>

                      <div className="break-words text-sm font-bold text-slate-900">
                        {renderCell(firstColumn, row)}
                      </div>
                    </div>
                  )}

                  {/* Remaining fields */}
                  <div className="divide-y divide-slate-100">
                    {columns.slice(1).map((column, columnIndex) => (
                      <div
                        key={column.id || columnIndex}
                        className="flex min-w-0 items-start gap-3 px-3 py-2.5"
                      >
                        <div className="w-[36%] shrink-0">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            {column.header}
                          </span>
                        </div>

                        <div
                          className={`min-w-0 flex-1 break-words text-right text-xs font-medium text-slate-700 ${
                            column.cellClassName || ""
                          }`}
                        >
                          {renderCell(column, row)}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* ===================================================
          PAGINATION
      ================================================== */}

      {totalResults > 0 && (
        <div className="flex flex-col gap-3 border-t border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Result range */}
          <div className="text-center text-xs text-slate-500 sm:text-left">
            Showing{" "}
            <strong className="text-slate-800">
              {startIndex + 1}
            </strong>{" "}
            –{" "}
            <strong className="text-slate-800">
              {endIndex}
            </strong>{" "}
            of{" "}
            <strong className="text-slate-800">
              {totalResults}
            </strong>
          </div>

          {/* Pagination controls */}
          <div className="flex items-center justify-center gap-1.5">
            {/* Previous */}
            <button
              type="button"
              onClick={() => goToPage(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              aria-label="Previous page"
              className="flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i
                className="bi bi-chevron-left"
                aria-hidden="true"
              />

              <span className="ml-1 hidden md:inline">
                Previous
              </span>
            </button>

            {/* Page numbers */}
            <div className="hidden items-center gap-1 sm:flex">
              {pageNumbers.map((page, index) =>
                page === "..." ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="flex h-8 w-7 items-center justify-center text-slate-400"
                    aria-hidden="true"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => goToPage(page)}
                    aria-current={
                      safeCurrentPage === page
                        ? "page"
                        : undefined
                    }
                    aria-label={`Go to page ${page}`}
                    className={`flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-semibold transition active:scale-95 ${
                      safeCurrentPage === page
                        ? "bg-blue-600 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
            </div>

            {/* Mobile page indicator */}
            <span className="whitespace-nowrap rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600 sm:hidden">
              {safeCurrentPage} / {totalPages}
            </span>

            {/* Next */}
            <button
              type="button"
              onClick={() => goToPage(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              aria-label="Next page"
              className="flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="mr-1 hidden md:inline">
                Next
              </span>

              <i
                className="bi bi-chevron-right"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}