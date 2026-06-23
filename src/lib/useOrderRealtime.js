import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export function useOrderRealtime(orderId, userId, userRole) {
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [channel, setChannel] = useState(null);

  // Fetch initial order data
  const fetchOrderData = useCallback(async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      setOrder(orderData);
      setOrderItems(itemsData || []);

    } catch (err) {
      console.error('Error fetching order data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Set up real-time subscription for order updates
  useEffect(() => {
    if (!orderId) return;

    // Clean up existing channel
    if (channel) {
      supabase.removeChannel(channel);
    }

    // Create new channel for order and order_items
    const orderChannel = supabase
      .channel(`order:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          console.log('Order update received:', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            // Merge the update with existing order data to preserve any additional fields
            setOrder(prevOrder => ({
              ...prevOrder,
              ...payload.new
            }));
          } else if (payload.eventType === 'DELETE') {
            setOrder(null);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          console.log('Order items update received:', payload);
          if (payload.eventType === 'INSERT') {
            setOrderItems(prev => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setOrderItems(prev =>
              prev.map(item =>
                item.id === payload.new.id ? payload.new : item
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setOrderItems(prev =>
              prev.filter(item => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    setChannel(orderChannel);

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [orderId]);

  // Initial fetch when orderId changes
  useEffect(() => {
    if (orderId) {
      fetchOrderData();
    } else {
      setOrder(null);
      setOrderItems([]);
      setLoading(false);
    }
  }, [orderId, fetchOrderData]);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchOrderData();
  }, [fetchOrderData]);

  return {
    order,
    orderItems,
    loading,
    error,
    refresh
  };
}
