import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  loading = false,
  loadingText = "Loading...",
  noOptionsText = "No options found",
  labelKey = "label",
  valueKey = "value",
  disabled = false,
  clearable = true,
  className = "",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionsListRef = useRef(null);

  const getLabel = useCallback(
    (option) =>
      typeof option === "object" && option !== null
        ? option[labelKey]
        : option,
    [labelKey],
  );

  const getValue = useCallback(
    (option) =>
      typeof option === "object" && option !== null
        ? option[valueKey]
        : option,
    [valueKey],
  );

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return options;

    return options.filter((option) =>
      String(getLabel(option) ?? "")
        .toLowerCase()
        .includes(query),
    );
  }, [options, searchQuery, getLabel]);

  const selectedOption = useMemo(
    () =>
      options.find(
        (option) =>
          String(getValue(option) ?? "") === String(value ?? ""),
      ),
    [options, value, getValue],
  );

  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(-1);

      const frame = requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });

      return () => cancelAnimationFrame(frame);
    }

    setSearchQuery("");
    setFocusedIndex(-1);

    return undefined;
  }, [isOpen]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () =>
      document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && optionsListRef.current) {
      optionsListRef.current.children[focusedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [focusedIndex, isOpen]);

  const handleSelect = useCallback(
    (selectedValue) => {
      onChange(selectedValue);
      setIsOpen(false);
      setSearchQuery("");
      setFocusedIndex(-1);
    },
    [onChange],
  );

  const handleClear = (event) => {
    event.stopPropagation();
    onChange(null);
    setSearchQuery("");
    setFocusedIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!isOpen) {
        setIsOpen(true);
      } else if (filteredOptions.length > 0) {
        setFocusedIndex((previous) =>
          previous < filteredOptions.length - 1 ? previous + 1 : 0,
        );
      }

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!isOpen) {
        setIsOpen(true);
      } else if (filteredOptions.length > 0) {
        setFocusedIndex((previous) =>
          previous > 0 ? previous - 1 : filteredOptions.length - 1,
        );
      }

      return;
    }

    if (event.key === "Enter" && isOpen) {
      event.preventDefault();

      if (
        focusedIndex >= 0 &&
        focusedIndex < filteredOptions.length
      ) {
        handleSelect(getValue(filteredOptions[focusedIndex]));
      }

      return;
    }

    if (
      (event.key === " " || event.key === "Enter") &&
      !isOpen &&
      event.target === dropdownRef.current
    ) {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  return (
    <div
      ref={dropdownRef}
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
    >
      <div
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="searchable-select-options"
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((previous) => !previous);
        }}
        className={`flex w-full select-none items-center justify-between rounded-xl border px-3 py-2.5 text-xs transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            : isOpen
              ? "border-emerald-500 bg-white shadow-sm ring-2 ring-emerald-500/20"
              : "cursor-pointer border-slate-200 bg-white text-slate-800 hover:border-slate-300"
        }`}
      >
        <span
          className={`mr-2 truncate ${
            selectedOption
              ? "font-medium text-slate-800"
              : "text-slate-400"
          }`}
        >
          {loading
            ? loadingText
            : selectedOption
              ? getLabel(selectedOption)
              : placeholder}
        </span>

        <div className="flex shrink-0 items-center gap-2 text-slate-400">
          {clearable && selectedOption && !disabled && (
            <button
              type="button"
              title="Clear selection"
              aria-label="Clear selection"
              onClick={handleClear}
              className="flex items-center justify-center rounded-full p-1 leading-none transition hover:bg-slate-100 hover:text-slate-600"
            >
              <i className="bi bi-x-lg text-[10px]" />
            </button>
          )}

          <i
            className={`bi bi-chevron-down text-xs transition-transform duration-200 ${
              isOpen ? "rotate-180 text-emerald-600" : ""
            }`}
          />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="relative border-b border-slate-100 bg-slate-50/50 p-2">
            <input
              ref={searchInputRef}
              type="search"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setFocusedIndex(-1);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && filteredOptions.length) {
                  event.preventDefault();
                  setFocusedIndex(0);
                }
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm outline-none focus:border-emerald-500"
            />

            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery("");
                  setFocusedIndex(-1);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <i className="bi bi-x-lg text-xs" />
              </button>
            )}
          </div>

          <div
            id="searchable-select-options"
            ref={optionsListRef}
            role="listbox"
            className="max-h-56 overflow-y-auto p-1"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-4 text-center text-xs text-slate-400">
                <i className="bi bi-arrow-repeat animate-spin text-sm text-emerald-600" />
                {loadingText}
              </div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const optionValue = getValue(option);
                const optionLabel = getLabel(option);

                const isSelected =
                  String(value ?? "") === String(optionValue ?? "");

                const isFocused = index === focusedIndex;

                return (
                  <div
                    key={optionValue ?? index}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(optionValue)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-xs transition-colors ${
                      isSelected
                        ? "bg-emerald-50 font-semibold text-emerald-700"
                        : isFocused
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{optionLabel}</span>

                    {isSelected && (
                      <i className="bi bi-check-lg ml-2 shrink-0 text-sm text-emerald-600" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-xs text-slate-400">
                {noOptionsText}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}