import { useState, useEffect, useRef } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations, translateStatus, getDateLocale, getDateLocaleOptions } from '../lib/i18n';
import { useAuthSession } from '../lib/useAuthSession';
import { getProfileWithFallback } from '../lib/profile';
import { getCustomerOrders, getDeliveryOrders, getCustomerDeliveryLinks, getDeliveryCustomerLinks } from '../lib/database';

export default function CalculateOrdersPricePage({ language }) {
  const copy = translations[language];
  const { session, loading: authLoading } = useAuthSession();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, lastWeek, thisMonth, custom
  const [statusFilter, setStatusFilter] = useState('delivered'); // all, pending, accepted, preparing, on_the_way, delivered, cancelled
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [totalPrice, setTotalPrice] = useState(0);
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  const [viewOrderItems, setViewOrderItems] = useState([]);
  const [users, setUsers] = useState([]); // delivery drivers for customers, customers for delivery
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const statusButtonRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      if (!session) return;

      try {
        const userProfile = await getProfileWithFallback(session.user.id, session.user.email);
        setProfile(userProfile);

        let userOrders = [];
        let userLinks = [];

        if (userProfile.role === 'customer') {
          userOrders = await getCustomerOrders(session.user.id);
          userLinks = await getCustomerDeliveryLinks(session.user.id);
        } else if (userProfile.role === 'delivery') {
          userOrders = await getDeliveryOrders(session.user.id);
          userLinks = await getDeliveryCustomerLinks(session.user.id);
        }

        setOrders(userOrders);
        setFilteredOrders(userOrders);
        setUsers(userLinks);
        setLoading(false);
      } catch (error) {
        console.error('Error loading orders:', error);
        setLoading(false);
      }
    }

    loadData();
  }, [session]);

  // Auto-close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target) &&
          statusButtonRef.current && !statusButtonRef.current.contains(event.target)) {
        setShowStatusDropdown(false);
      }
    }

    if (showUserDropdown || showStatusDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showUserDropdown, showStatusDropdown]);

  // Apply filters
  useEffect(() => {
    let filtered = [...orders];

    // Apply user filter
    if (selectedUsers.size > 0) {
      if (profile?.role === 'customer') {
        // Filter by delivery drivers
        filtered = filtered.filter(order => {
          const deliveryId = order.delivery_id;
          return deliveryId && selectedUsers.has(deliveryId);
        });
      } else if (profile?.role === 'delivery') {
        // Filter by customers
        filtered = filtered.filter(order => {
          const customerId = order.customer_id;
          return customerId && selectedUsers.has(customerId);
        });
      }
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Apply date filter
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const lastWeekStart = new Date(todayStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 6);
    const lastWeekEnd = new Date(todayEnd);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    switch (dateFilter) {
      case 'today':
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= todayStart && orderDate < todayEnd;
        });
        break;
      case 'lastWeek':
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= lastWeekStart && orderDate < lastWeekEnd;
        });
        break;
      case 'thisMonth':
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= thisMonthStart && orderDate < thisMonthEnd;
        });
        break;
      case 'custom':
        if (fromDate && toDate) {
          const from = new Date(fromDate);
          const to = new Date(toDate);
          to.setDate(to.getDate() + 1); // Include the end date
          filtered = filtered.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate >= from && orderDate < to;
          });
        }
        break;
      default:
        // Show all
        break;
    }

    // Apply search filter - handle multiple order IDs and keywords
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => {
        // Check for comma-separated order IDs
        const ids = query.split(',').map(s => s.trim()).filter(s => s);
        const idMatch = ids.some(id => {
          const cleanId = id.replace(/\D/g, ''); // Remove non-digits
          return order.id?.toString() === cleanId;
        });
        
        // Check for keywords
        const keywords = query.replace(/,\d*/g, '').replace(/\d+/g, '').trim();
        if (keywords) {
          const titleMatch = order.title?.toLowerCase().includes(keywords);
          const statusMatch = translateStatus(order.status, language).toLowerCase().includes(keywords);
          return idMatch || titleMatch || statusMatch;
        }
        
        return idMatch;
      });
    }

    setFilteredOrders(filtered);
  }, [orders, searchQuery, dateFilter, statusFilter, fromDate, toDate, language, selectedUsers, profile]);

  // Calculate total price of selected orders
  useEffect(() => {
    let total = 0;
    selectedOrders.forEach(orderId => {
      const order = orders.find(o => o.id === orderId);
      if (order && order.order_items) {
        order.order_items.forEach(item => {
          if (item.status === 'collected' && item.price) {
            let priceValue = 0;
            if (typeof item.price === 'string') {
              priceValue = item.price.startsWith('$')
                ? parseFloat(item.price.replace('$', ''))
                : parseFloat(item.price);
            } else {
              priceValue = parseFloat(item.price);
            }
            total += priceValue || 0;
          }
        });
      }
    });
    setTotalPrice(total);
  }, [selectedOrders, orders]);

  function toggleOrderSelection(orderId) {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  }

  function toggleSelectAll() {
    if (selectedOrders.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(order => order.id)));
    }
  }

  function handleQuickFilter(filter) {
    setDateFilter(filter);
    setSelectedOrders(new Set()); // Clear selections when filter changes
  }

  function handleViewItems(order) {
    setViewOrderItems(order.order_items || []);
    setShowItemsDialog(true);
  }

  function toggleUserSelection(userId) {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString(getDateLocale(language), getDateLocaleOptions(language));
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

  if (!session || !profile) {
    return null;
  }

  return (
    <PageShell language={language}>
      <section className="Hero-card">
        <h1>{copy.ordersPriceTitle}</h1>

        {/* Quick Filters */}
        <div style={{ marginTop: '24px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--text-primary)' }}>{copy.quickFilters}</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleQuickFilter('all')}
              style={{
                padding: '8px 16px',
                border: dateFilter === 'all' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: dateFilter === 'all' ? 'var(--primary-color)' : 'var(--card-bg)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: dateFilter === 'all' ? '600' : '400'
              }}
            >
              {copy.all}
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('today')}
              style={{
                padding: '8px 16px',
                border: dateFilter === 'today' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: dateFilter === 'today' ? 'var(--primary-color)' : 'var(--card-bg)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: dateFilter === 'today' ? '600' : '400'
              }}
            >
              {copy.today}
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('lastWeek')}
              style={{
                padding: '8px 16px',
                border: dateFilter === 'lastWeek' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: dateFilter === 'lastWeek' ? 'var(--primary-color)' : 'var(--card-bg)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: dateFilter === 'lastWeek' ? '600' : '400'
              }}
            >
              {copy.lastWeek}
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('thisMonth')}
              style={{
                padding: '8px 16px',
                border: dateFilter === 'thisMonth' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: dateFilter === 'thisMonth' ? 'var(--primary-color)' : 'var(--card-bg)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: dateFilter === 'thisMonth' ? '600' : '400'
              }}
            >
              {copy.thisMonth}
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('custom')}
              style={{
                padding: '8px 16px',
                border: dateFilter === 'custom' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: dateFilter === 'custom' ? 'var(--primary-color)' : 'var(--card-bg)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: dateFilter === 'custom' ? '600' : '400'
              }}
            >
              {copy.customDate}
            </button>
          </div>
        </div>

        {/* Status Filter */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'block', color: 'var(--text-primary)' }}>{copy.statusFilter}</label>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              ref={statusButtonRef}
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                minWidth: '200px',
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              {statusFilter === 'all' ? copy.all : translateStatus(statusFilter, language)}
            </button>
            {showStatusDropdown && (
              <div
                ref={statusDropdownRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '2px',
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  zIndex: 10,
                  maxHeight: '350px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {['all', 'pending', 'accepted', 'preparing', 'on_the_way', 'delivered', 'cancelled'].map(status => (
                  <div
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      setShowStatusDropdown(false);
                      setSelectedOrders(new Set()); // Clear selections when status changes
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--text-primary)',
                      backgroundColor: statusFilter === status ? 'var(--border-color)' : 'transparent',
                      ':hover': {
                        backgroundColor: 'var(--border-color)'
                      }
                    }}
                  >
                    {status === 'all' ? copy.all : translateStatus(status, language)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User Filter */}
        {users.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'block', color: 'var(--text-primary)' }}>
              {profile.role === 'customer' ? copy.selectDeliveryDrivers : copy.selectCustomers}
            </label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                ref={buttonRef}
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                  minWidth: '200px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                {selectedUsers.size > 0
                  ? `${selectedUsers.size} ${profile.role === 'customer' ? copy.deliveryDrivers : copy.customers}`
                  : (copy.all)
                }
              </button>
              {showUserDropdown && (
                <div
                  ref={dropdownRef}
                  style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '2px',
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  zIndex: 10,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  opacity: 1,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.59)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)'
                }}
                onClick={(e) => e.stopPropagation()}
                >
                  {/* All option */}
                  <div
                    onClick={() => {
                      setSelectedUsers(new Set());
                      setShowUserDropdown(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--text-primary)',
                      borderBottom: '1px solid var(--border-color)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === 0}
                      readOnly
                      style={{ cursor: 'pointer' }}
                    />
                    <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                      {copy.all}
                    </div>
                  </div>
                  {/* Individual users */}
                  {users.map(user => (
                    <div
                      key={profile?.role === 'customer' ? (user.delivery_id || user.id) : (user.customer_id || user.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleUserSelection(profile?.role === 'customer' ? (user.delivery_id || user.id) : (user.customer_id || user.id));
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--text-primary)',
                        ':hover': {
                          backgroundColor: 'var(--border-color)'
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(profile?.role === 'customer' ? (user.delivery_id || user.id) : (user.customer_id || user.id))}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleUserSelection(profile?.role === 'customer' ? (user.delivery_id || user.id) : (user.customer_id || user.id));
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                          {user.delivery_profile?.full_name || user.customer_profile?.full_name || user.full_name || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {user.delivery_profile?.email || user.customer_profile?.email || user.email || ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom Date Range */}
        {dateFilter === 'custom' && (
          <div style={{ marginBottom: '16px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--card-bg)' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '0.9rem', marginBottom: '4px', display: 'block', color: 'var(--text-primary)' }}>{copy.fromDate}</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{
                    padding: '8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--card-bg)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.9rem', marginBottom: '4px', display: 'block', color: 'var(--text-primary)' }}>{copy.toDate}</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{
                    padding: '8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--card-bg)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={copy.searchOrders}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '1rem',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        {/* Total Price Display */}
        <div style={{
          padding: '16px',
          background: 'var(--background-color)',
          borderRadius: '8px',
          borderColor: 'var(--border-color)',
          borderWidth: '1px',
          borderStyle: 'solid',
          marginBottom: '24px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>{copy.totalPrice}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-primary)' }}>${totalPrice.toFixed(2)}</p>
          <p style={{ fontSize: '0.9rem', opacity: 0.9, color: 'var(--text-primary)' }}>{selectedOrders.size} {copy.selectedOrders}</p>
        </div>

        {/* Select All */}
        {filteredOrders.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              onClick={toggleSelectAll}
              style={{
                padding: '8px 16px',
                border: '2px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.95rem'
              }}
            >
              {selectedOrders.size === filteredOrders.length ? copy.deselectAll : copy.selectAll}
            </button>
          </div>
        )}

        {/* Orders List */}
        <div className="Order-items-container">
          {filteredOrders.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px' }}>
              {copy.noOrdersFound}
            </p>
          ) : (
            filteredOrders.sort((a, b) => b.id - a.id).map(order => (
              <div
                key={order.id}
                style={{
                  padding: '16px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  backgroundColor: 'var(--card-bg)',
                  border: selectedOrders.has(order.id) ? '2px solid var(--primary-color)' : '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleOrderSelection(order.id);
                      }}
                      style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '1rem', marginBottom: '4px', color: 'var(--text-primary)' }}>{order.title}</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        #{order.id} • {formatDate(order.created_at)}
                      </p>
                    </div>
                  </div>
                  <span
                    className="Order-status"
                    style={{
                      backgroundColor: order.status === 'pending' ? 'var(--status-pending)' :
                                     order.status === 'accepted' ? 'var(--status-accepted)' :
                                     order.status === 'preparing' ? 'var(--status-preparing)' :
                                     order.status === 'on_the_way' ? 'var(--status-on-the-way)' :
                                     order.status === 'delivered' ? 'var(--status-delivered)' :
                                     order.status === 'cancelled' ? 'var(--status-cancelled)' :
                                     'var(--status-default)'
                    }}
                  >
                    {translateStatus(order.status, language)}
                  </span>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => handleViewItems(order)}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      backgroundColor: 'var(--card-bg)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    {copy.viewItems}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* View Items Dialog */}
        {showItemsDialog && (
          <div
            className="Avatar-dialog-overlay"
            onClick={() => setShowItemsDialog(false)}
          >
            <div
              className="Avatar-dialog"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '500px',
                width: '90%',
                maxHeight: '80vh',
                overflowY: 'auto'
              }}
            >
              <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', color: 'var(--text-primary)' }}>{copy.viewItems}</h3>
              {viewOrderItems.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>{copy.noOrdersSelected}</p>
              ) : (
                <div>
                  {viewOrderItems.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '8px 0',
                        borderBottom: index < viewOrderItems.length - 1 ? '1px solid var(--border-color)' : 'none',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>{item.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {copy.quantityLabelShort || 'Qty'}: {item.quantity} • {copy.price || 'Price'}: ${typeof item.price === 'string' ? item.price.replace('$', '') : (item.price || '0')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="Secondary-link"
                onClick={() => setShowItemsDialog(false)}
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
