import { useState } from 'react';

export default function FilterPanel({ 
  language, 
  copy, 
  children, 
  defaultCollapsed = true 
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className="Filter-panel">
      <button
        className="Filter-panel-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        type="button"
      >
        <span className="Filter-panel-title">
          {copy.filterSort || 'Filter & Sort'} {isCollapsed ? language === 'en' ? '▶' : '◀' : '▼'}
        </span>
        <span className="Filter-panel-count">
          ({isCollapsed ? '+' : '-'})
        </span>
      </button>
      
      {!isCollapsed && (
        <div className="Filter-panel-content">
          {children}
        </div>
      )}
    </div>
  );
}
