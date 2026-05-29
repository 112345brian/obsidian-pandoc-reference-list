import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchSelectProps {
  placeholder: string;
  defaultValue?: SelectOption;
  search: (query: string) => SelectOption[];
  onChange: (selection: SelectOption | null) => void;
  isClearable?: boolean;
}

/**
 * Minimal searchable-select component replacing react-select/AsyncSelect.
 * Uses Preact (aliased as React) with Obsidian CSS variables for theming.
 */
export function SearchSelect({
  placeholder,
  defaultValue,
  search,
  onChange,
  isClearable,
}: SearchSelectProps) {
  const [inputVal, setInputVal] = React.useState(defaultValue?.label ?? '');
  const [options, setOptions] = React.useState<SelectOption[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<SelectOption | null>(
    defaultValue ?? null
  );
  const dbRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputVal(val);
    if (dbRef.current) clearTimeout(dbRef.current);
    if (val.length >= 1) {
      dbRef.current = setTimeout(() => {
        const results = search(val).slice(0, 20);
        setOptions(results);
        setIsOpen(results.length > 0);
      }, 150);
    } else {
      setOptions([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (opt: SelectOption) => {
    setSelected(opt);
    setInputVal(opt.label);
    setOptions([]);
    setIsOpen(false);
    onChange(opt);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(null);
    setInputVal('');
    setOptions([]);
    setIsOpen(false);
    onChange(null);
  };

  return (
    <div className="pwc-search-select">
      <div className="pwc-search-select__control">
        <input
          type="text"
          className="pwc-search-select__input"
          value={inputVal}
          placeholder={placeholder}
          onChange={handleInput}
          onFocus={() => {
            if (options.length) setIsOpen(true);
          }}
          onBlur={() => {
            // Delay close so onMouseDown on an option fires first
            setTimeout(() => setIsOpen(false), 200);
          }}
        />
        {isClearable && selected && (
          <button
            className="pwc-search-select__clear clickable-icon"
            onMouseDown={handleClear}
            aria-label="Clear"
          >
            ×
          </button>
        )}
      </div>
      {isOpen && (
        <div className="pwc-search-select__menu">
          {options.map((opt) => (
            <div
              key={opt.value}
              className="pwc-search-select__option"
              onMouseDown={() => handleSelect(opt)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
