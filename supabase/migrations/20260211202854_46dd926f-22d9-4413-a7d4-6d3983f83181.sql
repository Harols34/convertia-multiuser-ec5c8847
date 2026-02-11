
-- Browser configs table (multi-tenant)
CREATE TABLE public.browser_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Navegador Principal',
  enabled boolean NOT NULL DEFAULT true,
  allowed_domains text[] NOT NULL DEFAULT '{}',
  allowed_url_prefixes text[] NOT NULL DEFAULT '{}',
  blocked_url_patterns text[] NOT NULL DEFAULT '{}',
  allow_new_tabs boolean NOT NULL DEFAULT true,
  allow_downloads boolean NOT NULL DEFAULT false,
  allow_popups boolean NOT NULL DEFAULT false,
  allow_http boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.browser_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage browser configs"
  ON public.browser_configs FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Users can view enabled browser configs for their companies"
  ON public.browser_configs FOR SELECT
  USING (
    enabled = true AND company_id IN (
      SELECT uc.company_id FROM user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

-- Read access for anonymous (end users via portal) - they query by company_id
CREATE POLICY "Anyone can read enabled browser configs"
  ON public.browser_configs FOR SELECT
  USING (enabled = true);

CREATE TRIGGER update_browser_configs_updated_at
  BEFORE UPDATE ON public.browser_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Browser permissions table
CREATE TABLE public.browser_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  browser_config_id uuid NOT NULL REFERENCES public.browser_configs(id) ON DELETE CASCADE,
  role text NOT NULL,
  can_use boolean NOT NULL DEFAULT true,
  can_open_new_tabs boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.browser_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage browser permissions"
  ON public.browser_permissions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Anyone can read browser permissions"
  ON public.browser_permissions FOR SELECT
  USING (true);

-- Browser audit logs table
CREATE TABLE public.browser_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  browser_config_id uuid REFERENCES public.browser_configs(id) ON DELETE SET NULL,
  action text NOT NULL,
  url text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.browser_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage browser audit logs"
  ON public.browser_audit_logs FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Anyone can insert browser audit logs"
  ON public.browser_audit_logs FOR INSERT
  WITH CHECK (true);

-- Add browser to company_module_visibility defaults
-- (no data insert needed, handled by app logic)
