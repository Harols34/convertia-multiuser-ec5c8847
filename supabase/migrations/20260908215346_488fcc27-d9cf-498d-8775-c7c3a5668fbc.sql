
INSERT INTO public.app_modules (name, display_name, description, route, icon, active)
SELECT 'bot_config', 'Configuración BOT', 'Configuración del asistente C-IA', '/bot-config', 'Bot', true
WHERE NOT EXISTS (SELECT 1 FROM public.app_modules WHERE route = '/bot-config');

INSERT INTO public.role_module_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
SELECT 'admin', m.id, true, true, true, true
FROM public.app_modules m
WHERE m.route = '/bot-config'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_module_permissions p WHERE p.role = 'admin' AND p.module_id = m.id
  );
