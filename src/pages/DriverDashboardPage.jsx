import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import Avatar from '../components/Avatar';
import TurnstileWidget from '../components/TurnstileWidget';
import { getLocalizedPath, translations, translateAvatarError } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../lib/useAuthSession';
import { getDeliveryOrders, getDeliveryIncomingRequests, getDeliveryCustomerLinks, deleteCustomerDeliveryLink, getPendingOrders } from '../lib/database';
import { showConfirmDialog } from '../components/ConfirmDialog';
import { getProfileWithFallback, getProfileAvatarUrl } from '../lib/profile';
import { uploadAvatar, deleteAvatar, validateAvatarFile } from '../lib/avatar';

export default function DriverDashboardPage({ language }) {
  const copy = translations[language];
  const { session, loading: authLoading } = useAuthSession();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);
  const [message, setMessage] = useState('');
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarMessage, setAvatarMessage] = useState('');
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingFullName, setEditingFullName] = useState(false);
  const [fullNameValue, setFullNameValue] = useState('');
  const [fullNameError, setFullNameError] = useState('');
  const [customerAvatars, setCustomerAvatars] = useState({});
  const [orderCustomerAvatars, setOrderCustomerAvatars] = useState({});
  const [availableOrderAvatars, setAvailableOrderAvatars] = useState({});
  const [showEnlargedAvatar, setShowEnlargedAvatar] = useState(false);
  const [enlargedAvatarSrc, setEnlargedAvatarSrc] = useState('');
  const [enlargedAvatarAlt, setEnlargedAvatarAlt] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileResetTrigger, setTurnstileResetTrigger] = useState(0);

  useEffect(() => {
    async function loadData() {
      if (!session) return;

      try {
        // Get user profile
        const profile = await getProfileWithFallback(session.user.id, session.user.email);
        setProfile(profile);

        // Load avatar URL
        if (profile.avatarPath) {
          try {
            const url = await getProfileAvatarUrl(session.user.id);
            setAvatarUrl(url);
          } catch (error) {
            setAvatarUrl('/assets/user.svg');
          }
        } else {
          setAvatarUrl('/assets/user.svg');
        }

        // Get delivery orders
        const deliveryOrders = await getDeliveryOrders(session.user.id);
        setOrders(deliveryOrders);

        // Get incoming requests
        const incomingRequests = await getDeliveryIncomingRequests(session.user.id);
        setRequests(incomingRequests);

        // Get available orders (pending orders)
        const pendingOrders = await getPendingOrders();
        setAvailableOrders(pendingOrders);

        // Get customer links
        const customerLinks = await getDeliveryCustomerLinks(session.user.id);
        setCustomers(customerLinks);

        setLoading(false);
        const avatarMap = {};
        for (const customer of customerLinks) {
          if (customer.customer_id) {
            try {
              const avatarUrl = await getProfileAvatarUrl(customer.customer_id);
              avatarMap[customer.customer_id] = avatarUrl;
            } catch (error) {
              avatarMap[customer.customer_id] = '/assets/user.svg';
            }
          }
        }
        setCustomerAvatars(avatarMap);

        // Load customer avatars for orders
        const orderAvatarMap = {};
        for (const order of deliveryOrders) {
          if (order.customer_id) {
            try {
              const avatarUrl = await getProfileAvatarUrl(order.customer_id);
              orderAvatarMap[order.customer_id] = avatarUrl;
            } catch (error) {
              orderAvatarMap[order.customer_id] = '/assets/user.svg';
            }
          }
        }
        setOrderCustomerAvatars(orderAvatarMap);

        // Load customer avatars for available orders
        const availableOrderAvatarMap = {};
        for (const order of pendingOrders) {
          if (order.customer_id) {
            try {
              const avatarUrl = await getProfileAvatarUrl(order.customer_id);
              availableOrderAvatarMap[order.customer_id] = avatarUrl;
            } catch (error) {
              console.error('Error loading available order customer avatar:', error);
              availableOrderAvatarMap[order.customer_id] = '/assets/user.svg';
            }
          }
        }
        setAvailableOrderAvatars(availableOrderAvatarMap);
        
        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    }

    loadData();
  }, [session]);

  async function handleAvatarUpdate() {
    if (!avatarFile) {
      setAvatarMessage(copy.pleaseSelectFile);
      return;
    }

    // Validate file
    const validation = validateAvatarFile(avatarFile);
    if (!validation.valid) {
      setAvatarMessage(translateAvatarError(validation.error, language));
      return;
    }

    setUpdatingAvatar(true);
    setAvatarMessage('');

    try {
      const publicUrl = await uploadAvatar(avatarFile);
      setAvatarUrl(publicUrl);
      setAvatarMessage(copy.avatarUpdated);
      setShowAvatarDialog(false);
      setAvatarFile(null);
    } catch (error) {
      setAvatarMessage(copy.errorAvatarUpdate + ': ' + error.message);
    } finally {
      setUpdatingAvatar(false);
    }
  }

  function handleDeleteConfirm() {
    setShowDeleteConfirm(true);
  }

  async function handleAvatarDelete() {
    try {
      await deleteAvatar();
      setAvatarUrl('/assets/user.svg');
      setAvatarMessage(copy.avatarRemoved);
      setShowAvatarDialog(false);
      setShowDeleteConfirm(false);
    } catch (error) {
      setAvatarMessage(copy.errorAvatarRemove + ': ' + error.message);
    }
  }

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      setAvatarFile(file);
      // Create preview
      const preview = URL.createObjectURL(file);
      setAvatarUrl(preview);
    }
  }

  function handleStartEditFullName() {
    setFullNameValue(profile.fullName);
    setEditingFullName(true);
    setFullNameError('');
  }

  function handleCancelEditFullName() {
    setEditingFullName(false);
    setFullNameValue('');
    setFullNameError('');
  }

  async function handleSaveFullName() {
    if (fullNameValue.length < 3) {
      setFullNameError(copy.fullNameInvalid);
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullNameValue })
        .eq('id', session.user.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, fullName: fullNameValue }));
      setEditingFullName(false);
      setFullNameValue('');
      setFullNameError('');
    } catch (error) {
      setFullNameError(copy.errorFullNameUpdate + ': ' + error.message);
    }
  }

  // Password validation requirements
  const passwordRequirements = {
    minLength: newPassword.length >= 8,
    lowercase: /[a-z]/.test(newPassword),
    uppercase: /[A-Z]/.test(newPassword),
    digit: /\d/.test(newPassword),
    symbol: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
  };

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);

  function sanitizePassword(value) {
    // Only allow: a-z, A-Z, 0-9, and common special characters
    // Remove spaces, Arabic characters, and other Unicode
    return value.replace(/[^a-zA-Z0-9!@#$%^&*(),.?":{}|<>]/g, '');
  }

  function getPasswordValidationError() {
    if (newPassword.length < 8) return copy.passwordTooShort;
    if (!isPasswordValid) return copy.passwordTooShort;
    if (newPassword !== confirmPassword) return copy.passwordMismatch;
    if (!turnstileToken) return copy.captchaVerificationFailed;
    return '';
  }

  async function handlePasswordChange() {
    const validationError = getPasswordValidationError();
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    setUpdatingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');

    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Success
      setShowPasswordDialog(false);
      setNewPassword('');
      setConfirmPassword('');
      setTurnstileToken('');
      setTurnstileResetTrigger(prev => prev + 1);
      setPasswordError('');
      setPasswordSuccess(copy.passwordUpdated);
      
      // Clear success message after 5 seconds
      setTimeout(() => setPasswordSuccess(''), 5000);
    } catch (error) {
      setPasswordError(copy.errorPasswordUpdate + ': ' + error.message);
      setTurnstileToken('');
      setTurnstileResetTrigger(prev => prev + 1);
    } finally {
      setUpdatingPassword(false);
    }
  }

  function handleCancelPasswordChange() {
    setShowPasswordDialog(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
    setTurnstileToken('');
    setTurnstileResetTrigger(prev => prev + 1);
  }

  function getStatusLabel(status) {
    const statusMap = {
      pending: copy.statusPending,
      accepted: copy.statusAccepted,
      preparing: copy.statusPreparing,
      on_the_way: copy.statusOnTheWay,
      delivered: copy.statusDelivered,
      cancelled: copy.statusCancelled,
    };
    return statusMap[status] || status;
  }

  function getStatusColor(status) {
    const colorMap = {
      pending: 'var(--status-pending)',
      accepted: 'var(--status-accepted)',
      preparing: 'var(--status-preparing)',
      on_the_way: 'var(--status-on-the-way)',
      delivered: 'var(--status-delivered)',
      cancelled: 'var(--status-cancelled)',
    };
    return colorMap[status] || 'var(--status-default)';
  }

  async function handleRemoveCustomer(customerId) {
    const confirmed = await showConfirmDialog(copy.confirmRemoveCustomerLink, language);
    if (!confirmed) return;

    setRemoving(customerId);
    try {
      await deleteCustomerDeliveryLink(customerId, session.user.id);
      setMessage(copy.customerLinkRemovedSuccess);
      
      // Refresh customers
      const customerLinks = await getDeliveryCustomerLinks(session.user.id);
      setCustomers(customerLinks);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.removeCustomerFailed + ': ' + error.message);
    } finally {
      setRemoving(null);
    }
  }

  const activeDeliveries = orders.filter(o => 
    ['accepted', 'preparing', 'on_the_way'].includes(o.status)
  );

  if (authLoading || loading) {
    return (
      <PageShell language={language}>
        <section className="Hero-card">

          <h1>{copy.loading}</h1>
        </section>
      </PageShell>
    );
  }

  if (!session || profile?.role !== 'delivery') {
    window.location.href = getLocalizedPath('/', language);
    return null;
  }

  return (
    <PageShell language={language}>
      <section className="Hero-card Dashboard-card">

        <h1>{copy.driverDashboardTitle}</h1>
        <p className="Auth-message">{copy.welcome}, {profile.fullName}!</p>

        {message && <p className="Auth-message" style={{ color: message.includes('failed') ? 'var(--error-color)' : 'var(--success-color)' }}>{message}</p>}
        {passwordSuccess && (
          <div className="Auth-message" style={{ 
            color: 'var(--status-delivered)', 
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            marginTop: '16px',
            fontWeight: '600'
          }}>
            ✓ {passwordSuccess}
          </div>
        )}

        {/* User Info */}
        <div className="Dashboard-info">
          <div className="Dashboard-avatar">
            <Avatar
              src={avatarUrl}
              alt={copy.avatarAlt}
              size="large"
              onClick={() => {
                setEnlargedAvatarSrc(avatarUrl);
                setEnlargedAvatarAlt(copy.avatarAlt);
                setShowEnlargedAvatar(true);
              }}
            />
            <button 
              type="button"
              className="Secondary-link"
              onClick={() => setShowAvatarDialog(true)}
              style={{ fontSize: '0.85rem', marginTop: '8px' }}
            >
              {copy.changeAvatar}
            </button>
          </div>

          <div className="Dashboard-info-item">
            <span className="Dashboard-info-label">{copy.fullNameLabel}:</span>
            <div className="Dashboard-info-value-group">
              {editingFullName ? (
                <div className="Dashboard-edit-group">
                  <input
                    type="text"
                    value={fullNameValue}
                    onChange={(e) => setFullNameValue(e.target.value)}
                    className="Dashboard-edit-input"
                  />
                  {fullNameError && <span className="Dashboard-error-message">{fullNameError}</span>}
                  <button 
                    type="button"
                    className="Dashboard-action-btn Dashboard-action-btn--save"
                    onClick={handleSaveFullName}
                  >
                    {copy.save}
                  </button>
                  <button 
                    type="button"
                    className="Dashboard-action-btn Dashboard-action-btn--cancel"
                    onClick={handleCancelEditFullName}
                  >
                    {copy.cancel}
                  </button>
                </div>
              ) : (
                <>
                  <span className="Dashboard-info-value">{profile.fullName}</span>
                  <button 
                    type="button"
                    className="Dashboard-edit-btn"
                    onClick={handleStartEditFullName}
                  >
                    {copy.edit}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="Dashboard-info-item">
            <span className="Dashboard-info-label">{copy.emailLabel}:</span>
            <div className="Dashboard-info-value-group">
              <span className="Dashboard-info-value">{profile.email}</span>
              <button 
                type="button"
                className="Dashboard-edit-btn"
                onClick={() => setShowPasswordDialog(true)}
              >
                {copy.changePassword}
              </button>
            </div>
          </div>
          <div className="Dashboard-info-item">
            <span className="Dashboard-info-label">{copy.accountTypeDisplayLabel}:</span>
            <span className="Dashboard-info-value">{copy.delivery}</span>
          </div>
          <div className="Dashboard-info-item">
            <button 
              type="button" 
              className="Dashboard-signout-btn" 
              onClick={() => supabase.auth.signOut()}
            >
              {copy.signOut}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="Action-row">
          <a className="Primary-btn" href={getLocalizedPath('/available-orders', language)}>
            {copy.availableOrders}
          </a>
          <a className="Primary-btn" href={getLocalizedPath('/calculate-orders-price', language)}>
            {copy.calculateOrdersPrice}
          </a>
          <a className="Primary-btn" href={getLocalizedPath('/my-deliveries', language)}>
            {copy.myDeliveriesTitle}
          </a>
          <a className="Primary-btn" href={getLocalizedPath('/delivery-requests', language)}>
            {copy.deliveryRequestsTitle}
          </a>
        </div>

        {/* Avatar Dialog */}
        {showAvatarDialog && (
          <div className="Avatar-dialog-overlay" onClick={() => setShowAvatarDialog(false)}>
            <div className="Avatar-dialog" onClick={(e) => e.stopPropagation()}>
              <h3>{copy.changeAvatar}</h3>
              
              <label className="Auth-field">
                <span>{copy.chooseFile}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={updatingAvatar}
                />
                {avatarFile && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--status-delivered)' }}>
                    {copy.selectedFile} {avatarFile.name} ({(avatarFile.size / 1024 / 1024).toFixed(2)} {copy.fileSize})
                  </p>
                )}
              </label>

              {avatarMessage && <p className="Auth-message" style={{ color: avatarMessage.includes('error') ? 'var(--error-color)' : 'var(--success-color)' }}>{avatarMessage}</p>}
              
              <div className="Action-row">
                <button 
                  type="button"
                  className="Primary-btn"
                  onClick={handleAvatarUpdate}
                  disabled={updatingAvatar}
                >
                  {updatingAvatar ? copy.loading : copy.save}
                </button>
                <button 
                  type="button"
                  className="Secondary-link"
                  onClick={() => setShowAvatarDialog(false)}
                >
                  {copy.cancel}
                </button>
                {profile?.avatarPath && (
                  <button 
                    type="button"
                    className="Secondary-link"
                    onClick={handleDeleteConfirm}
                    style={{ color: 'var(--status-cancelled)' }}
                  >
                    {copy.delete}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="Avatar-dialog-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="Avatar-dialog" onClick={(e) => e.stopPropagation()}>
              <h3>{copy.confirmDelete}</h3>
              <p>{copy.deleteConfirmMessage}</p>
              <div className="Action-row">
                <button 
                  type="button"
                  className="Primary-btn"
                  onClick={handleAvatarDelete}
                  style={{ backgroundColor: 'var(--status-cancelled)' }}
                >
                  {copy.delete}
                </button>
                <button 
                  type="button"
                  className="Secondary-link"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  {copy.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password Change Dialog */}
        {showPasswordDialog && (
          <div className="Avatar-dialog-overlay" onClick={() => handleCancelPasswordChange()}>
            <div className="Avatar-dialog" onClick={(e) => e.stopPropagation()}>
              <h3>{copy.changePassword}</h3>
              {passwordError && <p className="Auth-error">{passwordError}</p>}
              
              <div className="Auth-form">
                <label className="Auth-field">
                  <span>{copy.newPasswordLabel} <span className="Auth-field-hint">({copy.passwordMinLength})</span></span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(sanitizePassword(e.target.value))}
                    disabled={updatingPassword}
                  />
                  {newPassword.length > 0 && (
                    <div className="Password-requirements">
                      <div className={`Password-requirement ${passwordRequirements.minLength ? 'valid' : 'invalid'}`}>
                        <span className="Password-requirement-icon">
                          {passwordRequirements.minLength ? '✓' : '✗'}
                        </span>
                        {copy.passwordRequirementMinLength}
                      </div>
                      <div className={`Password-requirement ${passwordRequirements.lowercase ? 'valid' : 'invalid'}`}>
                        <span className="Password-requirement-icon">
                          {passwordRequirements.lowercase ? '✓' : '✗'}
                        </span>
                        {copy.passwordRequirementLowercase}
                      </div>
                      <div className={`Password-requirement ${passwordRequirements.uppercase ? 'valid' : 'invalid'}`}>
                        <span className="Password-requirement-icon">
                          {passwordRequirements.uppercase ? '✓' : '✗'}
                        </span>
                        {copy.passwordRequirementUppercase}
                      </div>
                      <div className={`Password-requirement ${passwordRequirements.digit ? 'valid' : 'invalid'}`}>
                        <span className="Password-requirement-icon">
                          {passwordRequirements.digit ? '✓' : '✗'}
                        </span>
                        {copy.passwordRequirementDigit}
                      </div>
                      <div className={`Password-requirement ${passwordRequirements.symbol ? 'valid' : 'invalid'}`}>
                        <span className="Password-requirement-icon">
                          {passwordRequirements.symbol ? '✓' : '✗'}
                        </span>
                        {copy.passwordRequirementSymbol}
                      </div>
                    </div>
                  )}
                </label>

                <label className="Auth-field">
                  <span>{copy.confirmNewPasswordLabel}</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(sanitizePassword(e.target.value))}
                    disabled={updatingPassword}
                  />
                </label>

                <label className="Auth-field">
                  <TurnstileWidget
                    onVerify={(token) => {
                      setTurnstileToken(token);
                      setTurnstileError(false);
                    }}
                    onError={() => {
                      setTurnstileError(true);
                      setTurnstileToken('');
                    }}
                    resetTrigger={turnstileResetTrigger}
                  />
                </label>

                <div className="Action-row">
                  <button 
                    type="button"
                    className="Primary-btn"
                    onClick={handlePasswordChange}
                    disabled={updatingPassword}
                  >
                    {updatingPassword ? copy.updatingPassword : copy.updatePassword}
                  </button>
                  <button 
                    type="button"
                    className="Secondary-link"
                    onClick={handleCancelPasswordChange}
                    disabled={updatingPassword}
                  >
                    {copy.cancel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Deliveries */}
        <div className="Dashboard-section">
          <h2>{copy.myDeliveries}</h2>
          {activeDeliveries.length === 0 ? (
            <p>{copy.noDeliveries}</p>
          ) : (
            <>
              <div className="Orders-list">
                {activeDeliveries.slice(0, 5).map((order) => {
                  const customerAvatar = orderCustomerAvatars[order.customer_id] || '/assets/user.svg';
                  return (
                    <div key={order.id} className="Order-card compact">
                      <div className="Order-header">
                        <h3>{order.title} #{order.id}</h3>
                        <span 
                          className="Order-status"
                          style={{ backgroundColor: getStatusColor(order.status) }}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      <p className="Order-customer">
                        <strong>{copy.customerLabel}:</strong>
                        <span className="Order-customer-info">
                          <Avatar
                            src={customerAvatar}
                            alt={order.customer_profile?.full_name}
                            size="small"
                          />
                          {order.customer_profile?.full_name || copy.unknown} ({order.customer_profile?.email || copy.unknown})
                        </span>
                      </p>
                      <a 
                        className="Primary-btn"
                        href={getLocalizedPath(`/delivery-order-detail?order=${order.id}`, language)}
                        style={{ marginTop: '12px', padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        {copy.view}
                      </a>
                    </div>
                  );
                })}
              </div>
              {activeDeliveries.length > 5 && (
                <button 
                  type="button"
                  className="Secondary-link"
                  onClick={() => window.location.href = getLocalizedPath('/my-deliveries', language)}
                  style={{ marginTop: '16px' }}
                >
                  {copy.more} ({activeDeliveries.length - 5})
                </button>
              )}
            </>
          )}
        </div>

        {/* Incoming Requests */}
        <div className="Dashboard-section">
          <h2>{copy.incomingRequests}</h2>
          {requests.length === 0 ? (
            <p>{copy.noPendingRequests}</p>
          ) : (
            <>
              <div className="Requests-list">
                {requests.slice(0, 5).map((request) => {
                  const customerAvatar = customerAvatars[request.customer_id] || '/assets/user.svg';
                  return (
                    <div key={request.id} className="Request-card compact">
                      <div className="Request-customer-info">
                        <Avatar
                          src={customerAvatar}
                          alt={request.customer_profile.full_name}
                          size="small"
                        />
                        <div>
                          <h3>{copy.requestFrom} {request.customer_profile.full_name}</h3>
                          <p>{request.customer_profile.email}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {requests.length > 5 && (
                <button 
                  type="button"
                  className="Secondary-link"
                  onClick={() => window.location.href = getLocalizedPath('/delivery-requests', language)}
                  style={{ marginTop: '16px' }}
                >
                  {copy.more} ({requests.length - 5})
                </button>
              )}
            </>
          )}
        </div>

        {/* Available Orders */}
        <div className="Dashboard-section">
          <h2>{copy.availableOrders}</h2>
          {availableOrders.length === 0 ? (
            <p>{copy.noAvailableOrders}</p>
          ) : (
            <>
              <div className="Orders-list">
                {availableOrders.slice(0, 5).map((order) => {
                  const customerAvatar = availableOrderAvatars[order.customer_id] || '/assets/user.svg';
                  return (
                    <div key={order.id} className="Order-card compact">
                      <div className="Order-header">
                        <h3>{order.title} #{order.id}</h3>
                        <span 
                          className="Order-status"
                          style={{ backgroundColor: getStatusColor(order.status) }}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      <p className="Order-customer">
                        <strong>{copy.customerLabel}:</strong>
                        <span className="Order-customer-info">
                          <Avatar
                            src={customerAvatar}
                            alt={order.customer_profile?.full_name}
                            size="small"
                          />
                          {order.customer_profile?.full_name || copy.unknown} ({order.customer_profile?.email || copy.unknown})
                        </span>
                      </p>
                      <a
                        className="Primary-btn"
                        href={`${getLocalizedPath('/available-orders', language)}&highlight=${order.id}`}
                        style={{ marginTop: '12px', padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        {copy.view}
                      </a>
                    </div>
                  );
                })}
              </div>
              {availableOrders.length > 5 && (
                <button 
                  type="button"
                  className="Secondary-link"
                  onClick={() => window.location.href = getLocalizedPath('/available-orders', language)}
                  style={{ marginTop: '16px' }}
                >
                  {copy.more} ({availableOrders.length - 5})
                </button>
              )}
            </>
          )}
        </div>

        {/* My Customers */}
        <div className="Dashboard-section">
          <h2>{copy.myCustomers}</h2>
          {customers.length === 0 ? (
            <p>{copy.noCustomersLinkedYet}</p>
          ) : (
            <div className="Delivery-list compact">
              {customers.map((link) => {
                const customerAvatar = customerAvatars[link.customer_id] || '/assets/user.svg';
                return (
                  <div key={link.id} className="Delivery-item compact">
                    <div className="Delivery-item-avatar">
                      <Avatar
                        src={customerAvatar}
                        alt={link.customer_profile.full_name}
                        size="small"
                      />
                      <span>{link.customer_profile.full_name} ({link.customer_profile.email})</span>
                    </div>
                    <button 
                      type="button"
                      className="Secondary-link"
                      onClick={() => handleRemoveCustomer(link.customer_id)}
                      disabled={removing === link.customer_id}
                    >
                      {removing === link.customer_id ? copy.removingDelivery : copy.removeDelivery}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Enlarged Avatar Modal */}
        {showEnlargedAvatar && (
          <div className="Avatar-dialog-overlay" onClick={() => setShowEnlargedAvatar(false)}>
            <div className="Avatar-dialog enlarged" onClick={(e) => e.stopPropagation()}>
              <img
                src={enlargedAvatarSrc}
                alt={enlargedAvatarAlt}
                style={{ width: '100%', maxWidth: '400px', height: 'auto', borderRadius: '8px' }}
              />
              <button
                type="button"
                className="Secondary-link"
                onClick={() => setShowEnlargedAvatar(false)}
                style={{ marginTop: '16px' }}
              >
                {copy.close || 'Close'}
              </button>
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}
