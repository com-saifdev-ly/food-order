import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { translations, translateStatus, getLocalizedPath } from '../lib/i18n';

export function NotificationBell({ unreadCount, onClick, language = 'en' }) {
  const copy = translations[language];
  
  return (
    <button 
      type="button"
      className="Notification-bell"
      onClick={onClick}
      aria-label={copy.notifications}
    >
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      
      {unreadCount > 0 && (
        <span className="Notification-badge" aria-label={copy.unreadNotifications.replace('{count}', unreadCount)}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

export function NotificationDropdown({ 
  notifications, 
  unreadCount, 
  onMarkAsRead, 
  onMarkAllAsRead, 
  onDelete, 
  onClose,
  language = 'en',
  userRole = null
}) {
  const dropdownRef = useRef(null);
  const copy = translations[language];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleNotificationClick = async (notification) => {
    // Mark as read first, then navigate
    try {
      await onMarkAsRead(notification.id);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Continue with navigation even if mark-as-read fails
    }

    // Handle navigation based on notification type and user role
    if (notification.type === 'delivery_request_created') {
      // Delivery driver received a request - go to delivery requests page
      window.location.href = getLocalizedPath('/delivery-requests', language);
    } else if (notification.type === 'delivery_request_accepted' || notification.type === 'delivery_request_rejected') {
      // Customer got response - go to delivery network page
      window.location.href = getLocalizedPath('/delivery-network', language);
    } else if (notification.data?.order_id) {
      const orderId = notification.data.order_id;
      // Use role-based routing to determine which detail page to show
      if (userRole === 'delivery') {
        // For delivery users, we need to check the actual order status
        // since notification.data.status might not be available
        // If status is pending, go to available orders with highlight
        // If status is not pending (accepted, preparing, on_the_way, delivered), go to order detail
        const orderStatus = notification.data?.status;
        if (orderStatus === 'pending') {
          window.location.href = getLocalizedPath(`/available-orders?highlight=${orderId}`, language);
        } else if (!orderStatus) {
          // If status is not in notification data, fetch order to check
          try {
            const { data: order } = await supabase
              .from('orders')
              .select('status')
              .eq('id', orderId)
              .single();

            if (order) {
              if (order.status === 'pending') {
                window.location.href = getLocalizedPath(`/available-orders?highlight=${orderId}`, language);
              } else {
                // Order is accepted or further in process - go to delivery order detail
                window.location.href = getLocalizedPath(`/delivery-order-detail?order=${orderId}`, language);
              }
            } else {
              // Order not found, default to available orders
              window.location.href = getLocalizedPath(`/available-orders?highlight=${orderId}`, language);
            }
          } catch (error) {
            console.error('Error fetching order status:', error);
            // Default to available orders on error
            window.location.href = getLocalizedPath(`/available-orders?highlight=${orderId}`, language);
          }
        } else {
          // Order is accepted or further in process - go to delivery order detail
          window.location.href = getLocalizedPath(`/delivery-order-detail?order=${orderId}`, language);
        }
      } else {
        // Default to customer view for both customers and unknown roles
        window.location.href = getLocalizedPath(`/order-detail?order=${orderId}`, language);
      }
    }
  };

  return (
    <div className="Notification-dropdown" ref={dropdownRef}>
      <div className="Notification-header">
        <h3>{copy.notifications}</h3>
        {unreadCount > 0 && (
          <button 
            type="button"
            className="Notification-mark-all-read"
            onClick={onMarkAllAsRead}
          >
            {copy.markAllAsRead}
          </button>
        )}
      </div>

      <div className="Notification-list">
        {notifications.length === 0 ? (
          <div className="Notification-empty">
            <p>{copy.noNotifications}</p>
          </div>
        ) : (
          notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={() => handleNotificationClick(notification)}
              onMarkAsRead={() => onMarkAsRead(notification.id)}
              language={language}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NotificationItem({ notification, onClick, onMarkAsRead, language = 'en' }) {
  const copy = translations[language];
  
  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return copy.justNow;
    if (seconds < 3600) return copy.minutesAgo.replace('{count}', Math.floor(seconds / 60));
    if (seconds < 86400) return copy.hoursAgo.replace('{count}', Math.floor(seconds / 3600));
    return copy.daysAgo.replace('{count}', Math.floor(seconds / 86400));
  };

  // Extract data from notification first
  const data = notification.data || {};
  const orderTitle = data.order_title || data.order_id || notification.title;
  const itemName = data.item_name;
  
  // Fetch requester profile from customer_id or delivery_id
  const [requesterProfile, setRequesterProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  
  useEffect(() => {
    if (notification.type === 'delivery_request_created' && data.customer_id && !requesterProfile && !loadingProfile) {
      setLoadingProfile(true);
      supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', data.customer_id)
        .single()
        .then(({ data: profile }) => {
          if (profile) setRequesterProfile(profile);
          setLoadingProfile(false);
        })
        .catch(() => setLoadingProfile(false));
    }
    if ((notification.type === 'delivery_request_accepted' || notification.type === 'delivery_request_rejected') && data.delivery_id && !requesterProfile && !loadingProfile) {
      setLoadingProfile(true);
      supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', data.delivery_id)
        .single()
        .then(({ data: profile }) => {
          if (profile) setRequesterProfile(profile);
          setLoadingProfile(false);
        })
        .catch(() => setLoadingProfile(false));
    }
  }, [notification.type, data.customer_id, data.delivery_id]);
  
  const requesterName = requesterProfile?.full_name || data.requester_name || copy.unknown;
  const requesterEmail = requesterProfile?.email || data.requester_email || '';
  const hasRequesterInfo = requesterProfile?.full_name || data.requester_name;

  // Helper function to translate status values (now using imported function)
  const translatedStatus = translateStatus(data.status, language);

  // Format notification title and body based on type and data
  const getNotificationContent = () => {
    const status = translatedStatus;
    
    let title, body;
    
    switch (notification.type) {
      case 'order_created':
        title = copy.notificationOrderCreated?.replace('{orderTitle}', orderTitle) || notification.title;
        body = copy.notificationOrderCreatedBody || notification.body;
        break;
      case 'item_added':
        title = copy.notificationOrderUpdated?.replace('{orderTitle}', orderTitle) || notification.title;
        body = copy.notificationItemAdded?.replace('{itemName}', itemName) || notification.body;
        break;
      case 'item_update':
        title = copy.notificationOrderUpdated?.replace('{orderTitle}', orderTitle) || notification.title;
        body = copy.notificationItemStatusChanged?.replace('{itemName}', itemName).replace('{status}', status) || notification.body;
        break;
      case 'item_deleted':
        title = copy.notificationOrderUpdated?.replace('{orderTitle}', orderTitle) || notification.title;
        body = copy.notificationItemDeleted?.replace('{itemName}', itemName) || notification.body;
        break;
      case 'order_update':
        title = copy.notificationOrderUpdated?.replace('{orderTitle}', orderTitle) || notification.title;
        body = copy.notificationStatusChanged?.replace('{status}', status) || notification.body;
        break;
      case 'delivery_request_created':
        title = copy.notificationDeliveryRequestCreated || notification.title;
        if (hasRequesterInfo && requesterEmail) {
          body = copy.notificationDeliveryRequestCreatedBody
            ?.replace(/\{requesterName\}/g, requesterName)
            ?.replace(/\{requesterEmail\}/g, requesterEmail) || notification.body;
        } else {
          // Fallback when requester info is not available in notification data
          body = copy.notificationDeliveryRequestCreatedBodyFallback || 'A customer sent you a delivery request';
        }
        break;
        case 'delivery_request_accepted':
          title = copy.notificationDeliveryRequestAccepted || notification.title;
          if (hasRequesterInfo && requesterEmail) {
            body = (copy.notificationDeliveryRequestAcceptedBody || 'Your delivery request was accepted by {requesterName} ({requesterEmail})')
              .replace(/\{requesterName\}/g, requesterName)
              .replace(/\{requesterEmail\}/g, requesterEmail);
          } else {
            body = copy.notificationDeliveryRequestAcceptedBodyFallback || 'Your delivery request was accepted';
          }
          break;
        case 'delivery_request_rejected':
          title = copy.notificationDeliveryRequestRejected || notification.title;
          if (hasRequesterInfo && requesterEmail) {
            body = (copy.notificationDeliveryRequestRejectedBody || 'Your delivery request was rejected by {requesterName} ({requesterEmail})')
              .replace(/\{requesterName\}/g, requesterName)
              .replace(/\{requesterEmail\}/g, requesterEmail);
          } else {
            body = copy.notificationDeliveryRequestRejectedBodyFallback || 'Your delivery request was rejected';
          }
          break;
      default:
        title = notification.title;
        body = notification.body;
    }
    
    return { title, body };
  };

  const { title, body } = getNotificationContent();

  return (
    <div 
      className={`Notification-item ${!notification.read ? 'Notification-item--unread' : ''}`}
      onClick={onClick}
    >
      <div className="Notification-content">
        <div className="Notification-title-row">
          <h4 className="Notification-title">{title}</h4>
          {!notification.read && <span className="Notification-dot" />}
        </div>
        <p className="Notification-body">{body}</p>
        <span className="Notification-time">{getTimeAgo(notification.created_at)}</span>
      </div>
      
      {!notification.read && (
        <button
          type="button"
          className="Notification-mark-read"
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsRead(notification.id);
          }}
          aria-label={copy.markAsRead}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function Toast({ notification, onClose, autoCloseDelay = 10000, language = 'en' }) {
  const copy = translations[language];
  
  useEffect(() => {
    const timer = setTimeout(onClose, autoCloseDelay);
    return () => clearTimeout(timer);
  }, [onClose, autoCloseDelay]);

  // Extract data from notification first
  const data = notification.data || {};
  const orderTitle = data.order_title || data.order_id || notification.title;
  const itemName = data.item_name;
  
  // Fetch requester profile from customer_id or delivery_id
  const [requesterProfile, setRequesterProfile] = useState(null);
  
  useEffect(() => {
    if (notification.type === 'delivery_request_created' && data.customer_id && !requesterProfile) {
      supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', data.customer_id)
        .single()
        .then(({ data: profile }) => {
          if (profile) setRequesterProfile(profile);
        })
        .catch(() => {});
    }
    if ((notification.type === 'delivery_request_accepted' || notification.type === 'delivery_request_rejected') && data.delivery_id && !requesterProfile) {
      supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', data.delivery_id)
        .single()
        .then(({ data: profile }) => {
          if (profile) setRequesterProfile(profile);
        })
        .catch(() => {});
    }
  }, [notification.type, data.customer_id, data.delivery_id]);
  
  const requesterName = requesterProfile?.full_name || data.requester_name || copy.unknown;
  const requesterEmail = requesterProfile?.email || data.requester_email || '';
  const hasRequesterInfo = requesterProfile?.full_name || data.requester_name;

  // Helper function to translate status values (now using imported function)
  const translatedStatus = translateStatus(data.status, language);

  // Format notification title and body based on type and data
  const getNotificationContent = () => {
    const status = translatedStatus;
    
    let title, body;
    
    switch (notification.type) {
      case 'order_created':
        title = copy.notificationOrderCreated?.replace('{orderTitle}', orderTitle) || notification.title;
        body = copy.notificationOrderCreatedBody || notification.body;
        break;
      case 'item_added':
        title = copy.notificationOrderUpdated?.replace('{orderTitle}', orderTitle) || notification.title;
        body = copy.notificationItemAdded?.replace('{itemName}', itemName) || notification.body;
        break;
      case 'item_update':
        title = copy.notificationOrderUpdated?.replace('{orderTitle}', orderTitle) || notification.title;
        body = copy.notificationItemStatusChanged?.replace('{itemName}', itemName).replace('{status}', status) || notification.body;
        break;
      case 'item_deleted':
        title = copy.notificationOrderUpdated?.replace('{orderTitle}', orderTitle) || notification.title;
        body = copy.notificationItemDeleted?.replace('{itemName}', itemName) || notification.body;
        break;
      case 'order_update':
        title = copy.notificationOrderUpdated?.replace('{orderTitle}', orderTitle) || notification.title;
        body = copy.notificationStatusChanged?.replace('{status}', status) || notification.body;
        break;
      case 'delivery_request_created':
        title = copy.notificationDeliveryRequestCreated || notification.title;
        if (hasRequesterInfo && requesterEmail) {
          body = copy.notificationDeliveryRequestCreatedBody
            ?.replace('{requesterName}', requesterName)
            ?.replace('{requesterEmail}', requesterEmail) || notification.body;
        } else {
          // Fallback when requester info is not available in notification data
          body = copy.notificationDeliveryRequestCreatedBodyFallback || 'A customer sent you a delivery request';
        }
        break;
      case 'delivery_request_accepted':
        title = copy.notificationDeliveryRequestAccepted || notification.title;
        if (hasRequesterInfo && requesterEmail) {
          body = (copy.notificationDeliveryRequestAcceptedBody || 'Your delivery request was accepted by {requesterName} ({requesterEmail})')
            .replace(/\{requesterName\}/g, requesterName)
            .replace(/\{requesterEmail\}/g, requesterEmail);
        } else {
          body = copy.notificationDeliveryRequestAcceptedBodyFallback || 'Your delivery request was accepted';
        }
        break;
      case 'delivery_request_rejected':
        title = copy.notificationDeliveryRequestRejected || notification.title;
        if (hasRequesterInfo && requesterEmail) {
          body = (copy.notificationDeliveryRequestRejectedBody || 'Your delivery request was rejected by {requesterName} ({requesterEmail})')
            .replace(/\{requesterName\}/g, requesterName)
            .replace(/\{requesterEmail\}/g, requesterEmail);
        } else {
          body = copy.notificationDeliveryRequestRejectedBodyFallback || 'Your delivery request was rejected';
        }
        break;
      default:
        title = notification.title;
        body = notification.body;
    }
    
    return { title, body };
  };

  const { title, body } = getNotificationContent();

  return (
    <div className="Toast Toast--enter">
      <div className="Toast-icon">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div className="Toast-content">
        <h4 className="Toast-title">{title}</h4>
        <p className="Toast-message">{body}</p>
      </div>
      <button
        type="button"
        className="Toast-close"
        onClick={onClose}
        aria-label={copy.close}
      >
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export function NotificationContainer({ toasts, removeToast, language = 'en' }) {
  return (
    <div className="Notification-container">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          notification={toast.notification}
          onClose={() => removeToast(toast.id)}
          language={language}
        />
      ))}
    </div>
  );
}
