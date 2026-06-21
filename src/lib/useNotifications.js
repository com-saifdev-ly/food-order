import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [channel, setChannel] = useState(null);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setNotifications(data || []);
      
      // Calculate unread count
      const unread = (data || []).filter(n => !n.read).length;
      setUnreadCount(unread);
      
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch unread count using the optimized function
  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase.rpc('get_unread_notification_count');
      
      if (error) throw error;
      
      setUnreadCount(data || 0);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [userId]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      
      // Decrement unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      return true;
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // Don't throw - let the caller handle the error gracefully
      return false;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      
      setUnreadCount(0);
      
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      throw err;
    }
  }, [userId]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      // First find the notification to update unread count
      const notificationToDelete = notifications.find(n => n.id === notificationId);
      const wasUnread = notificationToDelete && !notificationToDelete.read;

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Update unread count if the deleted notification was unread
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
    } catch (err) {
      console.error('Error deleting notification:', err);
      throw err;
    }
  }, [notifications]);

  // Set up real-time subscription
  useEffect(() => {
    if (!userId) return;

    // Clean up existing channel
    if (channel) {
      supabase.removeChannel(channel);
    }

    // Create new channel for notifications
    const notificationsChannel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newNotification = payload.new;
          
          // Add new notification to the list
          setNotifications(prev => [newNotification, ...prev]);
          
          // Increment unread count if new notification is unread
          if (!newNotification.read) {
            setUnreadCount(prev => prev + 1);
            
            // Show browser notification if supported
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(newNotification.title, {
                body: newNotification.body,
                icon: '/assets/logo.png'
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const updatedNotification = payload.new;
          
          // Update notification in the list
          setNotifications(prev => 
            prev.map(n => 
              n.id === updatedNotification.id ? updatedNotification : n
            )
          );
          
          // Update unread count if read status changed
          if (payload.old.read !== updatedNotification.read) {
            setUnreadCount(prev => 
              updatedNotification.read ? Math.max(0, prev - 1) : prev + 1
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const deletedNotification = payload.old;
          
          // Remove notification from the list
          setNotifications(prev => 
            prev.filter(n => n.id !== deletedNotification.id)
          );
          
          // Update unread count if deleted notification was unread
          if (!deletedNotification.read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    setChannel(notificationsChannel);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      supabase.removeChannel(notificationsChannel);
    };
  }, [userId]);

  // Initial fetch when userId changes
  useEffect(() => {
    if (userId) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
    }
  }, [userId, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications
  };
}
