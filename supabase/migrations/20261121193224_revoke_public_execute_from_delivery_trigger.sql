-- Internal trigger function: it must run only through the postage_trackings trigger.
-- Prevent direct RPC execution by anon/authenticated roles; trigger execution remains installed.
REVOKE EXECUTE ON FUNCTION public.sync_delivered_batch_to_claim_queue()
FROM PUBLIC, anon, authenticated;
