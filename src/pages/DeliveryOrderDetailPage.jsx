import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations, getDateLocale, getDateLocaleOptions, translateStatus } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../lib/useAuthSession';
import { getOrderById, updateOrderStatus, updateOrderItemStatus, updateOrderItemStatusAndPrice, getUserProfile } from '../lib/database';
import { getProfileWithFallback, getProfileAvatarUrl } from '../lib/profile';

export default function DeliveryOrderDetailPage({ language }) {
  const copy = translations[language];
  const { session, loading: authLoading } = useAuthSession();
  const [profile, setProfile] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [collecting, setCollecting] = useState({});
  const [message, setMessage] = useState('');
  const [customerAvatar, setCustomerAvatar] = useState('/assets/user.svg');
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [priceDialogItem, setPriceDialogItem] = useState(null);
  const [priceInput, setPriceInput] = useState('');
  const [rejectingItem, setRejectingItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [itemToReject, setItemToReject] = useState(null);
  const [showCancellationInfo, setShowCancellationInfo] = useState(false);
  const [cancellationInfo, setCancellationInfo] = useState(null);

  // Get order ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order');

  useEffect(() => {
    async function loadData() {
      // Wait for session before proceeding
      if (!session) {
        return;
      }

      // Check for missing orderId after session is available
      if (!orderId) {
        setMessage(copy.orderNotFound);
        setLoading(false);
        return;
      }

      try {
        // Get user profile
        const profile = await getProfileWithFallback(session.user.id, session.user.email);
        setProfile(profile);

        // Get specific order
        const orderData = await getOrderById(orderId);

        if (!orderData) {
          setMessage(copy.orderNotFound);
          setLoading(false);
          return;
        }

        // Verify this order belongs to this delivery driver
        if (orderData.delivery_id !== session.user.id) {
          setMessage(copy.noPermissionViewDeliveryOrder);
          setLoading(false);
          return;
        }

        setOrder(orderData);

        // Load customer avatar
        if (orderData.customer_id) {
          try {
            const avatarUrl = await getProfileAvatarUrl(orderData.customer_id);
            setCustomerAvatar(avatarUrl);
          } catch (error) {
            console.error(copy.errorLoadingCustomerAvatar, error);
            setCustomerAvatar('/assets/user.svg');
          }
        }

        setLoading(false);
      } catch (error) {
        console.error(copy.errorLoadingData, error);
        setMessage(copy.failedToLoadOrder);
        setLoading(false);
      }
    }

    loadData();
  }, [session, orderId]);

  function toggleItemExpand(itemId) {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  async function handleUpdateStatus(newStatus) {
    setUpdating(true);
    try {
      await updateOrderStatus(order.id, newStatus);
      setMessage(copy.statusUpdated);
      
      // Refresh order
      const updatedOrder = await getOrderById(order.id);
      setOrder(updatedOrder);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.failedToUpdateStatus + ': ' + error.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleMarkCollected(itemId) {
    setCollecting(prev => ({ ...prev, [itemId]: true }));
    try {
      await updateOrderItemStatus(itemId, 'collected');
      setMessage(copy.itemCollected);
      
      // Refresh order
      const updatedOrder = await getOrderById(order.id);
      setOrder(updatedOrder);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.failedToMarkAsCollected + ': ' + error.message);
    } finally {
      setCollecting(prev => ({ ...prev, [itemId]: false }));
    }
  }

  function handleRejectItem(itemId) {
    setItemToReject(itemId);
    setShowRejectDialog(true);
  }

  async function confirmRejectItem() {
    if (!itemToReject) return;
    
    setRejectingItem(itemToReject);
    try {
      await updateOrderItemStatus(itemToReject, 'rejected');
      setMessage(copy.itemRejected);
      
      // Refresh order
      const updatedOrder = await getOrderById(order.id);
      setOrder(updatedOrder);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.failedToRejectItem + ': ' + error.message);
    } finally {
      setRejectingItem(null);
      setShowRejectDialog(false);
      setItemToReject(null);
    }
  }

  async function handleSetPrice() {
    if (!priceInput || parseFloat(priceInput) <= 0) {
      setMessage(copy.pleaseEnterValidPrice);
      return;
    }

    setUpdating(true);
    try {
      await updateOrderItemStatusAndPrice(
        priceDialogItem.itemId, 
        priceDialogItem.isEdit ? 'collected' : 'collected', 
        parseFloat(priceInput)
      );
      setMessage(copy.priceUpdated);
      setShowPriceDialog(false);
      setPriceInput('');
      setPriceDialogItem(null);
      
      // Refresh order
      const updatedOrder = await getOrderById(order.id);
      setOrder(updatedOrder);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.failedToUpdatePrice + ': ' + error.message);
    } finally {
      setUpdating(false);
    }
  }

  function getStatusLabel(status) {
    return translateStatus(status, language);
  }

  function getNextStatus() {
    if (!order || !order.status) return null;
    const statusFlow = {
      accepted: 'preparing',
      preparing: 'on_the_way',
      on_the_way: 'delivered',
    };
    return statusFlow[order.status];
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

  if (authLoading || loading) {
    return (
      <PageShell language={language}>
        <section className="Hero-card">

          <h1>{copy.loading}</h1>
        </section>
      </PageShell>
    );
  }

  if (!session) {
    window.location.href = getLocalizedPath('/', language);
    return null;
  }

  if (profile && profile.role !== 'delivery') {
    window.location.href = getLocalizedPath('/', language);
    return null;
  }

  if (!order && !loading) {
    return (
      <PageShell language={language}>
        <section className="Hero-card">

          <h1>{copy.orderNotFound}</h1>
          {message && <p className="Auth-error" style={{ marginTop: '16px' }}>{message}</p>}
          <a className="Primary-btn" href={getLocalizedPath('/available-orders', language)} style={{ marginTop: '16px' }}>
            {copy.backToOrders}
          </a>
        </section>
      </PageShell>
    );
  }

  const nextStatus = getNextStatus();

  return (
    <PageShell language={language}>
      <section className="Hero-card">

        <h1>{copy.orderDetailTitle}</h1>

        {message && <p className="Auth-message" style={{ color: message.includes('failed') || message.includes('Failed') || message.includes('enter a valid') ? 'red' : 'green' }}>{message}</p>}

        {order ? (
          <div>
            <div className="Order-card">
              <div className="Order-header">
                <h3>{order.title} #{order.id}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="Order-status" style={{ backgroundColor: getStatusColor(order.status) }}>
                    {translateStatus(order.status, language)}
                  </span>
                  {(order.status === 'cancelled' || order.status === 'rejected') && order.cancelled_by && (
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
              
              {order.description && (
                <p className="Order-description">{order.description}</p>
              )}
              
              <p className="Order-address">
                <strong>{copy.deliveryAddressLabel}:</strong> {order.delivery_address}
              </p>
              
              <p className="Order-customer">
                <strong>{copy.customerLabel}:</strong> 
                <span className="Order-customer-info">
                  <img 
                    src={customerAvatar}
                    alt={order.customer_profile.full_name}
                    className="Delivery-avatar-small"
                    onError={(e) => {
                      e.target.src = '/assets/user.svg';
                    }}
                  />
                  {order.customer_profile.full_name} ({order.customer_profile.email})
                </span>
              </p>
              
              <p className="Order-date">
                <strong>{copy.createdLabel}:</strong> {new Date(order.created_at).toLocaleString(getDateLocale(language), getDateLocaleOptions(language))}
              </p>
              
              <p className="Order-date">
                <strong>{copy.orderIdLabel}:</strong> {order.id}
              </p>

              {order.status !== 'cancelled' && order.status !== 'delivered' && (
                <div className="Order-actions">
                  {nextStatus && (
                    <button 
                      type="button"
                      className="Primary-btn"
                      onClick={() => handleUpdateStatus(nextStatus)}
                      disabled={updating}
                    >
                      {updating ? copy.loading : copy.markAsStatus.replace('{status}', getStatusLabel(nextStatus))}
                    </button>
                  )}
                </div>
              )}

              {order.order_items && order.order_items.some(item => item.status === 'collected' && item.price) && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                  border: '2px solid var(--accent-color)',
                  boxShadow: 'rgba(59, 130, 246, 0.15) 0px 4px 12px'
                }}>
                  <p style={{
                    margin: '0px',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: 'var(--accent-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>{copy.totalCollectedPrice}</span>
                    <span style={{
                      fontSize: '1.3rem',
                      fontWeight: '700',
                      background: 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(139, 92, 246) 100%)',
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
                    margin: '4px 0px 0px',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)'
                  }}>
                    {order.order_items.filter(item => item.status === 'collected' && item.price).length === 1
                      ? `1 ${copy.collectedItemPriced}`
                      : `${order.order_items.filter(item => item.status === 'collected' && item.price).length} ${copy.collectedItemsPriced}`
                    }
                  </p>
                </div>
              )}

              {order.order_items && order.order_items.length > 0 && (
                <div className="Order-items-container">
                  <h4>{copy.itemsInOrder}</h4>
                  {order.order_items.sort((a, b) => a.id - b.id).map((item) => (
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
                          disabled={updating}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'var(--text-primary)', 
                            cursor: updating ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            padding: '4px 0'
                          }}
                        >
                          <span>{expandedItems[item.id] ? '▼' : '▶'}</span>
                          <span>{item.name || copy.itemFallback}</span>
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
                            <span className="Order-item-value">{item.min_price ? `$${item.min_price}` : ''}</span>
                          </div>
                          <div className="Order-item-row">
                            <label className="Order-item-vertical-label">{copy.maxPriceLabel}</label>
                            <span className="Order-item-value">{item.max_price ? `$${item.max_price}` : ''}</span>
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
                              {item.price ? `$${item.price}` : ''}
                            </span>
                          </div>
                          <div className="Order-item-row">
                            <label className="Order-item-vertical-label">{copy.statusLabel}</label>
                            <span className="Order-item-value" style={{ 
                              color: item.status === 'collected' ? 'var(--status-delivered)' : item.status === 'rejected' ? 'var(--status-rejected)' : 'var(--status-pending)', 
                              fontWeight: 600 
                            }}>
                              {item.status ? getStatusLabel(item.status) : ''}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <span>{copy.quantityShort}: {item.quantity}</span>
                          {item.min_price && item.max_price && <span> • ${item.min_price}-${item.max_price}</span>}
                          {item.note && <span> • {item.note}</span>}
                          {item.price && <span> • {copy.priceLabel}: ${item.price}</span>}
                        </div>
                      )}
                      <div className="Order-item-row" style={{ marginTop: '12px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {item.status === 'pending' && order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'pending' && (
                            <button 
                              type="button"
                              className="Primary-btn"
                              onClick={() => handleMarkCollected(item.id)}
                              disabled={collecting[item.id] || order.status === 'cancelled' || order.status === 'delivered'}
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              {collecting[item.id] ? copy.marking : copy.statusCollected}
                            </button>
                          )}
                          {item.status === 'pending' && order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'pending' && (
                            <button 
                              type="button"
                              className="Secondary-link"
                              onClick={() => handleRejectItem(item.id)}
                              disabled={rejectingItem === item.id}
                                style={{ 
                                padding: '4px 8px', 
                                fontSize: '0.75rem',
                                border: '1px solid var(--status-cancelled)',
                                color: 'var(--status-cancelled)'
                              }}
                            >
                              {rejectingItem === item.id ? copy.rejectingItem : copy.rejectItem}
                            </button>
                          )}
                          {item.status === 'pending' && order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'pending' && (
                            <button 
                              type="button"
                              className="Secondary-link"
                              onClick={() => {
                                setPriceDialogItem({ itemId: item.id, orderId: order.id, orderStatus: order.status, isUpdate: true, isEdit: false });
                                setPriceInput('');
                                setShowPriceDialog(true);
                              }}
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '0.75rem',
                                border: '1px solid var(--success-color)',
                                color: 'var(--success-color)'
                              }}
                            >
                              {copy.addPrice}
                            </button>
                          )}
                          {item.status === 'collected' && !item.price && order.status !== 'cancelled' && order.status !== 'delivered' && (
                            <button 
                              type="button"
                              className="Secondary-link"
                              onClick={() => {
                                setPriceDialogItem({ itemId: item.id, orderId: order.id, orderStatus: order.status, isUpdate: true, isEdit: false });
                                setPriceInput('');
                                setShowPriceDialog(true);
                              }}
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '0.75rem',
                                border: '1px solid var(--accent-color)',
                                color: 'var(--accent-color)',
                                width: 'fit-content'
                              }}
                            >
                              {copy.addPrice}
                            </button>
                          )}
                          {item.price && order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'pending' && (
                            <button 
                              type="button"
                              className="Secondary-link"
                              onClick={() => {
                                setPriceDialogItem({ itemId: item.id, orderId: order.id, orderStatus: order.status, isUpdate: true, isEdit: true });
                                setPriceInput(item.price);
                                setShowPriceDialog(true);
                              }}
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '0.75rem',
                                border: '1px solid var(--status-preparing)',
                                color: 'var(--status-preparing)',
                                width: 'fit-content'
                              }}
                            >
                              {copy.editPrice}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <a className="Secondary-link" href={getLocalizedPath('/my-deliveries', language)}>
                  {copy.backToDeliveries}
                </a>
              </div>
            </div>
          </div>
        ) : (
          <p>{copy.orderNotFound}</p>
        )}

        {showPriceDialog && (
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'var(--bg-primary)',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 1000,
            minWidth: '300px'
          }}>
            <h3 style={{ color: 'var(--text-primary)' }}>
              {priceDialogItem?.isEdit ? copy.editPrice : priceDialogItem?.isUpdate ? copy.updatePrice : copy.addPrice}
            </h3>
            <input
              type="number"
              step="0.01"
              min="0"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder={copy.enterPricePlaceholder}
              style={{
                padding: '8px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                width: '100%',
                marginBottom: '12px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button"
                className="Primary-btn"
                onClick={handleSetPrice}
                disabled={updating}
              >
                {updating ? copy.saving : copy.save}
              </button>
              <button 
                type="button"
                className="Secondary-link"
                onClick={() => {
                  setShowPriceDialog(false);
                  setPriceInput('');
                  setPriceDialogItem(null);
                }}
              >
                {copy.cancel}
              </button>
            </div>
          </div>
        )}

        {showRejectDialog && (
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'var(--bg-primary)',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 1000,
            minWidth: '300px'
          }}>
            <h3 style={{ color: 'var(--text-primary)' }}>{copy.confirmRejectItem}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {copy.confirmRejectItemMessage}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button"
                className="Primary-btn"
                onClick={confirmRejectItem}
                disabled={rejectingItem}
                style={{ backgroundColor: 'var(--status-cancelled)' }}
              >
                {rejectingItem ? copy.rejectingItem : copy.rejectItem}
              </button>
              <button 
                type="button"
                className="Secondary-link"
                onClick={() => {
                  setShowRejectDialog(false);
                  setItemToReject(null);
                }}
              >
                {copy.cancel}
              </button>
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
            zIndex: 3000
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
