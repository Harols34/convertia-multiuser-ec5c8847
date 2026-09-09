-- 1. Access roles table
CREATE TABLE public.access_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  can_create_tickets boolean NOT NULL DEFAULT false,
  can_view_all_company_tickets boolean NOT NULL DEFAULT false,
  visible_modules jsonb NOT NULL DEFAULT '["applications","alarms","chat"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.access_roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_roles TO authenticated;
GRANT ALL ON public.access_roles TO service_role;

ALTER TABLE public.access_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "access_roles_read_all" ON public.access_roles FOR SELECT USING (true);
CREATE POLICY "access_roles_admin_insert" ON public.access_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "access_roles_admin_update" ON public.access_roles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "access_roles_admin_delete" ON public.access_roles FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER update_access_roles_updated_at BEFORE UPDATE ON public.access_roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.access_roles (name, label, description, can_create_tickets, can_view_all_company_tickets, visible_modules) VALUES
  ('staff', 'Staff', 'Puede crear y gestionar solicitudes para los usuarios de su cuenta', true, true, '["applications","alarms","create-alarm","chat","referrals","browser"]'::jsonb),
  ('colaborador', 'Colaborador', 'Consulta sus aplicativos y el estado de las solicitudes donde figura como usuario afectado', false, false, '["applications","alarms","chat"]'::jsonb);

-- 2. Link end users to access roles
ALTER TABLE public.end_users
  ADD COLUMN access_role_id uuid REFERENCES public.access_roles(id) ON DELETE SET NULL;

-- 3. Merge duplicated companies (Tigo, ETB)
UPDATE public.end_users SET company_id = '35cc53b5-118b-4628-a8f5-c0c67f78462b', bot_role = 'staff' WHERE company_id = '3c3da1cc-43b1-4663-9ceb-b0ea689a6506';
UPDATE public.end_users SET company_id = 'a6bdc18a-26c0-4ce1-a310-424903409474', bot_role = 'staff' WHERE company_id = 'dd9e8c4b-b84e-45e6-941b-2c81abb3014d';

UPDATE public.company_applications SET company_id = '35cc53b5-118b-4628-a8f5-c0c67f78462b' WHERE company_id = '3c3da1cc-43b1-4663-9ceb-b0ea689a6506';
UPDATE public.company_applications SET company_id = 'a6bdc18a-26c0-4ce1-a310-424903409474' WHERE company_id = 'dd9e8c4b-b84e-45e6-941b-2c81abb3014d';

UPDATE public.referrals SET company_id = '35cc53b5-118b-4628-a8f5-c0c67f78462b' WHERE company_id = '3c3da1cc-43b1-4663-9ceb-b0ea689a6506';
UPDATE public.referrals SET company_id = 'a6bdc18a-26c0-4ce1-a310-424903409474' WHERE company_id = 'dd9e8c4b-b84e-45e6-941b-2c81abb3014d';

UPDATE public.browser_configs SET company_id = '35cc53b5-118b-4628-a8f5-c0c67f78462b' WHERE company_id = '3c3da1cc-43b1-4663-9ceb-b0ea689a6506';
UPDATE public.browser_configs SET company_id = 'a6bdc18a-26c0-4ce1-a310-424903409474' WHERE company_id = 'dd9e8c4b-b84e-45e6-941b-2c81abb3014d';

UPDATE public.cia_configs SET company_id = '35cc53b5-118b-4628-a8f5-c0c67f78462b' WHERE company_id = '3c3da1cc-43b1-4663-9ceb-b0ea689a6506';
UPDATE public.cia_configs SET company_id = 'a6bdc18a-26c0-4ce1-a310-424903409474' WHERE company_id = 'dd9e8c4b-b84e-45e6-941b-2c81abb3014d';

UPDATE public.cia_knowledge SET company_id = '35cc53b5-118b-4628-a8f5-c0c67f78462b' WHERE company_id = '3c3da1cc-43b1-4663-9ceb-b0ea689a6506';
UPDATE public.cia_knowledge SET company_id = 'a6bdc18a-26c0-4ce1-a310-424903409474' WHERE company_id = 'dd9e8c4b-b84e-45e6-941b-2c81abb3014d';

UPDATE public.cia_sla SET company_id = '35cc53b5-118b-4628-a8f5-c0c67f78462b' WHERE company_id = '3c3da1cc-43b1-4663-9ceb-b0ea689a6506';
UPDATE public.cia_sla SET company_id = 'a6bdc18a-26c0-4ce1-a310-424903409474' WHERE company_id = 'dd9e8c4b-b84e-45e6-941b-2c81abb3014d';

-- module visibility: move only rows that don't conflict, then drop leftovers
UPDATE public.company_module_visibility v SET company_id = '35cc53b5-118b-4628-a8f5-c0c67f78462b'
WHERE v.company_id = '3c3da1cc-43b1-4663-9ceb-b0ea689a6506'
  AND NOT EXISTS (SELECT 1 FROM public.company_module_visibility t WHERE t.company_id = '35cc53b5-118b-4628-a8f5-c0c67f78462b' AND t.module_name = v.module_name);
UPDATE public.company_module_visibility v SET company_id = 'a6bdc18a-26c0-4ce1-a310-424903409474'
WHERE v.company_id = 'dd9e8c4b-b84e-45e6-941b-2c81abb3014d'
  AND NOT EXISTS (SELECT 1 FROM public.company_module_visibility t WHERE t.company_id = 'a6bdc18a-26c0-4ce1-a310-424903409474' AND t.module_name = v.module_name);

UPDATE public.companies SET name = 'Tigo', active = true WHERE id = '35cc53b5-118b-4628-a8f5-c0c67f78462b';
UPDATE public.companies SET name = 'ETB', active = true WHERE id = 'a6bdc18a-26c0-4ce1-a310-424903409474';
UPDATE public.companies SET active = false, name = name || ' (fusionada)' WHERE id IN ('3c3da1cc-43b1-4663-9ceb-b0ea689a6506','dd9e8c4b-b84e-45e6-941b-2c81abb3014d');

-- 4. Assign access roles to existing people
UPDATE public.end_users e SET access_role_id = r.id
FROM public.access_roles r
WHERE r.name = CASE WHEN e.bot_role = 'staff' THEN 'staff' ELSE 'colaborador' END
  AND e.access_role_id IS NULL;

-- 5. Alarms: affected user + application
ALTER TABLE public.alarms
  ADD COLUMN affected_end_user_id uuid REFERENCES public.end_users(id) ON DELETE SET NULL,
  ADD COLUMN application_id uuid REFERENCES public.company_applications(id) ON DELETE SET NULL,
  ADD COLUMN global_application_id uuid REFERENCES public.global_applications(id) ON DELETE SET NULL,
  ADD COLUMN application_label text;

UPDATE public.alarms SET affected_end_user_id = end_user_id WHERE affected_end_user_id IS NULL;

CREATE UNIQUE INDEX alarms_unique_open_request
  ON public.alarms (affected_end_user_id, lower(coalesce(application_label, '')))
  WHERE status NOT IN ('resuelta', 'cerrada')
    AND affected_end_user_id IS NOT NULL
    AND application_label IS NOT NULL;

CREATE INDEX alarms_affected_end_user_idx ON public.alarms (affected_end_user_id);