import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations, getDateLocale, getDateLocaleOptions } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../lib/useAuthSession';
import { getPendingOrders, acceptOrder, cancelOrder, getUserProfile } from '../lib/database';
import { getProfileWithFallback, getProfileAvatarUrl } from '../lib/profile';

export default function AvailableOrdersPage({ language }) {
  const copy = translations[language];
  const { session, loading: authLoading } = useAuthSession();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({ orderId: null, action: null });
  const [message, setMessage] = useState('');
  const [highlightOrderId, setHighlightOrderId] = useState(null);
  const [customerAvatars, setCustomerAvatars] = useState({});
  const [expandedItems, setExpandedItems] = useState({});
  const [expandedOrders, setExpandedOrders] = useState({});
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [showCancellationInfo, setShowCancellationInfo] = useState(false);
  const [cancellationInfo, setCancellationInfo] = useState(null);

  useEffect(() => {
    // Get highlight parameter from URL
    const urlParams = new URLSearchParams(window.location.search);
    const highlight = urlParams.get('highlight');
    if (highlight) {
      setHighlightOrderId(highlight);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!session) return;

      try {
        // Get user profile
        const profile = await getProfileWithFallback(session.user.id, session.user.email);
        setProfile(profile);

        // Get pending orders
        const pendingOrders = await getPendingOrders();
        setOrders(pendingOrders);

        // Load customer avatars
        const avatarMap = {};
        for (const order of pendingOrders) {
          if (order.customer_id) {
            try {
              const avatarUrl = await getProfileAvatarUrl(order.customer_id);
              avatarMap[order.customer_id] = avatarUrl;
            } catch (error) {
              console.error('Error loading customer avatar:', error);
              avatarMap[order.customer_id] = '/assets/user.svg';
            }
          }
        }
        setCustomerAvatars(avatarMap);
        
        setLoading(false);

        // Scroll to highlighted order if set
        if (highlightOrderId) {
          setTimeout(() => {
            const element = document.querySelector(`[data-order-id="${highlightOrderId}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 300);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    }

    loadData();
  }, [session]);

  async function handleAcceptOrder(orderId) {
    setProcessing({ orderId, action: 'accept' });
    try {
      await acceptOrder(orderId, session.user.id);
      setMessage(copy.successOrderAccepted);
      
      // Refresh orders
      const updatedOrders = await getPendingOrders();
      setOrders(updatedOrders);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.errorOrderAccepted + ': ' + error.message);
    } finally {
      setProcessing({ orderId: null, action: null });
    }
  }

  async function handleRejectOrder(orderId) {
    setRejectOrderId(orderId);
    setShowRejectDialog(true);
  }

  async function confirmRejectOrder() {
    setShowRejectDialog(false);
    setProcessing({ orderId: rejectOrderId, action: 'reject' });
    try {
      await cancelOrder(rejectOrderId, cancellationReason, session.user.id);
      setMessage(copy.successOrderRejected);
      setCancellationReason('');
      
      // Refresh orders
      const updatedOrders = await getPendingOrders();
      setOrders(updatedOrders);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.errorOrderRejected + ': ' + error.message);
    } finally {
      setProcessing({ orderId: null, action: null });
      setRejectOrderId(null);
    }
  }

  async function handleShowCancellationInfo(order) {
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

  function toggleExpand(itemId) {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  function toggleExpandOrder(orderId) {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
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

  if (!session || profile?.role !== 'delivery') {
    window.location.href = getLocalizedPath('/', language);
    return null;
  }

  return (
    <PageShell language={language}>
      <section className="Hero-card">

        <h1>{copy.availableOrdersTitle}</h1>
        <p className="Auth-message">{copy.welcome}, {profile.fullName}!</p>

        {message && <p className="Auth-message" style={{ color: message.includes('failed') ? 'red' : 'green' }}>{message}</p>}

        {orders.length === 0 ? (
          <div className="Auth-message">
            <p>{copy.noAvailableOrders}</p>
          </div>
        ) : (
          <div className="Orders-list">
            {orders.map((order) => {
              const isHighlighted = highlightOrderId === order.id;
              const customerAvatar = customerAvatars[order.customer_id] || '/assets/user.svg';
              return (
                <div 
                  key={order.id} 
                  className={`Order-card ${isHighlighted ? 'Order-card--highlighted' : ''}`}
                  data-order-id={order.id}
                  style={isHighlighted ? { 
                    borderColor: 'var(--accent-color)',
                    borderWidth: '3px',
                    boxShadow: '0 0 20px rgba(249, 115, 22, 0.3)'
                  } : {}}
                >
                  <div className="Order-header">
                    <h3>{order.title}</h3>
                    <span className="Order-status" style={{ backgroundColor: 'var(--status-pending)' }}>
                      {copy.statusPending}
                    </span>
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

                  {order.order_items && order.order_items.length > 0 && (
                    <div className="Order-items-container">
                      <button 
                        type="button" 
                        className="Secondary-link"
                        onClick={() => toggleExpandOrder(order.id)}
                        style={{ fontSize: '0.85rem', marginBottom: '12px' }}
                      >
                        {expandedOrders[order.id] ? `▼ ${copy.hideItems}` : `▶ ${copy.showItems}`} ({order.order_items.length})
                      </button>
                      {expandedOrders[order.id] && (
                        <>
                      {order.order_items.map((item) => (
                        <div 
                          key={item.id} 
                          className={`Order-item-vertical ${item.status === 'rejected' ? 'Order-item-vertical--rejected' : ''}`}
                          style={{
                            marginBottom: '10px',
                            padding: '10px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <button 
                              type="button"
                              onClick={() => toggleExpand(item.id)}
                              disabled={processing === order.id}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--text-primary)', 
                                cursor: processing === order.id ? 'not-allowed' : 'pointer',
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
                            </div>
                          ) : (
                            <div style={{ padding: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              <span>{copy.quantityShort}: {item.quantity}</span>
                              {item.min_price && item.max_price && <span> • $${item.min_price}-${item.max_price}</span>}
                              {item.note && <span> • {item.note}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                        </>
                      )}
                    </div>
                  )}

                  <div className="Order-actions">
                    <button 
                      type="button"
                      className="Primary-btn"
                      onClick={() => handleAcceptOrder(order.id)}
                      disabled={processing.orderId === order.id}
                    >
                      {processing.orderId === order.id && processing.action === 'accept' ? copy.acceptingOrder : copy.acceptOrder}
                    </button>
                    <button 
                      type="button"
                      className="Secondary-link"
                      onClick={() => handleRejectOrder(order.id)}
                      disabled={processing.orderId === order.id}
                    >
                      {processing.orderId === order.id && processing.action === 'reject' ? copy.rejectingOrder : copy.rejectOrder}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="Action-row">
          <a className="Primary-btn" href={getLocalizedPath('/driver-dashboard', language)}>
            {copy.driverDashboardTitle}
          </a>
          <a className="Secondary-link" href={getLocalizedPath('/my-deliveries', language)}>
            {copy.myDeliveriesTitle}
          </a>
        </div>

        {/* Rejection/Cancellation Dialog */}
        {showRejectDialog && (
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
          }} onClick={() => setShowRejectDialog(false)}>
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              padding: '24px',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '90%',
              border: '1px solid var(--border-color)'
            }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginBottom: '16px' }}>{copy.rejectOrder}</h3>
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
                    setShowRejectDialog(false);
                    setCancellationReason('');
                    setRejectOrderId(null);
                  }}
                >
                  {copy.cancel}
                </button>
                <button
                  type="button"
                  onClick={confirmRejectOrder}
                  disabled={processing.orderId === rejectOrderId}
                    style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--status-cancelled)',
                    color: 'white',
                    fontSize: '0.9rem',
                    cursor: processing.orderId === rejectOrderId ? 'not-allowed' : 'pointer',
                    opacity: processing.orderId === rejectOrderId ? 0.6 : 1
                  }}
                >
                  {processing.orderId === rejectOrderId && processing.action === 'reject' ? copy.rejectingOrder : copy.rejectOrder}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}
