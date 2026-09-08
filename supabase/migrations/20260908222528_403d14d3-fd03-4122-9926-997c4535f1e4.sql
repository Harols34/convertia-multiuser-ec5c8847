CREATE TABLE public.privacy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_label text NOT NULL DEFAULT 'Privacidad y Tratamiento de Datos Personales',
  title text NOT NULL DEFAULT 'Política de Tratamiento de Datos Personales',
  content text NOT NULL DEFAULT '',
  show_on_landing boolean NOT NULL DEFAULT true,
  landing_position text NOT NULL DEFAULT 'bottom-center',
  show_on_portal boolean NOT NULL DEFAULT true,
  portal_position text NOT NULL DEFAULT 'bottom-center',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.privacy_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.privacy_settings TO authenticated;
GRANT ALL ON public.privacy_settings TO service_role;

ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privacy settings readable by everyone"
ON public.privacy_settings FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can insert privacy settings"
ON public.privacy_settings FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins can update privacy settings"
ON public.privacy_settings FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE TRIGGER update_privacy_settings_updated_at
BEFORE UPDATE ON public.privacy_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.privacy_settings (content) VALUES (
'Convert-IA informa a sus usuarios que los datos personales suministrados a través de esta plataforma serán tratados de conformidad con la Ley 1581 de 2012, el Decreto 1377 de 2013 y demás normas que las modifiquen, adicionen o sustituyan.

La información recopilada será utilizada exclusivamente para fines relacionados con la administración de usuarios, autenticación, gestión de accesos, soporte técnico, seguridad de la información, cumplimiento de obligaciones legales y demás actividades necesarias para la operación de la plataforma.

Convert-IA implementa medidas de seguridad técnicas, administrativas y organizacionales para proteger la confidencialidad, integridad y disponibilidad de los datos personales, evitando su acceso, alteración, divulgación o uso no autorizado.

Los titulares de los datos personales podrán ejercer sus derechos de conocer, actualizar, rectificar y suprimir su información, así como revocar la autorización otorgada para su tratamiento, de acuerdo con los procedimientos establecidos por la organización y la normatividad vigente.

El uso de la plataforma implica la aceptación de la presente Política de Tratamiento de Datos Personales.');
