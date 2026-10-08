ALTER TYPE public.alarm_status ADD VALUE IF NOT EXISTS 'pendiente_informacion';

ALTER TABLE public.alarm_comments
  ADD COLUMN IF NOT EXISTS author_type text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS end_user_id uuid REFERENCES public.end_users(id) ON DELETE SET NULL;

GRANT SELECT, INSERT ON public.alarm_comments TO anon;
CREATE POLICY "End users can add alarm comments" ON public.alarm_comments
  FOR INSERT TO anon WITH CHECK (author_type IN ('staff','user','bot') AND end_user_id IS NOT NULL);

-- Trazabilidad
CREATE TABLE public.alarm_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alarm_id uuid NOT NULL REFERENCES public.alarms(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  old_value text,
  new_value text,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.alarm_events TO anon;
GRANT SELECT ON public.alarm_events TO authenticated;
GRANT ALL ON public.alarm_events TO service_role;
ALTER TABLE public.alarm_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view alarm events" ON public.alarm_events FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX alarm_events_alarm_idx ON public.alarm_events(alarm_id, created_at);

CREATE OR REPLACE FUNCTION public.log_alarm_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor text;
BEGIN
  SELECT full_name INTO v_actor FROM public.profiles WHERE id = auth.uid();
  IF v_actor IS NULL THEN v_actor := 'Usuario portal / C-IA'; END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.alarm_events(alarm_id, event_type, new_value, actor_name)
    VALUES (NEW.id, 'created', NEW.status::text, v_actor);
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.alarm_events(alarm_id, event_type, old_value, new_value, actor_name)
      VALUES (NEW.id, 'status', OLD.status::text, NEW.status::text, v_actor);
    END IF;
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.alarm_events(alarm_id, event_type, old_value, new_value, actor_name)
      VALUES (NEW.id, 'assigned',
        (SELECT full_name FROM public.profiles WHERE id = OLD.assigned_to),
        (SELECT full_name FROM public.profiles WHERE id = NEW.assigned_to), v_actor);
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.alarm_events(alarm_id, event_type, old_value, new_value, actor_name)
      VALUES (NEW.id, 'priority', OLD.priority, NEW.priority, v_actor);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_alarm_event() FROM anon, authenticated, public;

CREATE TRIGGER alarms_log_events AFTER INSERT OR UPDATE ON public.alarms
  FOR EACH ROW EXECUTE FUNCTION public.log_alarm_event();

-- Configuración de atención
CREATE TABLE public.support_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timezone text NOT NULL DEFAULT 'America/Bogota',
  work_days int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  start_time text NOT NULL DEFAULT '08:00',
  end_time text NOT NULL DEFAULT '17:00',
  cutoff_time text NOT NULL DEFAULT '14:00',
  schedule_message text NOT NULL DEFAULT 'Nuestro horario de atención es de lunes a viernes de 8:00 a. m. a 5:00 p. m.',
  before_cutoff_message text NOT NULL DEFAULT 'Tu solicitud fue registrada antes de las 2:00 p. m., será gestionada y, de ser posible, respondida durante el día de hoy.',
  after_cutoff_message text NOT NULL DEFAULT 'Tu solicitud fue registrada después de las 2:00 p. m., será validada y tendrá respuesta a partir del siguiente día hábil.',
  non_working_message text NOT NULL DEFAULT 'Tu solicitud fue registrada fuera del horario hábil y será atendida a partir del siguiente día hábil.',
  urgent_message text NOT NULL DEFAULT '🚨 Identificamos tu solicitud como URGENTE. Quedó registrada y estamos contactando al Administrador responsable.',
  urgent_keywords text[] NOT NULL DEFAULT '{urgente,urgencia,inmediato,bloqueado,caído,caida}',
  notify_admins boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.support_settings TO authenticated;
GRANT ALL ON public.support_settings TO service_role;
ALTER TABLE public.support_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read support settings" ON public.support_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage support settings" ON public.support_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER support_settings_updated_at BEFORE UPDATE ON public.support_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.support_settings DEFAULT VALUES;

ALTER PUBLICATION supabase_realtime ADD TABLE public.alarm_events;