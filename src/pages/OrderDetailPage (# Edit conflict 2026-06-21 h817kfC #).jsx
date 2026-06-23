import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations, getDateLocale, getDateLocaleOptions, translateStatus } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../lib/useAuthSession';
import { getCustomerOrder, cancelOrder, deleteOrderItem, getUserProfile } from '../lib/database';
import { showConfirmDialog } from '../components/ConfirmDialog';
import { getProfileWithFallback, getProfileAvatarUrl } from '../lib/profile';

export default function OrderDetailPage({ language }) {
  const copy = translations[language];
  const { session, loading: authLoading } = useAuthSession();
  const [profile, setProfile] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [message, setMessage] = useState('');
  const [deliveryAvatar, setDeliveryAvatar] = useState('/assets/user.svg');
  const [avatarError, setAvatarError] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [showCancellationInfo, setShowCancellationInfo] = useState(false);
  const [cancellationInfo, setCancellationInfo] = useState(null);

  // Get order ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order');

  useEffect(() => {
    async function loadData() {
      if (!session || !orderId) return;

      try {
        // Get user profile
        const profile = await getProfileWithFallback(session.user.id, session.user.email);
        setProfile(profile);

        // Get specific order
        const orderData = await getCustomerOrder(session.user.id, orderId);
        setOrder(orderData);
        
        // Load delivery avatar
        if (orderData.delivery_id) {
          try {
            const avatarUrl = await getProfileAvatarUrl(orderData.delivery_id);
            setDeliveryAvatar(avatarUrl);
          } catch (error) {
            console.error('Error loading delivery avatar:', error);
            setDeliveryAvatar('/assets/user.svg');
          }
        } else {
          setDeliveryAvatar('/assets/user.svg');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setMessage(copy.failedToLoadOrder + ': ' + error.message);
        setLoading(false);
      }
    }

    loadData();
  }, [session, orderId]);

  async function handleCancelOrder() {
    setShowCancelDialog(true);
  }

  async function confirmCancelOrder() {
    setShowCancelDialog(false);
    setCancelling(true);
    try {
      await cancelOrder(order.id, cancellationReason, session.user.id);
      setMessage(copy.orderCancelledSuccess);
      
      // Refresh order
      const updatedOrder = await getCustomerOrder(session.user.id, order.id);
      setOrder(updatedOrder);
      
      // Reload delivery avatar if needed
      if (updatedOrder.delivery_id) {
        try {
          const avatarUrl = await getProfileAvatarUrl(updatedOrder.delivery_id);
          setDeliveryAvatar(avatarUrl);
        } catch (error) {
          console.error('Error reloading delivery avatar:', error);
          setDeliveryAvatar('/assets/user.svg');
        }
      }
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.failedToCancelOrder + ': ' + error.message);
    } finally {
      setCancelling(false);
    }
  }

  async function handleRetryAvatar() {
    if (!order?.delivery_id) return;
    
    try {
      const avatarUrl = await getProfileAvatarUrl(order.delivery_id);
      setDeliveryAvatar(avatarUrl);
      setAvatarError(false);
    } catch (error) {
      console.error('Error retrying avatar:', error);
      setAvatarError(true);
    }
  }

  function toggleItemExpand(itemId) {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  function handleCopyOrder() {
    if (!order) return;
    // Store order data in localStorage to pre-fill CreateOrderPage
    localStorage.setItem('copiedOrder', JSON.stringify({
      title: order.title,
      description: order.description,
      delivery_address: order.delivery_address,
      delivery_id: order.delivery_id,
      items: order.order_items || [],
    }));

    window.location.href = getLocalizedPath('/create-order', language);
  }

  async function handleShowCancellationInfo() {
    if (!order.cancelled_by) return;
    
    try {
      const userProfile = await getUserProfile(order.cancelled_by);
      setCancellationInfo({
        user: userProfile,
        cancelledAt: order.cancelled_at,
        reason: order.cancellation_reason
      });
      setShowCancellationInfo(true);
    } catch (error) {
      console.error('Error fetching cancellation info:', error);
    }
  }

  async function handleDeleteItem(itemId, itemStatus, orderStatus) {
    if (itemStatus === 'collected') {
      setMessage(copy.cannotDeleteCollectedItem);
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (orderStatus === 'cancelled' || orderStatus === 'delivered') {
      setMessage(copy.cannotDeleteItemFromOrder);
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    const confirmMessage = itemStatus === 'rejected' 
      ? copy.confirmDeleteRejectedItem 
      : copy.confirmDeleteItem;
      
    const confirmed = await showConfirmDialog(confirmMessage, language);
    if (!confirmed) return;
    
    setDeletingItem(itemId);
    try {
      await deleteOrderItem(itemId);
      setMessage(copy.itemDeletedSuccess);
      
      // Refresh order
      const updatedOrder = await getCustomerOrder(session.user.id, order.id);
      setOrder(updatedOrder);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.failedToDeleteItem + ': ' + error.message);
    } finally {
      setDeletingItem(null);
    }
  }

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

  if (!order) {
    return (
      <PageShell language={language}>
        <section className="Hero-card">

          <h1>{copy.orderNotFound}</h1>
          <a className="Primary-btn" href={getLocalizedPath('/orders', language)}>
            {copy.backToOrders}
          </a>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell language={language}>
      <section className="Hero-card">

        <h1>{copy.orderDetails}</h1>
        
        {message && <p className={`Auth-message ${message.includes('failed') ? 'Auth-message--error' : 'Auth-message--success'}`}>{message}</p>}

        <div className="Order-card" style={{ marginTop: '24px' }}>
          <div className="Order-header">
            <h3>{order.title} #{order.id}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span 
                className="Order-status"
                style={{ backgroundColor: getStatusColor(order.status) }}
              >
                {getStatusLabel(order.status)}
              </span>
              {order.status === 'cancelled' && order.cancelled_by && (
                <button
                  type="button"
                  className="Secondary-link"
                  onClick={handleShowCancellationInfo}
                  style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                >
                  {copy.more}
                </button>
              )}
            </div>
          </div>

          {/* Status Progress Indicator */}
          <div className="Order-status-progress">
            {['accepted', 'preparing', 'on_the_way', 'delivered'].map((status, index) => {
              const isCurrent = order.status === status;
              const isPast = ['accepted', 'preparing', 'on_the_way', 'delivered'].indexOf(order.status) > index;
              const statusLabels = {
                accepted: copy.statusAccepted,
                preparing: copy.statusPreparing,
                on_the_way: copy.statusOnTheWay,
                delivered: copy.statusDelivered
              };
              
              return (
                <div key={status} className={`Status-step ${isCurrent ? 'Status-step--current' : ''} ${isPast ? 'Status-step--past' : ''}`}>
                  <div className="Status-step-indicator">
                    {isPast || isCurrent ? '✓' : ''}
                  </div>
                  <div className="Status-step-label">{statusLabels[status]}</div>
                </div>
              );
            })}
          </div>
          
          {order.description && (
            <p className="Order-description">
              <strong>{copy.descriptionLabel}:</strong> {order.description}
            </p>
          )}
          
          <p className="Order-address">
            <strong>{copy.deliveryAddressLabel}:</strong> {order.delivery_address}
          </p>
          
          {order.delivery_profile && (
            <p className="Order-delivery">
              <strong>{copy.deliveryDriverLabel}:</strong> 
              <span className="Order-delivery-info">
                <img 
                  src={deliveryAvatar} 
                  alt={order.delivery_profile?.full_name || 'Driver'} 
                  className="Delivery-avatar-small"
                  onError={(e) => {
                    console.error('Avatar load error, using fallback:', e.target.src);
                    e.target.src = '/assets/user.svg';
                    setAvatarError(true);
                  }}
                  onLoad={(e) => {
                    setAvatarError(false);
                  }}
                />
                {avatarError && (
                  <button 
                    type="button"
                    onClick={handleRetryAvatar}
                    style={{ 
                      fontSize: '0.75rem', 
                      padding: '4px 8px', 
                      marginLeft: '8px',
                      background: 'var(--accent-color)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Retry
                  </button>
                )}
                {order.delivery_profile?.full_name || 'Unknown'} ({order.delivery_profile?.email || 'No email'})
              </span>
            </p>
          )}
          
          <p className="Order-date">
            <strong>{copy.createdLabel}:</strong> {new Date(order.created_at).toLocaleString(getDateLocale(language), getDateLocaleOptions(language))}
          </p>
          <p className="Order-date">
            <strong>{copy.orderIdLabel}:</strong> {order.id}
          </p>

          <div className="Order-actions" style={{ marginTop: '12px' }}>
            {order.status === 'pending' && (
              <button 
                type="button"
                className="Secondary-link"
                onClick={handleCancelOrder}
                disabled={cancelling}
              >
                {cancelling ? copy.cancellingOrder : copy.cancelOrder}
              </button>
            )}
            
            {(order.status === 'cancelled' || order.status === 'delivered') && (
              <button 
                type="button"
                className="Primary-btn"
                onClick={handleCopyOrder}
              >
                {copy.copyToNewOrder}
              </button>
            )}

            {(order.status === 'pending' || order.status === 'accepted' || order.status === 'preparing' || order.status === 'on_the_way') && (
              <button 
                type="button"
                className="Primary-btn"
                onClick={() => window.location.href = getLocalizedPath('/edit-order', language) + `&id=${order.id}`}
              >
                {copy.edit}
              </button>
            )}
          </div>

          {/* Total Price Display */}
          {order.order_items && order.order_items.length > 0 && (
            <div style={{
              marginTop: '12px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              border: '2px solid var(--accent-color)',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)'
            }}>
              <p style={{
                margin: '0',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: 'var(--accent-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>{copy.totalCollectedPrice}:</span>
                <span style={{
                  fontSize: '1.3rem',
                  fontWeight: '700',
                  background: 'var(--status-accepted-gradient)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  ${order.order_items
                    .filter(item => item.status === 'collected' && item.price)
                    .reduce((sum, item) => {
                      let priceValue = 0;
                      if (typeof item.price === 'string') {
                        priceValue = item.price.startsWith('$')
                          ? parseFloat(item.price.replace('$', ''))
                          : parseFloat(item.price);
                      } else {
                        priceValue = parseFloat(item.price);
                      }
                      return sum + (priceValue || 0);
                    }, 0)
                    .toFixed(2)}
                </span>
              </p>
              <p style={{
                margin: '4px 0 0 0',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)'
              }}>
                {order.order_items.filter(item => item.status === 'collected' && item.price).length} collected item(s) priced
              </p>
            </div>
          )}

          {order.order_items && order.order_items.length > 0 ? (
            <div className="Order-items-container">
              {order.order_items.map((item) => (
                <div 
                  key={item.id} 
                  className={`Order-item-vertical ${item.status === 'rejected' ? 'Order-item-vertical--rejected' : ''}`}
                  style={{
                    marginBottom: '10px',
                    padding: '10px',
                    ...(item.status === 'rejected' ? {
                      borderLeft: '4px solid var(--status-cancelled)',
                      backgroundColor: 'var(--status-cancelled-bg)'
                    } : {})
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <button 
                      type="button"
                      onClick={() => toggleItemExpand(item.id)}
                      disabled={cancelling}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: 'var(--text-primary)', 
                        cursor: cancelling ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        padding: '4px 0'
                      }}
                    >
                      <span>{expandedItems[item.id] ? '▼' : '▶'}</span>
                      <span>{item.name || 'Item'}</span>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: item.status === 'collected' ? 'var(--success-color)' : item.status === 'rejected' ? 'var(--status-rejected)' : 'var(--status-pending)',
                        color: 'white',
                        fontWeight: '500'
                      }}>
                        {translateStatus(item.status, language)}
                      </span>
                    </button>
                  </div>
                  
                  {expandedItems[item.id] ? (
                    <div className="Order-item-vertical">
                      <div className="Order-item-row">
                        <label className="Order-item-vertical-label">{copy.quantityLabel}</label>
                        <span className="Order-item-value">{item.quantity || ''}</span>
                      </div>
                      <div className="Order-item-row">
                        <label className="Order-item-vertical-label">{copy.minPriceLabel}</label>
                        <span className="Order-item-value">{item.min_price ? (typeof item.min_price === 'string' && item.min_price.startsWith('$') ? item.min_price : `$${item.min_price}`) : ''}</span>
                      </div>
                      <div className="Order-item-row">
                        <label className="Order-item-vertical-label">{copy.maxPriceLabel}</label>
                        <span className="Order-item-value">{item.max_price ? (typeof item.max_price === 'string' && item.max_price.startsWith('$') ? item.max_price : `$${item.max_price}`) : ''}</span>
                      </div>
                      <div className="Order-item-row">
                        <label className="Order-item-vertical-label">{copy.recommendedPlaceLabel}</label>
                        <span className="Order-item-value">{item.recommended_place || ''}</span>
                      </div>
                      <div className="Order-item-row">
                        <label className="Order-item-vertical-label">{copy.noteLabel}</label>
                        <span className="Order-item-value">{item.note || ''}</span>
                      </div>
                      <div className="Order-item-row">
                        <label className="Order-item-vertical-label">{copy.priceLabel}</label>
                        <span className="Order-item-value" style={{ fontWeight: 600 }}>
                          {item.price ? (typeof item.price === 'string' && item.price.startsWith('$') ? item.price : `$${item.price}`) : ''}
                        </span>
                      </div>
                      <div className="Order-item-row">
                        <label className="Order-item-vertical-label">{copy.statusLabel}</label>
                        <span className="Order-item-value" style={{ 
                          color: item.status === 'collected' ? 'var(--status-delivered)' : item.status === 'rejected' ? 'var(--status-rejected)' : 'var(--status-pending)', 
                          fontWeight: 600 
                        }}>
                          {item.status ? translateStatus(item.status, language) : ''}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>Qty: {item.quantity}</span>
                      {item.min_price && item.max_price && <span> • {typeof item.min_price === 'string' && item.min_price.startsWith('$') ? item.min_price : `$${item.min_price}`}-{typeof item.max_price === 'string' && item.max_price.startsWith('$') ? item.max_price : `$${item.max_price}`}</span>}
                      {item.note && <span> • {item.note}</span>}
                      {item.price && <span> • Price: {typeof item.price === 'string' && item.price.startsWith('$') ? item.price : `$${item.price}`}</span>}
                    </div>
                  )}
                  <div className="Order-item-row" style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-start' }}>
                    {item.status === 'pending' && (
                      <button 
                        type="button"
                        className="Secondary-link"
                        onClick={() => handleDeleteItem(item.id, item.status, order.status)}
                        disabled={deletingItem === item.id}
                        style={{ 
                          padding: '4px 8px', 
                          fontSize: '0.75rem',
                          border: '1px solid var(--status-cancelled)',
                          color: 'var(--status-cancelled)',
                          width: 'fit-content'
                        }}
                      >
                        {deletingItem === item.id ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>{copy.noItemsInOrder}</p>
          )}

          <div style={{ marginTop: '24px' }}>
            <a className="Secondary-link" href={getLocalizedPath('/orders', language)}>
              {copy.backToOrders}
            </a>
          </div>
        </div>

        {/* Cancellation Dialog */}
        {showCancelDialog && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }} onClick={() => setShowCancelDialog(false)}>
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              padding: '24px',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '90%',
              border: '1px solid var(--border-color)'
            }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginBottom: '16px' }}>{copy.cancelOrder}</h3>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>
                {copy.cancellationReasonLabel}
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder={copy.cancellationReasonPlaceholder}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  minHeight: '100px',
                  marginBottom: '16px',
                  resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="Secondary-link"
                  onClick={() => {
                    setShowCancelDialog(false);
                    setCancellationReason('');
                  }}
                >
                  {copy.cancel}
                </button>
                <button
                  type="button"
                  onClick={confirmCancelOrder}
                  disabled={cancelling}
                    style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--status-cancelled)',
                    color: 'white',
                    fontSize: '0.9rem',
                    cursor: cancelling ? 'not-allowed' : 'pointer',
                    opacity: cancelling ? 0.6 : 1
                  }}
                >
                  {cancelling ? copy.cancellingOrder : copy.cancelOrder}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancellation Info Dialog */}
        {showCancellationInfo && cancellationInfo && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }} onClick={() => setShowCancellationInfo(false)}>
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              padding: '24px',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '90%',
              border: '1px solid var(--border-color)'
            }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginBottom: '16px' }}>{copy.cancellationInfo}</h3>
              <div style={{ marginBottom: '12px' }}>
                <strong>{copy.cancelledBy}:</strong> {cancellationInfo.user.full_name} ({cancellationInfo.user.email})
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong>{copy.cancelledAt}:</strong> {new Date(cancellationInfo.cancelledAt).toLocaleString(getDateLocale(language), getDateLocaleOptions(language))}
              </div>
              <div style={{ marginBottom: '16px' }}>
                <strong>{copy.reason}:</strong> {cancellationInfo.reason || copy.noCancellationReason}
              </div>
              <button
                type="button"
                className="Primary-btn"
                onClick={() => setShowCancellationInfo(false)}
              >
                {copy.close}
              </button>
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}
