-- Remover usuario y contraseña de aplicativos de empresa
-- Estos campos solo deben estar a nivel individual en user_applications
ALTER TABLE public.company_applications 
DROP COLUMN IF EXISTS username,
DROP COLUMN IF EXISTS password;