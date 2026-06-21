import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import Avatar from '../components/Avatar';
import TurnstileWidget from '../components/TurnstileWidget';
import { getLocalizedPath, translations, translateStatus, translateAvatarError, getDateLocale, getDateLocaleOptions } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../lib/useAuthSession';
import { getProfileWithFallback, getProfileAvatarUrl } from '../lib/profile';
import { uploadAvatar, deleteAvatar, validateAvatarFile } from '../lib/avatar';
import { 
  getCustomerOrders, 
  getCustomerDeliveryLinks,
  getAcceptedDeliveryRequests,
  getCustomerDeliveryRequests
} from '../lib/database';

export default function CustomerDashboardPage({ language }) {
  const copy = translations[language];
  const { session, loading: authLoading } = useAuthSession();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [deliveryLinks, setDeliveryLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarMessage, setAvatarMessage] = useState('');
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingFullName, setEditingFullName] = useState(false);
  const [fullNameValue, setFullNameValue] = useState('');
  const [fullNameError, setFullNameError] = useState('');
  const [deliveryAvatars, setDeliveryAvatars] = useState({});
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
        // Get user profile from database with fallback to metadata
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

        // Get customer orders
        const customerOrders = await getCustomerOrders(session.user.id);
        setOrders(customerOrders);

        // Get linked delivery users (direct links + accepted requests + pending requests)
        const links = await getCustomerDeliveryLinks(session.user.id);
        const acceptedRequests = await getAcceptedDeliveryRequests(session.user.id);
        const pendingRequests = await getCustomerDeliveryRequests(session.user.id);
        
        // Combine and deduplicate by delivery_id
        const combinedMap = new Map();
        
        links.forEach(link => {
          combinedMap.set(link.delivery_id, {
            delivery_id: link.delivery_id,
            delivery_profile: link.delivery_profile,
            status: 'linked'
          });
        });
        
        acceptedRequests.forEach(req => {
          if (!combinedMap.has(req.delivery_id)) {
            combinedMap.set(req.delivery_id, {
              delivery_id: req.delivery_id,
              delivery_profile: req.delivery_profile,
              status: 'accepted'
            });
          }
        });
        
        pendingRequests
          .filter(req => (req.status === 'pending' || req.status === 'rejected') && !combinedMap.has(req.delivery_id))
          .forEach(req => {
            combinedMap.set(req.delivery_id, {
              delivery_id: req.delivery_id,
              delivery_profile: req.delivery_profile,
              status: req.status // Use status directly: 'pending' or 'rejected'
            });
          });
        
        setDeliveryLinks(Array.from(combinedMap.values()));

        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    }

    loadData();
  }, [session]);

  // Load delivery avatars only when delivery links change
  useEffect(() => {
    async function loadDeliveryAvatars() {
      if (deliveryLinks.length === 0) return;

      const avatarMap = {};
      for (const link of deliveryLinks) {
        if (link.delivery_id && !avatarMap[link.delivery_id]) {
          try {
            const avatarUrl = await getProfileAvatarUrl(link.delivery_id);
            avatarMap[link.delivery_id] = avatarUrl;
          } catch (error) {
            avatarMap[link.delivery_id] = '/assets/user.svg';
          }
        }
      }
      setDeliveryAvatars(avatarMap);
    }

    loadDeliveryAvatars();
  }, [deliveryLinks]);

  function getStatusLabel(status) {
    return translateStatus(status, language);
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

  const activeOrders = orders.filter(o => 
    ['pending', 'accepted', 'preparing', 'on_the_way'].includes(o.status)
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

  if (!session || profile?.role !== 'customer') {
    window.location.href = getLocalizedPath('/', language);
    return null;
  }

  return (
    <PageShell language={language}>
      <section className="Hero-card Dashboard-card">

        <h1>{copy.customerDashboardTitle}</h1>
        <p className="Auth-message">{copy.welcome}, {profile.fullName}!</p>
        
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
            <span className="Dashboard-info-value">{copy.customer}</span>
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
          <a className="Primary-btn" href={getLocalizedPath('/create-order', language)}>
            {copy.createOrder}
          </a>
          <a className="Primary-btn" href={getLocalizedPath('/calculate-orders-price', language)}>
            {copy.calculateOrdersPrice}
          </a>
          <a className="Primary-btn" href={getLocalizedPath('/orders', language)}>
            {copy.myOrdersTitle}
          </a>
          <a className="Primary-btn" href={getLocalizedPath('/delivery-network', language)}>
            {copy.manageNetwork}
          </a>
        </div>

        {/* Active Orders */}
        <div className="Dashboard-section">
          <h2>{copy.activeOrders}</h2>
          {activeOrders.length === 0 ? (
            <p>{copy.noActiveOrders}</p>
          ) : (
            <>
              <div className="Orders-list">
                {activeOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="Order-card compact">
                    <div className="Order-header">
                      <h3>{order.title}</h3>
                      <span 
                        className="Order-status"
                        style={{ backgroundColor: getStatusColor(order.status) }}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <p className="Order-date">{new Date(order.created_at).toLocaleString(getDateLocale(language), getDateLocaleOptions(language))}</p>
                    <a 
                      className="Primary-btn" 
                      href={getLocalizedPath(`/order-detail?order=${order.id}`, language)}
                      style={{ fontSize: '0.85rem', padding: '6px 12px', marginTop: '8px', display: 'inline-block' }}
                    >
                      {copy.view}
                    </a>
                  </div>
                ))}
              </div>
              {activeOrders.length > 5 && (
                <a 
                  className="Secondary-link" 
                  href={getLocalizedPath('/orders', language)}
                  style={{ marginTop: '12px', display: 'inline-block' }}
                >
                  {copy.more}
                </a>
              )}
            </>
          )}
        </div>

        {/* Linked Delivery */}
        <div className="Dashboard-section">
          <h2>{copy.linkedDelivery}</h2>
          {deliveryLinks.length === 0 ? (
            <p>{copy.noLinkedDelivery}</p>
          ) : (
            <div className="Delivery-list compact">
              {deliveryLinks.map((link) => {
                const statusColor = link.status === 'pending' ? 'var(--status-pending)' : link.status === 'rejected' ? 'var(--status-rejected)' : link.status === 'accepted' ? 'var(--status-delivered)' : 'var(--status-accepted)';
                const statusText = link.status === 'pending' ? copy.statusPending : link.status === 'rejected' ? copy.statusRejected : link.status === 'accepted' ? copy.statusAccepted : copy.linked;
                const avatarUrl = deliveryAvatars[link.delivery_id] || '/assets/user.svg';
                return (
                  <div key={link.delivery_id} className="Delivery-item compact">
                    <div className="Delivery-item-avatar">
                      <Avatar 
                        src={avatarUrl} 
                        alt={link.delivery_profile.full_name} 
                        size="small"
                      />
                      <span>{link.delivery_profile.full_name} ({link.delivery_profile.email})</span>
                    </div>
                    <span className="Delivery-status" style={{ color: statusColor }}>
                      {statusText}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
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
