-- ============================================
-- TEST SCRIPT: Check if notifications table exists
-- ============================================

-- Check if notifications table exists
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Notifications table EXISTS'
    ELSE '❌ Notifications table DOES NOT EXIST - You need to run setup_notifications.sql'
  END as table_status
FROM information_schema.tables 
WHERE table_name = 'notifications';

-- If table exists, show its structure
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    RAISE NOTICE 'Notifications table structure:';
    FOR column_info IN 
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position
    LOOP
      RAISE NOTICE '  - %: % (nullable: %)', column_info.column_name, column_info.data_type, column_info.is_nullable;
    END LOOP;
  END IF;
END $$;

-- Check if RLS is enabled
SELECT 
  CASE 
    WHEN is_row_security = 'YES' THEN '✅ RLS is ENABLED'
    ELSE '❌ RLS is NOT ENABLED'
  END as rls_status
FROM information_schema.tables 
WHERE table_name = 'notifications';

-- Check if policies exist
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ RLS policies exist'
    ELSE '❌ No RLS policies found'
  END as policy_status,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'notifications';

-- Check if triggers exist
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Notification triggers exist'
    ELSE '❌ No notification triggers found'
  END as trigger_status,
  COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE event_object_table IN ('orders', 'order_items');

-- Try to count notifications (this will fail if table doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    EXECUTE 'SELECT COUNT(*) FROM notifications' INTO notification_count;
    RAISE NOTICE 'Current notification count: %', notification_count;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Cannot count notifications (table may not exist or permissions issue)';
END $$;
