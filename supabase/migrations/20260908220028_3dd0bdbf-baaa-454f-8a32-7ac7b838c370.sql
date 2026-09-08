ALTER TABLE public.cia_conversations ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Nueva conversación';
ALTER TABLE public.cia_conversations ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS cia_conversations_user_idx ON public.cia_conversations (end_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS cia_messages_conv_idx ON public.cia_messages (conversation_id, created_at);