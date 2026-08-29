-- Keep owner-scoped symptom-confirmation lookups efficient as chat history grows.
-- This is intentionally a follow-up migration: the table was already deployed
-- through the targeted production migration workflow.
CREATE INDEX IF NOT EXISTS chat_symptom_confirmations_conversation_id_idx
  ON public.chat_symptom_confirmations (conversation_id);
