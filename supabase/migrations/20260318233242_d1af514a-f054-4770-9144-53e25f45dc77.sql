INSERT INTO public.app_modules (name, display_name, description, icon, route, active)
VALUES ('end_user_passwords', 'Contraseñas Portal', 'Gestión de contraseñas de usuarios del portal Busca tu Info', 'Key', '/end-user-passwords', true)
ON CONFLICT DO NOTHING;