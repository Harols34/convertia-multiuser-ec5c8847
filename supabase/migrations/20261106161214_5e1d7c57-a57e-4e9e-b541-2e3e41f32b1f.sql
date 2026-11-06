CREATE TABLE public.cron (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  total_users integer NOT NULL DEFAULT 0,
  total_alarms integer NOT NULL DEFAULT 0,
  open_alarms integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cron TO authenticated;
GRANT ALL ON public.cron TO service_role;
ALTER TABLE public.cron ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view cron" ON public.cron FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.record_cron_snapshot()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.cron (run_date, total_users, total_alarms, open_alarms, note)
  VALUES (
    CURRENT_DATE,
    (SELECT count(*) FROM public.end_users WHERE active = true),
    (SELECT count(*) FROM public.alarms),
    (SELECT count(*) FROM public.alarms WHERE status IN ('abierta','en_proceso','pendiente_informacion')),
    'Registro automático cada 3 días'
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.record_cron_snapshot() FROM PUBLIC, anon, authenticated;