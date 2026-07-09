-- Enable Realtime for pairs table so use-pair-status-guard subscriptions fire
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pairs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pairs;
  END IF;
END $$;
