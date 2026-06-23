import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import FilterPanel from '../components/FilterPanel';
import MultiSelectFilter from '../components/MultiSelectFilter';
import { getLocalizedPath, translations, getDateLocale, getDateLocaleOptions, translateStatus } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../lib/useAuthSession';
import { getCustomerOrders, cancelOrder, deleteOrderItem, getUserProfile } from '../lib/database';
import { showConfirmDialog } from '../components/ConfirmDialog';
import { getProfileWithFallback, getProfileAvatarUrl } from '../lib/profile';

export default function OrdersPage({ language }) {
  const copy = translations[language];
  const { session, loading: authLoading } = useAuthSession();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [showCancellationInfo, setShowCancellationInfo] = useState(false);
  const [cancellationInfo, setCancellationInfo] = useState(null);
  const [message, setMessage] = useState('');
  const [deliveryAvatars, setDeliveryAvatars] = useState({});
  
  // Filter and sort states
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [selectedCanceledBy, setSelectedCanceledBy] = useState([]);
  const [sortBy, setSortBy] = useState('date-newest');
  const [itemSearch, setItemSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [orderIdFilter, setOrderIdFilter] = useState('');
  const [visibleOrders, setVisibleOrders] = useState(10); // Start with more orders visible

  useEffect(() => {
    async function loadData() {
      if (!session) return;

      try {
        // Get user profile
        const profile = await getProfileWithFallback(session.user.id, session.user.email);
        setProfile(profile);

        // Get customer orders
        const customerOrders = await getCustomerOrders(session.user.id);
        setOrders(customerOrders);

        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    }

    loadData();
  }, [session]);

  async function handleCancelOrder(orderId) {
    setCancelOrderId(orderId);
    setShowCancelDialog(true);
  }

  async function confirmCancelOrder() {
    setShowCancelDialog(false);
    setCancelling(cancelOrderId);
    try {
      await cancelOrder(cancelOrderId, cancellationReason, session.user.id);
      setMessage(copy.orderCancelledSuccess);
      setCancellationReason('');
      setCancelOrderId(null);
      
      // Refresh orders
      const updatedOrders = await getCustomerOrders(session.user.id);
      setOrders(updatedOrders);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.failedToCancelOrder + ': ' + error.message);
    } finally {
      setCancelling(null);
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
      
      // Refresh orders
      const updatedOrders = await getCustomerOrders(session.user.id);
      setOrders(updatedOrders);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.failedToDeleteItem + ': ' + error.message);
    } finally {
      setDeletingItem(null);
    }
  }

  function toggleExpand(orderId) {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  }

  function handleCopyOrder(order) {
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
      rejected: 'var(--status-rejected)',
    };
    return colorMap[status] || 'var(--status-default)';
  }

  // Filter and sort functions
  const getFilteredAndSortedOrders = () => {
    let filtered = [...orders];
    
    // Filter by status (multi-select)
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(order => selectedStatuses.includes(order.status));
    }
    
    // Filter by delivery driver (multi-select)
    if (selectedDrivers.length > 0) {
      filtered = filtered.filter(order => selectedDrivers.includes(order.delivery_id));
    }

    // Filter by canceled by (multi-select)
    if (selectedCanceledBy.length > 0) {
      filtered = filtered.filter(order => {
        if (order.status !== 'cancelled') return false;

        const canceledByMe = selectedCanceledBy.includes('me') && order.cancelled_by === session?.user?.id;
        const selectedOtherIds = selectedCanceledBy.filter(selection => selection !== 'me');
        const canceledByOther = selectedOtherIds.length > 0 && selectedOtherIds.includes(order.cancelled_by);

        return canceledByMe || canceledByOther;
      });
    }
    
    // Filter by item name
    if (itemSearch.trim() !== '') {
      const searchTerm = itemSearch.toLowerCase();
      filtered = filtered.filter(order => {
        if (!order.order_items || order.order_items.length === 0) return false;
        return order.order_items.some(item => 
          item.name && item.name.toLowerCase().includes(searchTerm)
        );
      });
    }
    
    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (dateFilter === 'today') {
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= today;
        });
      } else if (dateFilter === 'last-7-days') {
        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= last7Days;
        });
      } else if (dateFilter === 'custom') {
        if (customFromDate) {
          const fromDate = new Date(customFromDate);
          filtered = filtered.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate >= fromDate;
          });
        }
        if (customToDate) {
          const toDate = new Date(customToDate);
          toDate.setDate(toDate.getDate() + 1); // Include the end date
          filtered = filtered.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate <= toDate;
          });
        }
      }
    }
    
    // Filter by order ID (supports comma-separated values)
    if (orderIdFilter.trim() !== '') {
      const orderIds = orderIdFilter.split(',').map(id => id.trim()).filter(id => id !== '');
      filtered = filtered.filter(order =>
        orderIds.some(id => order.id.toString().includes(id))
      );
    }
    
    // Sort
    switch (sortBy) {
      case 'date-newest':
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'date-oldest':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      default:
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    return filtered;
  };

  const getUniqueDrivers = () => {
    const driverMap = new Map();
    orders.forEach(order => {
      if (order.delivery_id && order.delivery_profile) {
        // Use Map to automatically handle duplicates by ID
        driverMap.set(order.delivery_id, {
          id: order.delivery_id,
          name: order.delivery_profile?.full_name || 'Unknown Driver'
        });
      }
    });
    return Array.from(driverMap.values());
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedDrivers([]);
    setSelectedCanceledBy([]);
    setSortBy('date-newest');
    setItemSearch('');
    setDateFilter('all');
    setCustomFromDate('');
    setCustomToDate('');
    setOrderIdFilter('');
    setVisibleOrders(10); // Reset to higher initial value
  };

  // Reset visible orders when filters change
  useEffect(() => {
    setVisibleOrders(10);
  }, [selectedStatuses, selectedDrivers, selectedCanceledBy, sortBy, itemSearch, dateFilter, customFromDate, customToDate, orderIdFilter]);

  const filteredAndSortedOrders = getFilteredAndSortedOrders();
  const uniqueDrivers = getUniqueDrivers();
  const displayedOrders = filteredAndSortedOrders.slice(0, visibleOrders);
  const hasMoreOrders = filteredAndSortedOrders.length > visibleOrders;

  const loadMore = () => {
    setVisibleOrders(prev => prev + 10); // Load 10 more at a time for better performance
  };

  // Load avatars only for visible orders to improve performance
  useEffect(() => {
    async function loadVisibleAvatars() {
      if (orders.length === 0) return;

      const visibleOrdersList = filteredAndSortedOrders.slice(0, visibleOrders);
      const avatarMap = { ...deliveryAvatars };

      for (const order of visibleOrdersList) {
        if (order.delivery_id && !avatarMap[order.delivery_id]) {
          try {
            const avatarUrl = await getProfileAvatarUrl(order.delivery_id);
            avatarMap[order.delivery_id] = avatarUrl;
          } catch (error) {
            avatarMap[order.delivery_id] = '/assets/user.svg';
          }
        }
      }

      setDeliveryAvatars(avatarMap);
    }

    loadVisibleAvatars();
  }, [orders, visibleOrders]);

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
      <section className="Hero-card">

        <h1>{copy.myOrdersTitle}</h1>
        <p className="Auth-message">{copy.welcome}, {profile.fullName}!</p>

        {message && <p className={`Auth-message ${message.includes('failed') ? 'Auth-message--error' : 'Auth-message--success'}`}>{message}</p>}

        {/* Filter and Sort Controls */}
        {orders.length > 0 && (
          <FilterPanel language={language} copy={copy} defaultCollapsed={true}>
            <div className="Filter-sort-container" style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              padding: '0'
            }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{copy.filter} {copy.sortBy}</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  minWidth: '150px'
                }}
              >
                <option value="date-newest">{copy.dateNewest}</option>
                <option value="date-oldest">{copy.dateOldest}</option>
              </select>
            </div>

            <MultiSelectFilter
              label={`${copy.filter} ${copy.allStatuses}`}
              options={['pending', 'accepted', 'preparing', 'on_the_way', 'delivered', 'cancelled'].map((status) => ({
                value: status,
                label: translateStatus(status, language),
              }))}
              selectedValues={selectedStatuses}
              setSelectedValues={setSelectedStatuses}
              placeholder={copy.allStatuses}
            />

            {uniqueDrivers.length > 0 && (
              <MultiSelectFilter
                label={`${copy.filter} ${copy.allDrivers}`}
                options={uniqueDrivers.map((driver) => ({
                  value: driver.id,
                  label: driver.name,
                }))}
                selectedValues={selectedDrivers}
                setSelectedValues={setSelectedDrivers}
                placeholder={copy.allDrivers}
              />
            )}

            {orders.some(order => order.status === 'cancelled') && (
              <MultiSelectFilter
                label={`${copy.filter} ${copy.canceledBy}`}
                options={[
                  { value: 'me', label: copy.canceledByMe },
                  ...uniqueDrivers.map((driver) => ({
                    value: driver.id,
                    label: driver.name,
                  })),
                ]}
                selectedValues={selectedCanceledBy}
                setSelectedValues={setSelectedCanceledBy}
                placeholder={copy.canceledBy}
              />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{copy.searchItems}</label>
              <input 
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder={copy.searchItems}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  width: '100%'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{copy.filter} {copy.dateLabel}</label>
              <select 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  minWidth: '150px'
                }}
              >
                <option value="all">{copy.allDates}</option>
                <option value="today">{copy.today}</option>
                <option value="last-7-days">{copy.last7Days}</option>
                <option value="custom">{copy.customDate}</option>
              </select>
            </div>

            {dateFilter === 'custom' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{copy.fromDate}</label>
                  <input 
                    type="datetime-local"
                    value={customFromDate}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      minWidth: '200px'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{copy.toDate}</label>
                  <input 
                    type="datetime-local"
                    value={customToDate}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      minWidth: '200px'
                    }}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '150px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{copy.filter} {copy.orderIdLabel}</label>
              <input 
                type="text"
                value={orderIdFilter}
                onChange={(e) => setOrderIdFilter(e.target.value)}
                placeholder={copy.orderIdPlaceholder}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  width: '100%'
                }}
              />
            </div>

            <button 
              type="button"
              onClick={clearFilters}
              className="Secondary-link"
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                cursor: 'pointer',
                alignSelf: 'flex-end',
                marginTop: 'auto'
              }}
            >
              {copy.clearFilters}
            </button>
            </div>
          </FilterPanel>
        )}

        {orders.length === 0 ? (
          <div className="Auth-message">
            <p>{copy.noOrdersYet}</p>
          </div>
        ) : (
          <div className="Orders-list-wrapper">
            <div className="Orders-list">
            {filteredAndSortedOrders.length === 0 ? (
              <div className="Auth-message">
                <p>{copy.noOrdersMatchFilters}</p>
                <button 
                  type="button"
                  onClick={clearFilters}
                  className="Primary-btn"
                  style={{ marginTop: '12px' }}
                >
                  {copy.clearFilters}
                </button>
              </div>
            ) : (
              displayedOrders.map((order) => (
                <div key={order.id} className="Order-card">
                <div className="Order-header">
                  <h3>{order.title} #{order.id}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span 
                      className={`Order-status Order-status--${order.status}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                    {order.status === 'cancelled' && order.cancelled_by && (
                      <button
                        type="button"
                        className="Secondary-link"
                        onClick={() => handleShowCancellationInfo(order)}
                        style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                      >
                        {copy.more}
                      </button>
                    )}
                    <button 
                    type="button"
                    className="Primary-btn"
                    onClick={() => window.location.href = getLocalizedPath(`/order-detail?order=${order.id}`, language)}
                    style={{ padding: '8px 16px', fontSize: '0.85rem', marginLeft: '12px' }}
                  >
                    {copy.view}
                  </button>
                  </div>
                </div>
                
                {order.description && (
                  <p className="Order-description">{order.description}</p>
                )}
                
                <p className="Order-address">
                  <strong>{copy.deliveryAddressLabel}:</strong> {order.delivery_address}
                </p>
                
                {order.delivery_profile && (
                  <p className="Order-delivery">
                    <strong>{copy.deliveryDriverLabel}:</strong> 
                    <span className="Order-delivery-info">
                      <img 
                        src={deliveryAvatars[order.delivery_id] || '/assets/user.svg'}
                        alt={order.delivery_profile?.full_name || 'Driver'}
                        className="Delivery-avatar-small"
                        onError={(e) => {
                          e.target.src = '/assets/user.svg';
                        }}
                      />
                      {order.delivery_profile?.full_name || 'Unknown'} ({order.delivery_profile?.email || 'No email'})
                    </span>
                  </p>
                )}
                
                <p className="Order-date">
                  <strong>{copy.createdLabel}:</strong> {new Date(order.created_at).toLocaleString(getDateLocale(language), getDateLocaleOptions(language))}
                </p>

                {order.order_items && order.order_items.length > 0 && (
                  <div className="Order-items-container">
                    <button 
                      type="button" 
                      className="Secondary-link"
                      onClick={() => toggleExpand(order.id)}
                      style={{ fontSize: '0.85rem', marginBottom: '12px' }}
                    >
                      {expandedOrders[order.id] ? copy.hideItems : copy.showItems} ({order.order_items.length})
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
                              ...(item.status === 'rejected' ? {
                                borderLeft: '4px solid var(--status-cancelled)',
                                backgroundColor: 'var(--status-cancelled-bg)'
                              } : {})
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{item.name || 'Item'}</span>
                              <span style={{
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                backgroundColor: item.status === 'collected' ? 'var(--success-color)' : item.status === 'rejected' ? 'var(--status-rejected)' : 'var(--status-pending)',
                                color: 'white',
                                fontWeight: '500'
                              }}>
                                {getStatusLabel(item.status)}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {copy.quantityShort}: {item.quantity}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                <div className="Order-actions">
                  {order.status === 'pending' && (
                    <button 
                      type="button"
                      className="Secondary-link"
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={cancelling === order.id}
                    >
                      {cancelling === order.id ? copy.cancellingOrder : copy.cancelOrder}
                    </button>
                  )}
                  
                  {(order.status === 'cancelled' || order.status === 'delivered') && (
                    <button 
                      type="button"
                      className="Primary-btn"
                      onClick={() => handleCopyOrder(order)}
                    >
                      {copy.copyToNewOrder}
                    </button>
                  )}

                  {(order.status === 'pending' || order.status === 'accepted' || order.status === 'preparing' || order.status === 'on_the_way') && (
                    <button 
                      type="button"
                      className="Primary-btn"
                      onClick={() => window.location.href = getLocalizedPath('/edit-order', language) + `&id=${order.id}&source=orders-list`}
                    >
                      {copy.edit}
                    </button>
                  )}
                </div>
                </div>
              ))
            )}
            
            {hasMoreOrders && (
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button 
                  type="button"
                  onClick={loadMore}
                  className="Secondary-link"
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  {copy.loadMore} ({filteredAndSortedOrders.length - visibleOrders} {copy.remaining || 'remaining'})
                </button>
              </div>
            )}
          </div>
        </div>
        )}

        <div className="Action-row">
          <a className="Primary-btn" href={getLocalizedPath('/create-order', language)}>
            {copy.createOrder}
          </a>
          <a className="Secondary-link" href={getLocalizedPath('/customer-dashboard', language)}>
            {copy.back}
          </a>
        </div>
      </section>

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
                  setCancelOrderId(null);
                }}
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={confirmCancelOrder}
                disabled={cancelling === cancelOrderId}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--status-cancelled)',
                  color: 'white',
                  fontSize: '0.9rem',
                  cursor: cancelling === cancelOrderId ? 'not-allowed' : 'pointer',
                  opacity: cancelling === cancelOrderId ? 0.6 : 1
                }}
              >
                {cancelling === cancelOrderId ? copy.cancellingOrder : copy.cancelOrder}
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
    </PageShell>
  );
}