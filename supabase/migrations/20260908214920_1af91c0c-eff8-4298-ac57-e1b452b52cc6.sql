
ALTER TABLE public.end_users ADD COLUMN IF NOT EXISTS campaign text;
ALTER TABLE public.end_users ADD COLUMN IF NOT EXISTS bot_role text NOT NULL DEFAULT 'colaborador';

CREATE TABLE public.cia_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign text,
  role_key text,
  enabled boolean NOT NULL DEFAULT true,
  bot_name text NOT NULL DEFAULT 'C-IA',
  initial_message text NOT NULL DEFAULT 'Hola 👋 Soy C-IA. Tu asistente inteligente de usuarios.',
  allow_free_text boolean NOT NULL DEFAULT false,
  use_guided_menu boolean NOT NULL DEFAULT true,
  temperature numeric NOT NULL DEFAULT 0.3,
  max_tokens integer NOT NULL DEFAULT 800,
  unknown_message text NOT NULL DEFAULT 'No tengo información suficiente para responder eso. Por favor reporta una novedad o contacta a Mesa de Ayuda.',
  unauthorized_message text NOT NULL DEFAULT 'Solo puedo darte información de tu propio usuario.',
  system_prompt text NOT NULL DEFAULT '',
  data_scope text NOT NULL DEFAULT 'own',
  tools jsonb NOT NULL DEFAULT '{"credentials":true,"access_status":true,"my_alarms":true,"alarm_detail":true,"comments":true,"last_update":true,"sla":true,"guidance":true,"tips":true,"rag":true,"create_alarm":false,"other_users":false,"free_ai":false}'::jsonb,
  visible_application_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cia_configs_scope_uidx ON public.cia_configs (
  COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(campaign, ''),
  COALESCE(role_key, '')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cia_configs TO authenticated;
GRANT ALL ON public.cia_configs TO service_role;
ALTER TABLE public.cia_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage cia_configs" ON public.cia_configs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.cia_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign text,
  roles text[] NOT NULL DEFAULT '{}',
  application_id uuid,
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cia_knowledge TO authenticated;
GRANT ALL ON public.cia_knowledge TO service_role;
ALTER TABLE public.cia_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage cia_knowledge" ON public.cia_knowledge FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.cia_sla (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign text,
  application_name text NOT NULL,
  novelty_type text NOT NULL,
  min_days integer NOT NULL DEFAULT 1,
  max_days integer NOT NULL DEFAULT 2,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cia_sla TO authenticated;
GRANT ALL ON public.cia_sla TO service_role;
ALTER TABLE public.cia_sla ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage cia_sla" ON public.cia_sla FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.cia_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  end_user_id uuid NOT NULL REFERENCES public.end_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cia_conversations TO authenticated;
GRANT ALL ON public.cia_conversations TO service_role;
ALTER TABLE public.cia_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read cia_conversations" ON public.cia_conversations FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE public.cia_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.cia_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cia_messages TO authenticated;
GRANT ALL ON public.cia_messages TO service_role;
ALTER TABLE public.cia_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read cia_messages" ON public.cia_messages FOR SELECT TO authenticated USING (public.is_admin());

CREATE TRIGGER cia_configs_updated_at BEFORE UPDATE ON public.cia_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cia_knowledge_updated_at BEFORE UPDATE ON public.cia_knowledge FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cia_sla_updated_at BEFORE UPDATE ON public.cia_sla FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.cia_configs (company_id, campaign, role_key, system_prompt)
VALUES (NULL, NULL, NULL, 'Eres C-IA, el asistente inteligente de usuarios de la plataforma. Responde SOLO con la información real entregada en el contexto. Nunca inventes datos, usuarios, casos, fechas ni estados. Nunca muestres contraseñas. Si no tienes el dato, dilo claramente. Responde en español, breve y profesional.');
