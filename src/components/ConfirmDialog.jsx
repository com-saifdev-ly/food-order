import { useState, useEffect } from 'react';
import { translations } from '../lib/i18n';

export function showConfirmDialog(message, language = 'en') {
  return new Promise((resolve) => {
    const id = Date.now();
    const event = new CustomEvent('show-confirm-dialog', {
      detail: { id, message, language, resolve }
    });
    window.dispatchEvent(event);
  });
}

export function ConfirmDialog() {
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    function handleShowDialog(event) {
      setDialog(event.detail);
    }
    window.addEventListener('show-confirm-dialog', handleShowDialog);
    return () => window.removeEventListener('show-confirm-dialog', handleShowDialog);
  }, []);

  if (!dialog) return null;

  const { message, language, resolve } = dialog;
  const copy = translations[language];

  const handleClose = (value) => {
    setDialog(null);
    resolve(value);
  };

  return (
    <div className="Avatar-dialog-overlay" onClick={() => handleClose(false)}>
      <div className="Avatar-dialog Confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="Confirm-dialog-title">{copy.confirmDelete || 'Confirm'}</h3>
        <p className="Confirm-dialog-message">{message}</p>
        <div className="Action-row">
          <button
            type="button"
            className="Primary-btn"
            onClick={() => handleClose(true)}
            style={{ backgroundColor: 'var(--status-cancelled)' }}
          >
            {copy.delete || 'Delete'}
          </button>
          <button
            type="button"
            className="Secondary-link"
            onClick={() => handleClose(false)}
          >
            {copy.cancel || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
