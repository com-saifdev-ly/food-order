-- ============================================
-- NOTIFICATION SYSTEM SETUP
-- ============================================

-- Drop existing notifications table if it exists (for clean setup)
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Create notifications table
CREATE TABLE public.notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  type text NOT NULL DEFAULT 'info',
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only read their own notifications
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- NOTE: No INSERT policy for users - all notifications must be created by triggers

-- ============================================
-- REALTIME SETUP
-- ============================================

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Enable realtime for orders (if not already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Enable realtime for order_items (if not already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- ============================================
-- TRIGGER FUNCTIONS FOR NOTIFICATIONS
-- ============================================

-- Function to create notification for order status changes
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_title text;
  notification_body text;
  notification_data jsonb;
  notification_type text;
  notify_user_id uuid;
BEGIN
  -- Only notify on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Determine notification details based on new status
    notification_type := 'order_update';
    
    CASE NEW.status
      WHEN 'accepted' THEN
        notification_title := 'Order Accepted';
        notification_body := 'Your order has been accepted by a delivery driver.';
        notification_data := jsonb_build_object(
          'order_id', NEW.id,
          'old_status', OLD.status,
          'new_status', NEW.status
        );
      WHEN 'in_progress' THEN
        notification_title := 'Order In Progress';
        notification_body := 'Your order is now being processed.';
        notification_data := jsonb_build_object(
          'order_id', NEW.id,
          'old_status', OLD.status,
          'new_status', NEW.status
        );
      WHEN 'delivered' THEN
        notification_title := 'Order Delivered';
        notification_body := 'Your order has been delivered successfully!';
        notification_data := jsonb_build_object(
          'order_id', NEW.id,
          'old_status', OLD.status,
          'new_status', NEW.status
        );
      WHEN 'cancelled' THEN
        notification_title := 'Order Cancelled';
        notification_body := 'Your order has been cancelled.';
        notification_data := jsonb_build_object(
          'order_id', NEW.id,
          'old_status', OLD.status,
          'new_status', NEW.status
        );
      ELSE
        notification_title := 'Order Status Updated';
        notification_body := 'Your order status is now: ' || NEW.status;
        notification_data := jsonb_build_object(
          'order_id', NEW.id,
          'old_status', OLD.status,
          'new_status', NEW.status
        );
    END CASE;
    
    -- Notify the customer
    INSERT INTO public.notifications (user_id, title, body, data, type)
    VALUES (
      NEW.customer_id,
      notification_title,
      notification_body,
      notification_data,
      notification_type
    );
    
    -- If there's a delivery driver, notify them too
    IF NEW.delivery_id IS NOT NULL AND OLD.delivery_id IS DISTINCT FROM NEW.delivery_id THEN
      INSERT INTO public.notifications (user_id, title, body, data, type)
      VALUES (
        NEW.delivery_id,
        'New Order Assigned',
        'You have been assigned to a new order.',
        jsonb_build_object(
          'order_id', NEW.id,
          'customer_id', NEW.customer_id
        ),
        'order_update'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for order updates (not just status changes)
CREATE OR REPLACE FUNCTION public.notify_order_update()
RETURNS TRIGGER AS $$
DECLARE
  notification_title text;
  notification_body text;
  notification_data jsonb;
  notification_type text;
  current_user_id uuid;
  target_user_id uuid;
  changes text[];
  change_details text;
BEGIN
  -- Skip if this is a status change (handled by another trigger)
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Skip if no actual changes
  IF OLD = NEW THEN
    RETURN NEW;
  END IF;
  
  -- Get current user from session
  current_user_id := auth.uid();
  
  -- Build detailed change message
  changes := ARRAY[]::text[];
  
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    changes := array_append(changes, 'Title changed from "' || COALESCE(OLD.title, 'none') || '" to "' || COALESCE(NEW.title, 'none') || '"');
  END IF;
  
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    changes := array_append(changes, 'Description updated');
  END IF;
  
  IF OLD.delivery_address IS DISTINCT FROM NEW.delivery_address THEN
    changes := array_append(changes, 'Delivery address changed to "' || COALESCE(NEW.delivery_address, 'none') || '"');
  END IF;
  
  IF OLD.delivery_id IS DISTINCT FROM NEW.delivery_id THEN
    changes := array_append(changes, 'Delivery driver reassigned');
  END IF;
  
  -- If we have changes, build the message
  IF array_length(changes, 1) > 0 THEN
    change_details := array_to_string(changes, ', ');
    
    -- Determine who to notify (the OTHER party, not the one making changes)
    IF current_user_id = NEW.customer_id THEN
      -- Customer edited order, notify delivery driver
      target_user_id := NEW.delivery_id;
      notification_title := 'Order Updated by Customer';
      notification_body := 'Customer updated order #' || NEW.id || ': ' || change_details;
    ELSIF current_user_id = NEW.delivery_id THEN
      -- Delivery driver edited order, notify customer
      target_user_id := NEW.customer_id;
      notification_title := 'Order Updated by Delivery Driver';
      notification_body := 'Delivery driver updated order #' || NEW.id || ': ' || change_details;
    ELSE
      -- System update, notify customer primarily
      target_user_id := NEW.customer_id;
      notification_title := 'Order Updated';
      notification_body := 'Order #' || NEW.id || ' updated: ' || change_details;
    END IF;
    
    -- Only notify if we have a target user
    IF target_user_id IS NOT NULL THEN
      notification_data := jsonb_build_object(
        'order_id', NEW.id,
        'updated_by', current_user_id,
        'changes', changes
      );
      notification_type := 'order_update';
      
      INSERT INTO public.notifications (user_id, title, body, data, type)
      VALUES (
        target_user_id,
        notification_title,
        notification_body,
        notification_data,
        notification_type
      );
      
      -- If it was a system update, also notify delivery driver
      IF current_user_id IS NULL OR (current_user_id != NEW.customer_id AND current_user_id != NEW.delivery_id) THEN
        IF NEW.delivery_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, title, body, data, type)
          VALUES (
            NEW.delivery_id,
            notification_title,
            notification_body,
            notification_data,
            notification_type
          );
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for order item changes
CREATE OR REPLACE FUNCTION public.notify_order_item_change()
RETURNS TRIGGER AS $$
DECLARE
  order_record RECORD;
  notification_title text;
  notification_body text;
  notification_data jsonb;
  notification_type text;
  current_user_id uuid;
  target_user_id uuid;
  changes text[];
  change_details text;
BEGIN
  -- Get order details
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  -- Get current user from session
  current_user_id := auth.uid();
  
  -- Handle different operations
  IF TG_OP = 'INSERT' THEN
    notification_type := 'item_added';
    changes := ARRAY[]::text[];
    
    -- Build detailed message for item addition
    changes := array_append(changes, 'Added "' || NEW.name || '" (Qty: ' || NEW.quantity || ')');
    IF NEW.min_price IS NOT NULL AND NEW.max_price IS NOT NULL THEN
      changes := array_append(changes, 'Price range: $' || NEW.min_price || ' - $' || NEW.max_price);
    END IF;
    IF NEW.recommended_place IS NOT NULL THEN
      changes := array_append(changes, 'Location: ' || NEW.recommended_place);
    END IF;
    
    change_details := array_to_string(changes, ', ');
    notification_data := jsonb_build_object(
      'order_id', NEW.order_id,
      'item_id', NEW.id,
      'item_name', NEW.name,
      'quantity', NEW.quantity,
      'changes', changes
    );
    
    -- Determine who to notify (the OTHER party, not the one adding the item)
    IF current_user_id = order_record.customer_id THEN
      -- Customer added item, notify delivery driver
      target_user_id := order_record.delivery_id;
      notification_title := 'Customer Added Item';
      notification_body := 'Customer added to order #' || NEW.order_id || ': ' || change_details;
    ELSIF current_user_id = order_record.delivery_id THEN
      -- Delivery driver added item, notify customer
      target_user_id := order_record.customer_id;
      notification_title := 'Delivery Driver Added Item';
      notification_body := 'Delivery driver added to order #' || NEW.order_id || ': ' || change_details;
    ELSE
      -- System update, notify customer primarily
      target_user_id := order_record.customer_id;
      notification_title := 'Item Added';
      notification_body := 'Added to order #' || NEW.order_id || ': ' || change_details;
    END IF;
    
    -- Send notification
    IF target_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, data, type)
      VALUES (
        target_user_id,
        notification_title,
        notification_body,
        notification_data,
        notification_type
      );
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      notification_type := 'item_update';
      changes := ARRAY[]::text[];
      changes := array_append(changes, 'Status changed from "' || OLD.status || '" to "' || NEW.status || '"');
      
      CASE NEW.status
        WHEN 'purchased' THEN
          notification_title := 'Item Purchased';
          notification_body := 'Item "' || NEW.name || '" purchased for order #' || NEW.order_id;
        WHEN 'not_found' THEN
          notification_title := 'Item Not Found';
          notification_body := 'Item "' || NEW.name || '" not found at ' || COALESCE(NEW.recommended_place, 'recommended location');
        ELSE
          notification_title := 'Item Status Updated';
          notification_body := 'Item "' || NEW.name || '" status updated to ' || NEW.status;
      END CASE;
      
      notification_data := jsonb_build_object(
        'order_id', NEW.order_id,
        'item_id', NEW.id,
        'item_name', NEW.name,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'changes', changes
      );
      
      -- Determine who to notify (the OTHER party, not the one updating the item)
      IF current_user_id = order_record.customer_id THEN
        -- Customer updated item, notify delivery driver
        target_user_id := order_record.delivery_id;
        notification_title := 'Customer Updated Item Status';
        notification_body := 'Customer updated "' || NEW.name || '" to ' || NEW.status;
      ELSIF current_user_id = order_record.delivery_id THEN
        -- Delivery driver updated item, notify customer
        target_user_id := order_record.customer_id;
        notification_title := 'Delivery Driver Updated Item Status';
        notification_body := 'Delivery driver updated "' || NEW.name || '" to ' || NEW.status;
      ELSE
        -- System update, notify both parties
        target_user_id := order_record.customer_id;
      END IF;
      
      -- Send notification
      IF target_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, data, type)
        VALUES (
          target_user_id,
          notification_title,
          notification_body,
          notification_data,
          notification_type
        );
        
        -- If system update, also notify delivery driver
        IF current_user_id IS NULL OR (current_user_id != order_record.customer_id AND current_user_id != order_record.delivery_id) THEN
          IF order_record.delivery_id IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, title, body, data, type)
            VALUES (
              order_record.delivery_id,
              notification_title,
              notification_body,
              notification_data,
              notification_type
            );
          END IF;
        END IF;
      END IF;
      
    -- Handle other updates (not status changes)
    ELSIF OLD IS DISTINCT FROM NEW THEN
      notification_type := 'item_update';
      changes := ARRAY[]::text[];
      
      IF OLD.name IS DISTINCT FROM NEW.name THEN
        changes := array_append(changes, 'Name changed from "' || COALESCE(OLD.name, 'none') || '" to "' || NEW.name || '"');
      END IF;
      IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
        changes := array_append(changes, 'Quantity changed from ' || OLD.quantity || ' to ' || NEW.quantity);
      END IF;
      IF OLD.min_price IS DISTINCT FROM NEW.min_price OR OLD.max_price IS DISTINCT FROM NEW.max_price THEN
        changes := array_append(changes, 'Price updated to $' || COALESCE(NEW.min_price, '0') || ' - $' || COALESCE(NEW.max_price, '0'));
      END IF;
      IF OLD.recommended_place IS DISTINCT FROM NEW.recommended_place THEN
        changes := array_append(changes, 'Location changed to "' || COALESCE(NEW.recommended_place, 'none') || '"');
      END IF;
      IF OLD.note IS DISTINCT FROM NEW.note THEN
        changes := array_append(changes, 'Note updated');
      END IF;
      
      change_details := array_to_string(changes, ', ');
      notification_data := jsonb_build_object(
        'order_id', NEW.order_id,
        'item_id', NEW.id,
        'item_name', NEW.name,
        'changes', changes
      );
      
      -- Determine who to notify (the OTHER party)
      IF current_user_id = order_record.customer_id THEN
        target_user_id := order_record.delivery_id;
        notification_title := 'Customer Updated Item Details';
        notification_body := 'Customer updated "' || NEW.name || '": ' || change_details;
      ELSIF current_user_id = order_record.delivery_id THEN
        target_user_id := order_record.customer_id;
        notification_title := 'Delivery Driver Updated Item Details';
        notification_body := 'Delivery driver updated "' || NEW.name || '": ' || change_details;
      ELSE
        target_user_id := order_record.customer_id;
        notification_title := 'Item Details Updated';
        notification_body := 'Updated "' || NEW.name || '": ' || change_details;
      END IF;
      
      -- Send notification
      IF target_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, data, type)
        VALUES (
          target_user_id,
          notification_title,
          notification_body,
          notification_data,
          notification_type
        );
      END IF;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Handle item deletion
    notification_type := 'item_deleted';
    changes := ARRAY[]::text[];
    changes := array_append(changes, 'Removed "' || OLD.name || '" (Qty: ' || OLD.quantity || ')');
    
    change_details := array_to_string(changes, ', ');
    notification_data := jsonb_build_object(
      'order_id', OLD.order_id,
      'item_id', OLD.id,
      'item_name', OLD.name,
      'changes', changes
    );
    
    -- Determine who to notify (the OTHER party)
    IF current_user_id = order_record.customer_id THEN
      target_user_id := order_record.delivery_id;
      notification_title := 'Customer Removed Item';
      notification_body := 'Customer removed from order #' || OLD.order_id || ': ' || change_details;
    ELSIF current_user_id = order_record.delivery_id THEN
      target_user_id := order_record.customer_id;
      notification_title := 'Delivery Driver Removed Item';
      notification_body := 'Delivery driver removed from order #' || OLD.order_id || ': ' || change_details;
    ELSE
      target_user_id := order_record.customer_id;
      notification_title := 'Item Removed';
      notification_body := 'Removed from order #' || OLD.order_id || ': ' || change_details;
    END IF;
    
    -- Send notification
    IF target_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, data, type)
      VALUES (
        target_user_id,
        notification_title,
        notification_body,
        notification_data,
        notification_type
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CREATE TRIGGERS
-- ============================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
DROP TRIGGER IF EXISTS on_order_update ON public.orders;
DROP TRIGGER IF EXISTS on_order_item_change ON public.order_items;

-- Create trigger for order status changes
CREATE TRIGGER on_order_status_change
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_status_change();

-- Create trigger for order updates (general updates, not status changes)
CREATE TRIGGER on_order_update
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_update();

-- Create trigger for order item changes
CREATE TRIGGER on_order_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_item_change();

-- ============================================
-- DELIVERY REQUEST NOTIFICATIONS
-- ============================================

-- Function to notify delivery request changes
CREATE OR REPLACE FUNCTION public.notify_delivery_request()
RETURNS TRIGGER AS $$
DECLARE
  requester_name text;
  requester_email text;
  requester_id uuid;
BEGIN
  -- Determine who is the requester based on operation
  IF TG_OP = 'INSERT' THEN
    requester_id := NEW.customer_id;
  ELSE
    requester_id := NEW.delivery_id;
  END IF;

  -- Fetch requester profile info
  SELECT full_name, email INTO requester_name, requester_email
  FROM public.profiles
  WHERE id = requester_id;

  -- Customer sent request
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body, data, type)
    VALUES (
      NEW.delivery_id,
      'New Delivery Request',
      COALESCE(requester_name, 'Unknown') || ' (' || COALESCE(requester_email, '') || ') sent you a delivery request',
      jsonb_build_object(
        'request_id', NEW.id,
        'customer_id', NEW.customer_id,
        'delivery_id', NEW.delivery_id,
        'requester_name', COALESCE(requester_name, 'Unknown'),
        'requester_email', COALESCE(requester_email, ''),
        'status', NEW.status,
        'action', 'delivery_request_created'
      ),
      'delivery_request_created'
    );
    RETURN NEW;
  END IF;

  -- Delivery accepted/rejected request
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, body, data, type)
    VALUES (
      NEW.customer_id,
      CASE WHEN NEW.status = 'accepted' THEN 'Delivery Request Accepted' ELSE 'Delivery Request Rejected' END,
      CASE WHEN NEW.status = 'accepted' THEN 'Your delivery request was accepted' ELSE 'Your delivery request was rejected' END,
      jsonb_build_object(
        'request_id', NEW.id,
        'customer_id', NEW.customer_id,
        'delivery_id', NEW.delivery_id,
        'requester_name', COALESCE(requester_name, 'Unknown'),
        'requester_email', COALESCE(requester_email, ''),
        'status', NEW.status,
        'action', CASE WHEN NEW.status = 'accepted' THEN 'delivery_request_accepted' ELSE 'delivery_request_rejected' END
      ),
      CASE WHEN NEW.status = 'accepted' THEN 'delivery_request_accepted' ELSE 'delivery_request_rejected' END
    );
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for delivery requests
DROP TRIGGER IF EXISTS on_delivery_request_change ON public.delivery_requests;
CREATE TRIGGER on_delivery_request_change
AFTER INSERT OR UPDATE ON public.delivery_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_delivery_request();

-- ============================================
-- HELPER FUNCTION FOR UNREAD COUNT
-- ============================================

-- Create a function to get unread notification count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.notifications
    WHERE user_id = auth.uid()
    AND read = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify the setup
SELECT 
  'Notifications table created' as status,
  COUNT(*) as table_exists
FROM information_schema.tables 
WHERE table_name = 'notifications';

SELECT 
  'RLS enabled' as status,
  COUNT(*) as rls_enabled
FROM information_schema.tables 
WHERE table_name = 'notifications' AND is_row_security = 'YES';

SELECT 
  'Policies created' as status,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'notifications';

SELECT 
  'Triggers created' as status,
  COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE event_object_table IN ('orders', 'order_items');

-- Show the created triggers
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers 
WHERE event_object_table IN ('orders', 'order_items')
ORDER BY event_object_table, trigger_name;
