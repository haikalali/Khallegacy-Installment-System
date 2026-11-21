REVOKE EXECUTE ON FUNCTION public.dispatch_agreement_to_jcl(bigint, text, text, date, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_jcl_agreement_receipt(bigint, date, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_jcl_agreement_dispatch_queue() FROM PUBLIC, anon, authenticated;
