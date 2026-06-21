import { supabase } from './supabase';

// ============ ORDERS ============

export async function createOrder(orderData) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_id: orderData.customer_id,
        delivery_id: orderData.delivery_id,
        title: orderData.title,
        description: orderData.description,
        delivery_address: orderData.delivery_address,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error creating order:', error);
    throw error;
  }
}

export async function getCustomerOrders(customerId) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        delivery_profile:profiles!orders_delivery_id_fkey (full_name, email, avatar_path)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error fetching customer orders:', error);
    throw error;
  }
}

export async function getOrderById(orderId) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        customer_profile:profiles!orders_customer_id_fkey (full_name, email, avatar_path),
        delivery_profile:profiles!orders_delivery_id_fkey (full_name, email, avatar_path)
      `)
      .eq('id', orderId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error fetching order by ID:', error);
    throw error;
  }
}

export async function getCustomerOrder(customerId, orderId) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        delivery_profile:profiles!orders_delivery_id_fkey (full_name, email, avatar_path)
      `)
      .eq('customer_id', customerId)
      .eq('id', orderId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error fetching customer order:', error);
    throw error;
  }
}

export async function getDeliveryOrders(deliveryId) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        customer_profile:profiles!orders_customer_id_fkey (full_name, email, avatar_path)
      `)
      .eq('delivery_id', deliveryId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data;
  } catch (error) {
    throw error;
  }
}

export async function getPendingOrders() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer_profile:profiles!orders_customer_id_fkey (full_name, email, avatar_path),
        order_items (*)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error fetching pending orders:', error);
    throw error;
  }
}

export async function updateOrderStatus(orderId, status) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error updating order status:', error);
    throw error;
  }
}

export async function cancelOrder(orderId, cancellationReason = null, cancelledBy = null) {
  const updateData = { status: 'cancelled' };
  
  if (cancellationReason) {
    updateData.cancellation_reason = cancellationReason;
  }
  
  if (cancelledBy) {
    updateData.cancelled_by = cancelledBy;
    updateData.cancelled_at = new Date().toISOString();
  }
  
  const { data, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function acceptOrder(orderId, deliveryId) {
  try {
    // Update order status to accepted
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status: 'accepted',
        delivery_id: deliveryId
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    // Create order assignment
    const { error: assignError } = await supabase
      .from('order_assignments')
      .insert({
        order_id: orderId,
        delivery_id: deliveryId,
      });

    if (assignError) throw assignError;

    return data;
  } catch (error) {
    throw error;('Error accepting order:', error);
    throw error;
  }
}

export async function updateOrder(orderId, orderData) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update(orderData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error updating order:', error);
    throw error;
  }
}

// ============ ORDER ITEMS ============

export async function createOrderItem(orderId, itemData) {
  try {
    const { data, error } = await supabase
      .from('order_items')
      .insert({
        order_id: orderId,
        name: itemData.name,
        quantity: itemData.quantity,
        min_price: itemData.min_price,
        max_price: itemData.max_price,
        recommended_place: itemData.recommended_place,
        note: itemData.note || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error creating order item:', error);
    throw error;
  }
}

export async function getOrderItems(orderId) {
  try {
    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error fetching order items:', error);
    throw error;
  }
}

export async function deleteOrderItem(itemId) {
  try {
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;('Error deleting order item:', error);
    throw error;
  }
}

export async function updateOrderItemStatus(itemId, status) {
  try {
    const { data, error } = await supabase
      .from('order_items')
      .update({ status })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error updating order item status:', error);
    throw error;
  }
}

export async function updateOrderItemStatusAndPrice(itemId, status, price) {
  try {
    const updateData = { status };
    if (price !== null && price !== undefined && price !== '') {
      updateData.price = parseFloat(price);
    }
    
    const { data, error } = await supabase
      .from('order_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error updating order item status and price:', error);
    throw error;
  }
}

export async function updateOrderItem(itemId, itemData) {
  try {
    const { data, error } = await supabase
      .from('order_items')
      .update(itemData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error updating order item:', error);
    throw error;
  }
}

// ============ DELIVERY REQUESTS ============

export async function createDeliveryRequest(customerId, deliveryId) {
  try {
    const { data, error } = await supabase
      .from('delivery_requests')
      .insert({
        customer_id: customerId,
        delivery_id: deliveryId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error creating delivery request:', error);
    throw error;
  }
}

export async function respondToDeliveryRequest(requestId, status) {
  try {
    const { data, error } = await supabase
      .from('delivery_requests')
      .update({ 
        status: status,
        responded_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error responding to delivery request:', error);
    throw error;
  }
}

export async function getCustomerDeliveryRequests(customerId) {
  try {
    const { data, error } = await supabase
      .from('delivery_requests')
      .select(`
        *,
        delivery_profile:profiles!delivery_requests_delivery_id_fkey (full_name, email, avatar_path)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error fetching customer delivery requests:', error);
    throw error;
  }
}

export async function getAcceptedDeliveryRequests(customerId) {
  try {
    const { data, error } = await supabase
      .from('delivery_requests')
      .select(`
        *,
        delivery_profile:profiles!delivery_requests_delivery_id_fkey (full_name, email, avatar_path)
      `)
      .eq('customer_id', customerId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error fetching accepted delivery requests:', error);
    throw error;
  }
}

export async function getDeliveryIncomingRequests(deliveryId) {
  try {
    const { data, error } = await supabase
      .from('delivery_requests')
      .select(`
        *,
        customer_profile:profiles!delivery_requests_customer_id_fkey (full_name, email, avatar_path)
      `)
      .eq('delivery_id', deliveryId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error fetching incoming delivery requests:', error);
    throw error;
  }
}

// ============ CUSTOMER DELIVERY LINKS ============

export async function createCustomerDeliveryLink(customerId, deliveryId) {
  try {
    const { data, error } = await supabase
      .from('customer_delivery_links')
      .insert({
        customer_id: customerId,
        delivery_id: deliveryId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error creating delivery link:', error);
    throw error;
  }
}

export async function cancelDeliveryRequest(requestId) {
  try {
    // First get the request to find customer_id and delivery_id
    const { data: request, error: fetchError } = await supabase
      .from('delivery_requests')
      .select('customer_id, delivery_id, status')
      .eq('id', requestId)
      .single();

    if (fetchError) throw fetchError;

    // Delete the request from delivery_requests table
    const { error: deleteError } = await supabase
      .from('delivery_requests')
      .delete()
      .eq('id', requestId);

    if (deleteError) throw deleteError;

    // If request was accepted, also remove the customer_delivery_links record
    if (request?.status === 'accepted' && request?.customer_id && request?.delivery_id) {
      const { error: linkError } = await supabase
        .from('customer_delivery_links')
        .delete()
        .eq('customer_id', request.customer_id)
        .eq('delivery_id', request.delivery_id);

      // Don't throw if link doesn't exist
      if (linkError && linkError.code !== 'PGRST116') {
        console.error('Error removing customer link:', linkError);
      }
    }

    return true;
  } catch (error) {
    throw error;
  }
}

export async function deleteCustomerDeliveryLink(customerId, deliveryId) {
  try {
    // Delete from customer_delivery_links
    const { error: linkError } = await supabase
      .from('customer_delivery_links')
      .delete()
      .eq('customer_id', customerId)
      .eq('delivery_id', deliveryId);

    if (linkError) throw linkError;

    // Update delivery_requests to 'rejected' instead of deleting
    const { error: requestError } = await supabase
      .from('delivery_requests')
      .update({ 
        status: 'rejected',
        responded_at: new Date().toISOString()
      })
      .eq('customer_id', customerId)
      .eq('delivery_id', deliveryId)
      .eq('status', 'pending'); // Only update pending requests

    // Don't throw error if request doesn't exist or is already processed
    if (requestError && requestError.code !== 'PGRST116') {
      // Silently handle error
    }

    return true;
  } catch (error) {
    throw error;
  }
}

export async function getCustomerDeliveryLinks(customerId) {
  try {
    const { data, error } = await supabase
      .from('customer_delivery_links')
      .select(`
        *,
        delivery_profile:profiles!customer_delivery_links_delivery_id_fkey (full_name, email, avatar_path)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error fetching customer delivery links:', error);
    throw error;
  }
}

export async function getDeliveryCustomerLinks(deliveryId) {
  try {
    const { data, error } = await supabase
      .from('customer_delivery_links')
      .select(`
        *,
        customer_profile:profiles!customer_delivery_links_customer_id_fkey (full_name, email, avatar_path)
      `)
      .eq('delivery_id', deliveryId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error fetching delivery customer links:', error);
    throw error;
  }
}

// ============ USER SEARCH ============

export async function searchDeliveryUsers(searchTerm) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_path')
      .eq('role', 'delivery')
      .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .limit(20);

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error searching delivery users:', error);
    throw error;
  }
}

export async function getUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_path')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error fetching user profile:', error);
    throw error;
  }
}

// ============ NOTIFICATIONS ============

export async function getNotifications(userId) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error fetching notifications:', error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;('Error marking notification as read:', error);
    throw error;
  }
}

export async function createNotification(userId, title, body) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: title,
        body: body,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;('Error creating notification:', error);
    throw error;
  }
}
