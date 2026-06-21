-- ============================================
-- QUICK FIX FOR NOTIFICATION SYSTEM
-- Run this script in Supabase SQL Editor
-- ============================================

-- Step 1: Drop existing triggers
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
DROP TRIGGER IF EXISTS on_order_update ON public.orders;
DROP TRIGGER IF EXISTS on_order_item_change ON public.order_items;

-- Step 2: Drop existing functions
DROP FUNCTION IF EXISTS public.notify_order_status_change();
DROP FUNCTION IF EXISTS public.notify_order_update();
DROP FUNCTION IF EXISTS public.notify_order_item_change();

-- Step 3: Create simplified order update notification function
CREATE OR REPLACE FUNCTION public.notify_order_update()
RETURNS TRIGGER AS $$
DECLARE
  notification_title text;
  notification_body text;
  notification_data jsonb;
  notification_type text;
  current_user_id uuid;
  target_user_id uuid;
BEGIN
  -- Skip if no actual changes
  IF OLD = NEW THEN
    RETURN NEW;
  END IF;
  
  -- Get current user from session
  current_user_id := auth.uid();
  
  -- Simple change detection and notification
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    IF current_user_id = NEW.customer_id THEN
      target_user_id := NEW.delivery_id;
      notification_title := 'Customer Updated Order Title';
      notification_body := 'Customer changed order title to: ' || NEW.title;
    ELSIF current_user_id = NEW.delivery_id THEN
      target_user_id := NEW.customer_id;
      notification_title := 'Delivery Driver Updated Order Title';
      notification_body := 'Delivery driver changed order title to: ' || NEW.title;
    ELSE
      -- System change, notify both
      target_user_id := NEW.customer_id;
      notification_title := 'Order Title Updated';
      notification_body := 'Order title changed to: ' || NEW.title;
    END IF;
    
    notification_type := 'order_update';
    notification_data := jsonb_build_object(
      'order_id', NEW.id,
      'field_changed', 'title',
      'old_value', OLD.title,
      'new_value', NEW.title,
      'updated_by', current_user_id
    );
    
    -- Send notification
    IF target_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, data, type)
      VALUES (target_user_id, notification_title, notification_body, notification_data, notification_type);
      
      -- If system change, also notify delivery driver
      IF current_user_id IS NULL AND NEW.delivery_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, data, type)
        VALUES (NEW.delivery_id, notification_title, notification_body, notification_data, notification_type);
      END IF;
    END IF;
  END IF;
  
  -- Handle description changes
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    IF current_user_id = NEW.customer_id THEN
      target_user_id := NEW.delivery_id;
      notification_title := 'Customer Updated Description';
      notification_body := 'Customer updated the order description';
    ELSIF current_user_id = NEW.delivery_id THEN
      target_user_id := NEW.customer_id;
      notification_title := 'Delivery Driver Updated Description';
      notification_body := 'Delivery driver updated the order description';
    ELSE
      target_user_id := NEW.customer_id;
      notification_title := 'Description Updated';
      notification_body := 'Order description was updated';
    END IF;
    
    notification_type := 'order_update';
    notification_data := jsonb_build_object(
      'order_id', NEW.id,
      'field_changed', 'description',
      'updated_by', current_user_id
    );
    
    IF target_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, data, type)
      VALUES (target_user_id, notification_title, notification_body, notification_data, notification_type);
    END IF;
  END IF;
  
  -- Handle address changes
  IF OLD.delivery_address IS DISTINCT FROM NEW.delivery_address THEN
    IF current_user_id = NEW.customer_id THEN
      target_user_id := NEW.delivery_id;
      notification_title := 'Customer Changed Delivery Address';
      notification_body := 'Customer changed delivery address to: ' || NEW.delivery_address;
    ELSIF current_user_id = NEW.delivery_id THEN
      target_user_id := NEW.customer_id;
      notification_title := 'Delivery Driver Changed Delivery Address';
      notification_body := 'Delivery driver changed delivery address to: ' || NEW.delivery_address;
    ELSE
      target_user_id := NEW.customer_id;
      notification_title := 'Delivery Address Changed';
      notification_body := 'Delivery address changed to: ' || NEW.delivery_address;
    END IF;
    
    notification_type := 'order_update';
    notification_data := jsonb_build_object(
      'order_id', NEW.id,
      'field_changed', 'delivery_address',
      'old_address', OLD.delivery_address,
      'new_address', NEW.delivery_address,
      'updated_by', current_user_id
    );
    
    IF target_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, data, type)
      VALUES (target_user_id, notification_title, notification_body, notification_data, notification_type);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create simplified order item notification function
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
BEGIN
  -- Get order details
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  -- Get current user from session
  current_user_id := auth.uid();
  
  -- Handle INSERT (new item added)
  IF TG_OP = 'INSERT' THEN
    notification_type := 'item_added';
    
    IF current_user_id = order_record.customer_id THEN
      target_user_id := order_record.delivery_id;
      notification_title := 'Customer Added Item';
      notification_body := 'Customer added: ' || NEW.name || ' (Quantity: ' || NEW.quantity || ')';
    ELSIF current_user_id = order_record.delivery_id THEN
      target_user_id := order_record.customer_id;
      notification_title := 'Delivery Driver Added Item';
      notification_body := 'Delivery driver added: ' || NEW.name || ' (Quantity: ' || NEW.quantity || ')';
    ELSE
      target_user_id := order_record.customer_id;
      notification_title := 'Item Added';
      notification_body := 'Added: ' || NEW.name || ' (Quantity: ' || NEW.quantity || ')';
    END IF;
    
    notification_data := jsonb_build_object(
      'order_id', NEW.order_id,
      'item_id', NEW.id,
      'item_name', NEW.name,
      'quantity', NEW.quantity,
      'updated_by', current_user_id
    );
    
    IF target_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, data, type)
      VALUES (target_user_id, notification_title, notification_body, notification_data, notification_type);
    END IF;
  
  -- Handle UPDATE (item changed)
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      notification_type := 'item_update';
      
      IF current_user_id = order_record.customer_id THEN
        target_user_id := order_record.delivery_id;
        notification_title := 'Customer Updated Item Status';
        notification_body := 'Customer updated ' || NEW.name || ' to: ' || NEW.status;
      ELSIF current_user_id = order_record.delivery_id THEN
        target_user_id := order_record.customer_id;
        notification_title := 'Delivery Driver Updated Item Status';
        notification_body := 'Delivery driver updated ' || NEW.name || ' to: ' || NEW.status;
      ELSE
        target_user_id := order_record.customer_id;
        notification_title := 'Item Status Updated';
        notification_body := NEW.name || ' status changed to: ' || NEW.status;
      END IF;
      
      notification_data := jsonb_build_object(
        'order_id', NEW.order_id,
        'item_id', NEW.id,
        'item_name', NEW.name,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'updated_by', current_user_id
      );
      
      IF target_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, data, type)
        VALUES (target_user_id, notification_title, notification_body, notification_data, notification_type);
      END IF;
    END IF;
  
  -- Handle DELETE (item removed)
  ELSIF TG_OP = 'DELETE' THEN
    notification_type := 'item_deleted';
    
    IF current_user_id = order_record.customer_id THEN
      target_user_id := order_record.delivery_id;
      notification_title := 'Customer Removed Item';
      notification_body := 'Customer removed: ' || OLD.name;
    ELSIF current_user_id = order_record.delivery_id THEN
      target_user_id := order_record.customer_id;
      notification_title := 'Delivery Driver Removed Item';
      notification_body := 'Delivery driver removed: ' || OLD.name;
    ELSE
      target_user_id := order_record.customer_id;
      notification_title := 'Item Removed';
      notification_body := 'Removed: ' || OLD.name;
    END IF;
    
    notification_data := jsonb_build_object(
      'order_id', OLD.order_id,
      'item_id', OLD.id,
      'item_name', OLD.name,
      'updated_by', current_user_id
    );
    
    IF target_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, data, type)
      VALUES (target_user_id, notification_title, notification_body, notification_data, notification_type);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create delivery request notification function
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
  END if;

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

-- Step 6: Create trigger for delivery requests
CREATE TRIGGER on_delivery_request_change
AFTER INSERT OR UPDATE ON public.delivery_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_delivery_request();

-- Step 7: Recreate triggers
CREATE TRIGGER on_order_update
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_update();

CREATE TRIGGER on_order_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_item_change();

-- Step 6: Verify installation
SELECT 
  'Functions created' as status,
  COUNT(*) as function_count
FROM pg_proc 
WHERE proname LIKE 'notify_%';

SELECT 
  'Triggers created' as status,
  COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE event_object_table IN ('orders', 'order_items');

-- Step 7: Test notification creation (this will create a test notification)
DO $$
DECLARE
  test_order_id INTEGER;
  test_user_id UUID;
BEGIN
  -- Get a random user ID from profiles
  SELECT id INTO test_user_id FROM public.profiles LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, data, type)
    VALUES (
      test_user_id,
      'Notification System Test',
      'If you see this, the notification system is working!',
      '{"test": true, "timestamp": now()}'::jsonb,
      'info'
    );
    
    RAISE NOTICE 'Test notification created for user: %', test_user_id;
  ELSE
    RAISE NOTICE 'No users found to create test notification';
  END IF;
END $$;
