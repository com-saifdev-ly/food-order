import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import FilterPanel from '../components/FilterPanel';
import MultiSelectFilter from '../components/MultiSelectFilter';
import { getLocalizedPath, translations, getDateLocale, getDateLocaleOptions, translateStatus } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../lib/useAuthSession';
import { getDeliveryOrders, updateOrderStatus, updateOrderItemStatus, updateOrderItemStatusAndPrice, getOrderItems, getUserProfile } from '../lib/database';
import { showConfirmDialog } from '../components/ConfirmDialog';
import { getProfileWithFallback } from '../lib/profile';

export default function MyDeliveriesPage({ language }) {
  const copy = translations[language];
  const { session, loading: authLoading } = useAuthSession();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [message, setMessage] = useState('');
  const [collecting, setCollecting] = useState({});
  const [expandedOrders, setExpandedOrders] = useState({});
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [priceDialogItem, setPriceDialogItem] = useState(null);
  const [priceInput, setPriceInput] = useState('');
  const [rejectingItem, setRejectingItem] = useState(null);
  const [showCancellationInfo, setShowCancellationInfo] = useState(false);
  const [cancellationInfo, setCancellationInfo] = useState(null);
  
  // Filter and sort states
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
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

        // Get delivery orders
        const deliveryOrders = await getDeliveryOrders(session.user.id);
        
        // Filter out pending orders - only show accepted, preparing, on_the_way, delivered, cancelled
        const filteredOrders = deliveryOrders.filter(order => order.status !== 'pending');
        
        // If items aren't included, fetch them separately
        for (const order of filteredOrders) {
          if (!order.order_items || order.order_items.length === 0) {
            try {
              const items = await getOrderItems(order.id);
              order.order_items = items;
            } catch (err) {
              setMessage(copy.failedToUpdateStatus + ': ' + err.message);
            }
          }
        }
        
        setOrders(filteredOrders);
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    }

    loadData();
  }, [session]);

  async function handleUpdateStatus(orderId, newStatus) {
    setUpdating(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      setMessage(copy.statusUpdated);
      
      // Refresh orders (show all, including completed)
      const updatedOrders = await getDeliveryOrders(session.user.id);
      setOrders(updatedOrders);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.failedToUpdateStatus + ': ' + error.message);
    } finally {
      setUpdating(null);
    }
  }

  async function handleMarkCollected(itemId, orderId, orderStatus) {
    if (orderStatus === 'cancelled' || orderStatus === 'delivered') {
      setMessage(copy.cannotMarkItemsCollectedForCompletedOrders);
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Show price dialog for collected items
    setPriceDialogItem({ itemId, orderId, orderStatus });
    setPriceInput('');
    setShowPriceDialog(true);
  }

  async function handlePriceSubmit(price) {
    const { itemId, orderId, orderStatus, isUpdate, isEdit } = priceDialogItem;
    
    // Validate price input - required for both new collection and updates
    if (!price || price === '' || parseFloat(price) <= 0) {
      setMessage(copy.errorPleaseEnterValidPrice);
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    setCollecting({ ...collecting, [itemId]: true });
    try {
      // Check if the item is currently pending
      const currentItem = orders.flatMap(o => o.order_items || []).find(item => item.id === itemId);
      const isCurrentlyPending = currentItem && currentItem.status === 'pending';
      
      if (isUpdate || isEdit) {
        // Update price, and also set as collected if it was pending
        await updateOrderItemStatusAndPrice(itemId, isCurrentlyPending ? 'collected' : 'collected', price);
        setMessage(isEdit ? copy.priceUpdatedSuccessfully : copy.priceAddedSuccessfully);
      } else {
        // Mark as collected with price
        await updateOrderItemStatusAndPrice(itemId, 'collected', price);
        setMessage(copy.itemMarkedCollected);
      }
      
      // Refresh orders (show all, including completed)
      const updatedOrders = await getDeliveryOrders(session.user.id);
      setOrders(updatedOrders);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(isUpdate ? copy.failedToUpdatePrice + ': ' + error.message : copy.failedToMarkItemCollected + ': ' + error.message);
    } finally {
      setCollecting({});
      setShowPriceDialog(false);
      setPriceDialogItem(null);
      setPriceInput('');
    }
  }

  async function handlePriceSkip() {
    const { itemId, isUpdate, isEdit } = priceDialogItem;
    
    setCollecting({ ...collecting, [itemId]: true });
    try {
      if (isUpdate || isEdit) {
        // Just close dialog, don't change anything
        setShowPriceDialog(false);
        setPriceDialogItem(null);
        setPriceInput('');
        return;
      }
      
      await updateOrderItemStatus(itemId, 'collected');
      setMessage(copy.itemMarkedCollected);
      
      // Refresh orders (show all, including completed)
      const updatedOrders = await getDeliveryOrders(session.user.id);
      setOrders(updatedOrders);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.failedToMarkItemCollected + ': ' + error.message);
    } finally {
      setCollecting({});
      setShowPriceDialog(false);
      setPriceDialogItem(null);
      setPriceInput('');
    }
  }

  async function handleRejectItem(itemId, orderId, orderStatus) {
    if (orderStatus === 'cancelled' || orderStatus === 'delivered') {
      setMessage(copy.cannotRejectItemsForCompletedOrders);
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const confirmed = await showConfirmDialog(copy.confirmReject, language);
    if (!confirmed) return;

    setRejectingItem(itemId);
    try {
      await updateOrderItemStatus(itemId, 'rejected');
      setMessage(copy.itemRejected);
      
      // Refresh orders (show all, including completed)
      const updatedOrders = await getDeliveryOrders(session.user.id);
      setOrders(updatedOrders);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.failedToRejectItem + ': ' + error.message);
    } finally {
      setRejectingItem(null);
    }
  }

  function toggleExpand(orderId) {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
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

  function getNextStatus(currentStatus) {
    const statusFlow = {
      accepted: 'preparing',
      preparing: 'on_the_way',
      on_the_way: 'delivered',
    };
    return statusFlow[currentStatus];
  }

  // Filter and sort functions
  const getFilteredAndSortedOrders = () => {
    let filtered = [...orders];
    
    // Filter by status (multi-select)
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(order => selectedStatuses.includes(order.status));
    }
    
    // Filter by customer (multi-select)
    if (selectedCustomers.length > 0) {
      filtered = filtered.filter(order => selectedCustomers.includes(order.customer_id));
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

  const getUniqueCustomers = () => {
    const customerMap = new Map();
    orders.forEach(order => {
      if (order.customer_id && order.customer_profile) {
        // Use Map to automatically handle duplicates by ID
        customerMap.set(order.customer_id, {
          id: order.customer_id,
          name: order.customer_profile.full_name
        });
      }
    });
    return Array.from(customerMap.values());
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedCustomers([]);
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
  }, [selectedStatuses, selectedCustomers, selectedCanceledBy, sortBy, itemSearch, dateFilter, customFromDate, customToDate, orderIdFilter]);

  const filteredAndSortedOrders = getFilteredAndSortedOrders();
  const uniqueCustomers = getUniqueCustomers();
  const displayedOrders = filteredAndSortedOrders.slice(0, visibleOrders);
  const hasMoreOrders = filteredAndSortedOrders.length > visibleOrders;

  const loadMore = () => {
    setVisibleOrders(prev => prev + 10); // Load 10 more at a time for better performance
  };

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

        <h1>{copy.myDeliveriesTitle}</h1>
        <p className="Auth-message">{copy.welcome}, {profile.fullName}!</p>

        {message && <p className="Auth-message" style={{ color: message.includes('failed') ? 'red' : 'green' }}>{message}</p>}

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
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{copy.sortBy}</label>
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

            {uniqueCustomers.length > 0 && (
              <MultiSelectFilter
                label={`${copy.filter} ${copy.allCustomers}`}
                options={uniqueCustomers.map((customer) => ({
                  value: customer.id,
                  label: customer.name,
                }))}
                selectedValues={selectedCustomers}
                setSelectedValues={setSelectedCustomers}
                placeholder={copy.allCustomers}
              />
            )}

            {orders.some(order => order.status === 'cancelled') && (
              <MultiSelectFilter
                label={`${copy.filter} ${copy.canceledBy}`}
                options={[
                  { value: 'me', label: copy.canceledByMe },
                  ...uniqueCustomers.map((customer) => ({
                    value: customer.id,
                    label: customer.name,
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
            <p>{copy.noDeliveries}</p>
          </div>
        ) : (
          <div className="Orders-list">
            {filteredAndSortedOrders.length === 0 ? (
              <div className="Auth-message">
                <p>{copy.noDeliveriesMatchFilters}</p>
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
                      className="Order-status"
                      style={{ backgroundColor: getStatusColor(order.status) }}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                    {(order.status === 'cancelled' || order.status === 'rejected') && order.cancelled_by && (
                      <button
                        type="button"
                        className="Secondary-link"
                        onClick={() => handleShowCancellationInfo(order)}
                        style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                      >
                        {copy.more}
                      </button>
                    )}
                  </div>
                  <button 
                    type="button"
                    className="Primary-btn"
                    onClick={() => window.location.href = getLocalizedPath(`/delivery-order-detail?order=${order.id}`, language)}
                    style={{ padding: '8px 16px', fontSize: '0.85rem', marginLeft: '12px' }}
                  >
                    {copy.view}
                  </button>
                </div>
                
                {order.description && (
                  <p className="Order-description">{order.description}</p>
                )}
                
                <p className="Order-address">
                  <strong>{copy.deliveryAddressLabel}:</strong> {order.delivery_address}
                </p>
                
                <p className="Order-customer">
                  <strong>{copy.customerLabel}:</strong> {order.customer_profile.full_name} ({order.customer_profile.email})
                </p>
                
                <p className="Order-date">
                  <strong>{copy.createdLabel}:</strong> {new Date(order.created_at).toLocaleString(getDateLocale(language), getDateLocaleOptions(language))}
                </p>

                {order.order_items && order.order_items.length > 0 ? (
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
                          <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{item.name || copy.itemFallback}</span>
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
                ) : (
                  <div className="Order-items">
                    <h4>{copy.itemsInOrder}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {copy.noItemsInOrder}
                    </p>
                  </div>
                )}

                {order.status !== 'cancelled' && order.status !== 'delivered' && (
                  <div className="Order-actions">
                    {getNextStatus(order.status) && (
                      <button 
                        type="button"
                        className="Primary-btn"
                        onClick={() => handleUpdateStatus(order.id, getNextStatus(order.status))}
                        disabled={updating === order.id}
                      >
                        {updating === order.id ? copy.loading : copy.markAsStatus.replace('{status}', getStatusLabel(getNextStatus(order.status)))}
                      </button>
                    )}
                  </div>
                )}
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
                  {copy.loadMore} ({filteredAndSortedOrders.length - visibleOrders} remaining)
                </button>
              </div>
            )}
          </div>
        )}

        <div className="Action-row">
          <a className="Primary-btn" href={getLocalizedPath('/available-orders', language)}>
            {copy.availableOrders}
          </a>
          <a className="Secondary-link" href={getLocalizedPath('/driver-dashboard', language)}>
            {copy.back}
          </a>
        </div>
      </section>

      {/* Price Dialog Modal */}
      {showPriceDialog && (
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
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
              {priceDialogItem?.isEdit ? copy.editPrice : priceDialogItem?.isUpdate ? copy.updatePrice : copy.enterPrice}
            </h3>
            <input
              type="number"
              step="0.01"
              min="0"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder={copy.pricePlaceholder}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                marginBottom: '16px'
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              {!priceDialogItem?.isUpdate && !priceDialogItem?.isEdit && (
                <button
                  type="button"
                  onClick={handlePriceSkip}
                  className="Secondary-link"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  {copy.skip}
                </button>
              )}
              <button
                type="button"
                onClick={() => handlePriceSubmit(priceInput)}
                className="Primary-btn"
                disabled={!priceInput || priceInput === '' || parseFloat(priceInput) <= 0}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  cursor: (!priceInput || priceInput === '' || parseFloat(priceInput) <= 0) ? 'not-allowed' : 'pointer',
                  opacity: (!priceInput || priceInput === '' || parseFloat(priceInput) <= 0) ? 0.5 : 1
                }}
              >
                {priceDialogItem?.isEdit ? copy.edit : priceDialogItem?.isUpdate ? copy.add : copy.statusCollected}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPriceDialog(false);
                setPriceDialogItem(null);
                setPriceInput('');
              }}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                width: '100%'
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
    </PageShell>
  );
}