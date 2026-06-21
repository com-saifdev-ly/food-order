import { useState, useEffect, useRef } from 'react';

export default function MultiSelectFilter({
  label,
  options,
  selectedValues,
  setSelectedValues,
  placeholder = 'Select...',
  maxDropdownHeight = '220px',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);

  const toggleValue = (value) => {
    if (selectedValues.includes(value)) {
      setSelectedValues(selectedValues.filter((item) => item !== value));
    } else {
      setSelectedValues([...selectedValues, value]);
    }
  };

  const clearSelection = (event) => {
    event.stopPropagation();
    setSelectedValues([]);
  };

  return (
    <div className="Filter-multiselect" ref={containerRef}>
      <label className="Filter-multiselect-label">{label}</label>
      <div className="Filter-multiselect-control-wrap">
        <button
          type="button"
          className="Filter-multiselect-control"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={`Filter-multiselect-value ${selectedLabels.length === 0 ? 'Filter-multiselect-placeholder' : ''}`}>
            {selectedLabels.length === 0 ? (
              placeholder
            ) : (
              <>
                {selectedLabels.slice(0, 3).map((labelItem) => (
                  <span key={labelItem} className="Filter-multiselect-chip">
                    {labelItem}
                  </span>
                ))}
                {selectedLabels.length > 3 && (
                  <span className="Filter-multiselect-chip Filter-multiselect-chip--more">
                    +{selectedLabels.length - 3} more
                  </span>
                )}
              </>
            )}
          </span>
          <span className="Filter-multiselect-arrow">{isOpen ? '▴' : '▾'}</span>
        </button>

        {selectedValues.length > 0 && (
          <button
            type="button"
            className="Filter-multiselect-clear"
            onClick={clearSelection}
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <div className="Filter-multiselect-dropdown" role="listbox" style={{ maxHeight: maxDropdownHeight }}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`Filter-multiselect-option ${selectedValues.includes(option.value) ? 'selected' : ''}`}
              onClick={() => toggleValue(option.value)}
            >
              <span>{option.label}</span>
              <span className="Filter-multiselect-option-check">
                {selectedValues.includes(option.value) ? '✓' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
