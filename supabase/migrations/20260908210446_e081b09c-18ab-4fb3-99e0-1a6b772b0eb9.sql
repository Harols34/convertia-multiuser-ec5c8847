CREATE TABLE public.welcome_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  emoji text DEFAULT '👋',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.welcome_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.welcome_messages TO authenticated;
GRANT ALL ON public.welcome_messages TO service_role;

ALTER TABLE public.welcome_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active welcome messages"
ON public.welcome_messages FOR SELECT
USING (active = true OR public.is_admin());

CREATE POLICY "Admins can insert welcome messages"
ON public.welcome_messages FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update welcome messages"
ON public.welcome_messages FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete welcome messages"
ON public.welcome_messages FOR DELETE TO authenticated
USING (public.is_admin());

CREATE TRIGGER update_welcome_messages_updated_at
BEFORE UPDATE ON public.welcome_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.welcome_messages (title, message, emoji) VALUES
('Bienvenido a Convert-IA', 'Gestiona tus accesos, consulta tus solicitudes y encuentra rápidamente la información que necesitas.', '👋'),
('Hola de nuevo', 'Todos tus aplicativos y credenciales en un solo lugar, siempre disponibles y seguros.', '🚀'),
('Tu información, siempre a la mano', 'Consulta tus alarmas, referidos y accesos desde cualquier dispositivo.', '💡'),
('Seguridad primero', 'Recuerda actualizar tus contraseñas periódicamente y nunca compartirlas con nadie.', '🔐'),
('Convert-IA contigo', 'Si necesitas ayuda, crea una alarma o escríbenos por el chat: te respondemos rápido.', '⚡');