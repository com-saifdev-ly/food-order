import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations, translateStatus } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../lib/useAuthSession';
import { 
  getOrderById,
  updateOrder, 
  deleteOrderItem, 
  createOrderItem,
  getOrderItems,
  updateOrderItem,
  getCustomerDeliveryLinks,
  getAcceptedDeliveryRequests
} from '../lib/database';
import { getProfileWithFallback, getProfileAvatarUrl } from '../lib/profile';

export default function EditOrderPage({ language }) {
  const copy = translations[language];
  const { session, loading: authLoading } = useAuthSession();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Get order ID and source from URL (using &id= and &source= parameters after ?lang=en)
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');
  const source = urlParams.get('source') || 'orders-list';

  const [orderData, setOrderData] = useState({
    title: '',
    description: '',
    delivery_address: '',
    delivery_id: '',
  });
  
  const [orderItems, setOrderItems] = useState([
    { name: '', quantity: 1, min_price: '', max_price: '', recommended_place: '', note: '', status: 'pending' }
  ]);
  
  const [deliveryLinks, setDeliveryLinks] = useState([]);
  const [deliveryAvatar, setDeliveryAvatar] = useState('/assets/user.svg');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [originalItemStatuses, setOriginalItemStatuses] = useState({});
  const [expandedItems, setExpandedItems] = useState({0: true});

  useEffect(() => {
    async function loadData() {
      // Wait for auth loading to complete before checking session
      if (authLoading) {
        return;
      }
      
      if (!session) {
        window.location.href = getLocalizedPath('/', language);
        return;
      }
      
      if (!orderId) {
        window.location.href = getLocalizedPath('/orders', language);
        return;
      }

      try {
        // Get user profile
        const profile = await getProfileWithFallback(session.user.id, session.user.email);
        setProfile(profile);

        // Get order data
        const order = await getOrderById(orderId);
        if (!order) {
          setMessage(copy.orderNotFound);
          setLoading(false);
          return;
        }

        // Verify this order belongs to the current user
        if (order.customer_id !== session.user.id) {
          setMessage(copy.noPermissionEditOrder);
          setLoading(false);
          return;
        }

        // Check if order can be edited
        if (order.status === 'delivered' || order.status === 'cancelled') {
          setMessage(copy.orderCannotBeEdited + ' (' + order.status + ')');
          setLoading(false);
          return;
        }

        setOrderData({
          title: order.title,
          description: order.description || '',
          delivery_address: order.delivery_address,
          delivery_id: order.delivery_id,
        });

        // Get order items
        const items = await getOrderItems(orderId);
        const processedItems = items.length > 0 ? items.map(item => ({
          id: item.id, // Keep track of original ID
          name: item.name || '',
          quantity: item.quantity || 1,
          min_price: item.min_price || '',
          max_price: item.max_price || '',
          recommended_place: item.recommended_place || '',
          note: item.note || '',
          status: item.status || 'pending'
        })) : [
          { name: '', quantity: 1, min_price: '', max_price: '', recommended_place: '', note: '', status: 'pending' }
        ];
        
        // Track original item statuses
        const originalStatuses = {};
        processedItems.forEach(item => {
          if (item.id) {
            originalStatuses[item.id] = item.status;
          }
        });
        setOriginalItemStatuses(originalStatuses);
        
        setOrderItems(processedItems);

        // Get linked delivery users (direct links + accepted requests)
        const links = await getCustomerDeliveryLinks(session.user.id);
        const acceptedRequests = await getAcceptedDeliveryRequests(session.user.id);
        
        // Combine and deduplicate by delivery_id
        const combinedMap = new Map();
        
        links.forEach(link => {
          combinedMap.set(link.delivery_id, {
            delivery_id: link.delivery_id,
            delivery_profile: link.delivery_profile
          });
        });
        
        acceptedRequests.forEach(req => {
          if (!combinedMap.has(req.delivery_id)) {
            combinedMap.set(req.delivery_id, {
              delivery_id: req.delivery_id,
              delivery_profile: req.delivery_profile
            });
          }
        });
        
        setDeliveryLinks(Array.from(combinedMap.values()));
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    }

    loadData();
  }, [session, authLoading, orderId, language, source]);

  // Load delivery avatar when delivery_id changes
  useEffect(() => {
    async function loadDeliveryAvatar() {
      if (orderData.delivery_id) {
        try {
          const avatarUrl = await getProfileAvatarUrl(orderData.delivery_id);
          setDeliveryAvatar(avatarUrl);
        } catch (error) {
          console.error('Error loading delivery avatar:', error);
          setDeliveryAvatar('/assets/user.svg');
        }
      }
    }

    loadDeliveryAvatar();
  }, [orderData.delivery_id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    // Validate all editable items - each must have a name and quantity
    for (const item of orderItems) {
      const isEditable = !item.id || originalItemStatuses[item.id] === 'pending';
      if (isEditable) {
        if (!item.name || item.name.trim() === '') {
          setError(copy.allItemsMustHaveName);
          return;
        }
        if (!item.quantity || item.quantity < 0.25) {
          setError(copy.allItemsMustHaveValidQuantity);
          return;
        }
      }
    }

    // Filter out empty items before submitting
    const validItems = orderItems.filter(item => item.name && item.name.trim() !== '');
    const editableItems = validItems.filter(item => !item.id || originalItemStatuses[item.id] === 'pending');
    
    if (editableItems.length === 0) {
      setError(copy.errorPleaseAddAtLeastOneItem);
      return;
    }

    setSubmitting(true);

    try {
      // Update order (don't update delivery_id as it's disabled)
      await updateOrder(orderId, {
        title: orderData.title,
        description: orderData.description,
        delivery_address: orderData.delivery_address,
      });

      // Get existing items from database
      const existingItems = await getOrderItems(orderId);
      
      // Separate collected, rejected, and pending items
      const collectedItems = existingItems.filter(item => item.status === 'collected');
      const rejectedItems = existingItems.filter(item => item.status === 'rejected');
      const pendingItems = existingItems.filter(item => item.status === 'pending');

      // Keep collected items as-is (don't touch them)
      
      // Process pending items - update, delete, or add (excluding rejected items)
      const validFormItems = orderItems.filter(item => item.name && item.name.trim() !== '');
      const pendingFormItems = validFormItems.filter(item => !item.id || originalItemStatuses[item.id] === 'pending');
      
      // Update pending items that still exist in form
      for (const formItem of pendingFormItems) {
        if (formItem.id) {
          // Update existing pending item
          await updateOrderItem(formItem.id, {
            name: formItem.name,
            quantity: formItem.quantity || 1,
            min_price: formItem.min_price || null,
            max_price: formItem.max_price || null,
            recommended_place: formItem.recommended_place || null,
            note: formItem.note || null,
          });
        } else {
          // Add new item
          await createOrderItem(orderId, {
            name: formItem.name,
            quantity: formItem.quantity || 1,
            min_price: formItem.min_price || null,
            max_price: formItem.max_price || null,
            recommended_place: formItem.recommended_place || null,
            note: formItem.note || null,
            status: 'pending',
          });
        }
      }
      
      // Delete pending and rejected items that were removed from form
      const pendingIdsInForm = new Set(pendingFormItems.map(item => item.id).filter(id => id));
      const rejectedIdsInForm = new Set(validFormItems.filter(item => item.id && originalItemStatuses[item.id] === 'rejected').map(item => item.id));
      
      for (const pendingItem of pendingItems) {
        if (!pendingIdsInForm.has(pendingItem.id)) {
          await deleteOrderItem(pendingItem.id);
        }
      }
      
      for (const rejectedItem of rejectedItems) {
        if (!rejectedIdsInForm.has(rejectedItem.id)) {
          await deleteOrderItem(rejectedItem.id);
        }
      }

      setMessage(copy.orderUpdatedSuccess);

      // Keep submitting true during redirect to prevent duplicate submissions
      // Redirect after 2 seconds to the appropriate page based on source
      setTimeout(() => {
        if (source === 'order-detail') {
          const url = new URL(window.location.origin + '/order-detail');
          url.searchParams.set('lang', language);
          url.searchParams.set('order', orderId);
          window.location.href = `${url.pathname}${url.search}`;
        } else {
          window.location.href = getLocalizedPath('/orders', language);
        }
      }, 2000);

    } catch (error) {
      setError(copy.failedToUpdateOrder + ': ' + error.message);
      setSubmitting(false);
    }
  }

  function addItem() {
    setOrderItems([...orderItems, { name: '', quantity: 1, min_price: '', max_price: '', recommended_place: '', note: '', status: 'pending' }]);
    // Auto-collapse all items when adding new one
    setExpandedItems({});
  }

  function removeItem(index) {
    const item = orderItems[index];
    
    // Check if this is an existing item with collected status
    if (item.id && originalItemStatuses[item.id] === 'collected') {
      setError(copy.cannotDeleteCollectedItem);
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setOrderItems(orderItems.filter((_, i) => i !== index));
  }

  function updateItem(index, field, value) {
    const updatedItems = [...orderItems];
    updatedItems[index][field] = value;
    setOrderItems(updatedItems);
  }

  function toggleItemExpand(index) {
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }));
  }

  if (authLoading || loading) {
    return (
      <PageShell language={language}>
        <section className="Hero-card">

          <h1>{copy.loading}</h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            {authLoading ? copy.loadingAuthentication : copy.loadingOrderData}
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--error-color)', marginTop: '4px' }}>
            {copy.orderIdLabel}: {orderId || copy.notProvided}
          </p>
        </section>
      </PageShell>
    );
  }

  if (!session || profile?.role !== 'customer') {
    window.location.href = getLocalizedPath('/', language);
    return null;
  }

  if (message && message.includes('cannot be edited')) {
    return (
      <PageShell language={language}>
        <section className="Hero-card">

          <h1>{copy.editOrder}</h1>
          <p className="Auth-message">{message}</p>
          <div className="Action-row">
            <a className="Primary-btn" href={
              source === 'order-detail'
                ? (() => {
                    const url = new URL(window.location.origin + '/order-detail');
                    url.searchParams.set('lang', language);
                    url.searchParams.set('order', orderId);
                    return `${url.pathname}${url.search}`;
                  })()
                : getLocalizedPath('/orders', language)
            }>
              {copy.back}
            </a>
          </div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell language={language}>
      <section className="Hero-card">

        <h1>{copy.editOrder}</h1>
        <p className="Auth-message">{copy.welcome}, {profile.fullName}!</p>

        {message && <p className="Auth-message" style={{ color: message.includes('failed') ? 'red' : 'green' }}>{message}</p>}
        {error && <p className="Auth-error" role="alert">{error}</p>}

        {deliveryLinks.length === 0 ? (
          <div className="Auth-message">
            <p>{copy.noDeliveryLinked}</p>
            <a className="Primary-btn" href={getLocalizedPath('/delivery-network', language)}>
              {copy.addDeliveryFirst}
            </a>
          </div>
        ) : (
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
            <form className="Auth-form" onSubmit={handleSubmit} style={{ maxWidth: '100%', margin: '0 auto', padding: '24px' }}>
            <label className="Auth-field">
              <span>{copy.orderTitleLabel}</span>
              <input
                type="text"
                required
                value={orderData.title}
                onChange={(e) => setOrderData({...orderData, title: e.target.value})}
                placeholder={copy.orderTitlePlaceholder}
              />
            </label>

            <label className="Auth-field">
              <span>{copy.descriptionLabel}</span>
              <textarea
                value={orderData.description}
                onChange={(e) => setOrderData({...orderData, description: e.target.value})}
                placeholder={copy.descriptionPlaceholder}
                rows={3}
              />
            </label>

            <label className="Auth-field">
              <span>{copy.deliveryAddressLabel}</span>
              <input
                type="text"
                value={orderData.delivery_address}
                onChange={(e) => setOrderData({...orderData, delivery_address: e.target.value})}
                placeholder={copy.deliveryAddressPlaceholder}
              />
            </label>

            <label className="Auth-field">
              <span>{copy.selectDeliveryLabel}</span>
              <select
                disabled
                value={orderData.delivery_id}
                style={{ width: '100%', padding: '14px', fontSize: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              >
                {deliveryLinks.map((link) => {
                  const deliveryId = link.delivery_id || link.delivery_profile?.id;
                  const fullName = link.delivery_profile?.full_name || 'Unknown';
                  const email = link.delivery_profile?.email || '';
                  return (
                    <option key={deliveryId} value={deliveryId}>
                      {fullName} ({email})
                    </option>
                  );
                })}
                
              </select>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                {copy.deliveryDriverCannotBeChanged}
              </p>
              {orderData.delivery_id && deliveryLinks.find(link => (link.delivery_id || link.delivery_profile?.id) === orderData.delivery_id) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
                  <img
                    src={deliveryAvatar}
                    alt="Delivery Driver Avatar"
                    className="Delivery-avatar-small"
                    style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-color)' }}
                    onError={(e) => {
                      e.target.src = '/assets/user.svg';
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {deliveryLinks.find(link => (link.delivery_id || link.delivery_profile?.id) === orderData.delivery_id)?.delivery_profile?.full_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {deliveryLinks.find(link => (link.delivery_id || link.delivery_profile?.id) === orderData.delivery_id)?.delivery_profile?.email || ''}
                    </div>
                  </div>
                </div>
              )}
            </label>

            <div className="Order-items-list" style={{ maxWidth: '100%', width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <h3>{copy.itemsInOrder}</h3>
              
              {orderItems.some(item => item.id && item.status === 'collected') && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px', marginBottom: '12px' }}>
                  {copy.collectedItemsCannotBeEditedOrRemoved}
                </p>
              )}
              
              {orderItems.some(item => item.id && item.status === 'rejected') && (
                <p style={{ color: 'var(--error-color)', fontSize: '0.85rem', marginTop: '8px', marginBottom: '12px' }}>
                  {copy.rejectedItemsCannotBeModifiedButCanBeDeleted}
                </p>
              )}
              
              {orderItems.map((item, index) => {
                const isCollected = item.id && item.status === 'collected';
                const isRejected = item.id && item.status === 'rejected';
                const isPending = !item.id || item.status === 'pending';
                const isEditable = isPending;
                
                return (
                  <div 
                    key={index} 
                    className={`Order-item-vertical ${isRejected ? 'Order-item-vertical--rejected' : ''}`}
                    style={{
                      marginBottom: '12px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '16px',
                        ...(isRejected ? {
                        borderLeft: '4px solid var(--status-rejected)',
                        backgroundColor: 'var(--status-cancelled-bg)'
                      } : {})
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <button 
                        type="button"
                        onClick={() => toggleItemExpand(index)}
                        disabled={submitting}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'var(--text-primary)', 
                          cursor: submitting ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.9rem',
                          fontWeight: '600'
                        }}
                      >
                        <span>{expandedItems[index] ? '▼' : '▶'}</span>
                        <span>{item.name || copy.itemNameLabel}</span>
                      </button>
                      {orderItems.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={!isEditable || submitting}
                          style={{ 
                            background: !isEditable ? 'var(--text-secondary)' : 'var(--status-cancelled)', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            padding: '4px 8px', 
                            fontSize: '0.8rem', 
                            cursor: (!isEditable || submitting) ? 'not-allowed' : 'pointer',
                            opacity: (!isEditable || submitting) ? 0.5 : 1
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    
                    {expandedItems[index] ? (
                      <>
                      {item.status && (
                        <div style={{ 
                          padding: '8px 12px', 
                          borderRadius: '6px', 
                          backgroundColor: isCollected ? 'var(--status-delivered)' : isRejected ? 'var(--status-rejected)' : 'var(--status-pending)', 
                          color: 'white', 
                          fontSize: '0.8rem', 
                          fontWeight: '600',
                          marginBottom: '12px',
                          display: 'inline-block'
                        }}>
                          {copy.statusLabel}: {translateStatus(item.status, language)}
                          {isCollected && ` (${copy.cannotEditOrRemoveCollectedItem})`}
                        </div>
                      )}
                      <div className="Order-item-row">
                        <label className="Order-item-vertical-label">{copy.itemNameLabel}</label>
                        <input
                          type="text"
                          required={isEditable}
                          value={item.name}
                          onChange={(e) => updateItem(index, 'name', e.target.value)}
                          placeholder={copy.itemNamePlaceholder}
                          disabled={!isEditable}
                          style={!isEditable ? { backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed' } : {}}
                          className="Order-item-input"
                        />
                      </div>
                    <div className="Order-item-row">
                      <label className="Order-item-vertical-label">{copy.quantityLabel}</label>
                      <input
                        type="number"
                        required={isEditable}
                        min="0.25"
                        step="0.05"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                        disabled={!isEditable}
                        style={!isEditable ? { backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed' } : {}}
                        className="Order-item-input"
                      />
                    </div>
                    <div className="Order-item-row">
                      <label className="Order-item-vertical-label">{copy.minPriceLabel}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.min_price}
                        onChange={(e) => updateItem(index, 'min_price', e.target.value)}
                        disabled={!isEditable}
                        style={!isEditable ? { backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed' } : {}}
                        className="Order-item-input"
                      />
                    </div>
                    <div className="Order-item-row">
                      <label className="Order-item-vertical-label">{copy.maxPriceLabel}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.max_price}
                        onChange={(e) => updateItem(index, 'max_price', e.target.value)}
                        disabled={!isEditable}
                        style={!isEditable ? { backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed' } : {}}
                        className="Order-item-input"
                      />
                    </div>
                    <div className="Order-item-row">
                      <label className="Order-item-vertical-label">{copy.recommendedPlaceLabel}</label>
                      <input
                        type="text"
                        value={item.recommended_place}
                        onChange={(e) => updateItem(index, 'recommended_place', e.target.value)}
                        placeholder={copy.recommendedPlacePlaceholder}
                        disabled={!isEditable}
                        style={!isEditable ? { backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed' } : {}}
                        className="Order-item-input"
                      />
                    </div>
                    <div className="Order-item-row">
                      <label className="Order-item-vertical-label">{copy.noteLabel}</label>
                      <input
                        type="text"
                        value={item.note}
                        onChange={(e) => updateItem(index, 'note', e.target.value)}
                        placeholder={copy.notePlaceholder}
                        disabled={!isEditable}
                        style={!isEditable ? { backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed' } : {}}
                        className="Order-item-input"
                      />
                    </div>
                    </>
                  ) : (
                  <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {item.name ? `${item.name} (Qty: ${item.quantity})` : copy.clickToEdit}
                    {item.status && (
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: isCollected ? 'var(--status-delivered)' : isRejected ? 'var(--status-rejected)' : 'var(--status-pending)',
                        color: 'white',
                        fontWeight: '500',
                        marginLeft: '8px'
                      }}>
                        {translateStatus(item.status, language)}
                      </span>
                    )}
                  </div>
                )}
                  </div>
                );
              })}
              
              <button 
                type="button" 
                className="Primary-btn" 
                onClick={addItem}
                disabled={submitting}
                style={{ 
                  marginTop: '16px', 
                  padding: '8px 16px', 
                  fontSize: '0.85rem',
                  width: '100%'
                }}
              >
                + {copy.addItem}
              </button>
            </div>

            {error && <p className="Auth-error" role="alert">{error}</p>}

            <div className="Action-row">
              <button 
                type="submit" 
                className="Primary-btn" 
                disabled={submitting}
              >
                {submitting ? copy.updatingOrder : copy.updateOrder}
              </button>
              <button
                type="button"
                className="Secondary-link"
                onClick={() => window.location.href = getLocalizedPath('/orders', language)}
                disabled={submitting}
                style={{
                  opacity: submitting ? 0.5 : 1,
                  cursor: submitting ? 'not-allowed' : 'pointer'
                }}
              >
                {copy.cancel}
              </button>
            </div>
          </form>
          </div>
        )}
      </section>
    </PageShell>
  );
}