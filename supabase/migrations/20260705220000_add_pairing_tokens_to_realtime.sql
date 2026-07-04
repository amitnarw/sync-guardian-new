-- Add pairing_tokens to realtime so the child device gets notified
-- when the parent claims the token via claim-pairing-token edge function
ALTER PUBLICATION supabase_realtime ADD TABLE pairing_tokens;
