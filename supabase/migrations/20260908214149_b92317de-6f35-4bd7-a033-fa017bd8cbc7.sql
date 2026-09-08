ALTER TABLE public.alarms REPLICA IDENTITY FULL;
ALTER TABLE public.alarm_comments REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.alarms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alarm_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;