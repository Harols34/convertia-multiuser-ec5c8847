-- Create app_modules table to define available modules in the system
CREATE TABLE IF NOT EXISTS public.app_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  icon text,
  route text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Insert default modules
INSERT INTO public.app_modules (name, display_name, description, route) VALUES
  ('dashboard', 'Dashboard', 'Panel de control principal', '/dashboard'),
  ('companies', 'Empresas', 'Gestión de empresas', '/companies'),
  ('personnel', 'Personal', 'Gestión de personal', '/personnel'),
  ('applications', 'Aplicativos', 'Gestión de aplicativos', '/applications'),
  ('credentials', 'Credenciales', 'Gestión de credenciales', '/application-credentials'),
  ('help_desk', 'Mesa de Ayuda', 'Gestión de alarmas y soporte', '/help-desk'),
  ('reports', 'Reportes', 'Reportes y métricas', '/reports'),
  ('referrals', 'Referidos', 'Gestión de referidos y bonos', '/referrals'),
  ('roles', 'Roles y Permisos', 'Gestión de roles y permisos', '/roles'),
  ('chat', 'Chat', 'Mensajería con usuarios', '/chat')
ON CONFLICT (name) DO NOTHING;

-- Create role_module_permissions table
CREATE TABLE IF NOT EXISTS public.role_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module_id uuid REFERENCES public.app_modules(id) ON DELETE CASCADE NOT NULL,
  can_view boolean DEFAULT true,
  can_create boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(role, module_id)
);

-- Create company_module_visibility table for "Busca tu Info"
CREATE TABLE IF NOT EXISTS public.company_module_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  module_name text NOT NULL,
  visible boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(company_id, module_name)
);

-- Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referring_user_id uuid REFERENCES public.end_users(id) ON DELETE CASCADE NOT NULL,
  referred_document text NOT NULL,
  referred_name text NOT NULL,
  campaign text,
  status text NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'baja')),
  hire_date date NOT NULL,
  termination_date date,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create referral_bonuses table
CREATE TABLE IF NOT EXISTS public.referral_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid REFERENCES public.referrals(id) ON DELETE CASCADE NOT NULL UNIQUE,
  bonus_amount numeric(10,2) NOT NULL,
  condition_met_date date,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado')),
  paid_date date,
  paid_by uuid REFERENCES auth.users(id),
  alarm_generated boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create referral_config table for global settings
CREATE TABLE IF NOT EXISTS public.referral_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Insert default referral config
INSERT INTO public.referral_config (config_key, config_value, description) VALUES
  ('bonus_amount', '500000', 'Valor del bono por referido en pesos'),
  ('minimum_days', '60', 'Días mínimos desde contratación para bono'),
  ('auto_alarm_enabled', 'true', 'Generar alarmas automáticas cuando se cumple condición')
ON CONFLICT (config_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.app_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_module_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for app_modules
CREATE POLICY "Admins can manage modules" ON public.app_modules FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for role_module_permissions
CREATE POLICY "Admins can manage role permissions" ON public.role_module_permissions FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for company_module_visibility
CREATE POLICY "Admins can manage company module visibility" ON public.company_module_visibility FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for referrals
CREATE POLICY "Admins can manage referrals" ON public.referrals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "End users can view their referrals" ON public.referrals FOR SELECT USING (referring_user_id IN (SELECT id FROM public.end_users));

-- RLS Policies for referral_bonuses
CREATE POLICY "Admins can manage bonuses" ON public.referral_bonuses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "End users can view their bonuses" ON public.referral_bonuses FOR SELECT USING (referral_id IN (SELECT id FROM public.referrals WHERE referring_user_id IN (SELECT id FROM public.end_users)));

-- RLS Policies for referral_config
CREATE POLICY "Admins can manage config" ON public.referral_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Everyone can read config" ON public.referral_config FOR SELECT USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_company_module_visibility_updated_at
  BEFORE UPDATE ON public.company_module_visibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referral_bonuses_updated_at
  BEFORE UPDATE ON public.referral_bonuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referral_config_updated_at
  BEFORE UPDATE ON public.referral_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_referrals_referring_user ON public.referrals(referring_user_id);
CREATE INDEX idx_referrals_company ON public.referrals(company_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);
CREATE INDEX idx_referrals_hire_date ON public.referrals(hire_date);
CREATE INDEX idx_referral_bonuses_status ON public.referral_bonuses(status);
CREATE INDEX idx_referral_bonuses_condition_met ON public.referral_bonuses(condition_met_date);
CREATE INDEX idx_company_module_visibility_company ON public.company_module_visibility(company_id);