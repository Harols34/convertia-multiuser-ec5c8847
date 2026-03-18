
-- Add portal_password column to end_users
ALTER TABLE public.end_users ADD COLUMN IF NOT EXISTS portal_password text;

-- Function to set/update end user password (hashed with bcrypt)
CREATE OR REPLACE FUNCTION public.set_end_user_password(p_user_id uuid, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  UPDATE public.end_users
  SET portal_password = crypt(p_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Function to verify end user password, returns user id if valid
CREATE OR REPLACE FUNCTION public.verify_end_user_password(p_access_code text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM public.end_users
  WHERE access_code = p_access_code
    AND active = true
    AND portal_password IS NOT NULL
    AND portal_password = crypt(p_password, portal_password);
  
  RETURN v_user_id;
END;
$$;

-- Function to change own password (requires old password verification)
CREATE OR REPLACE FUNCTION public.change_end_user_password(p_access_code text, p_old_password text, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Verify old password first
  SELECT id INTO v_user_id
  FROM public.end_users
  WHERE access_code = p_access_code
    AND active = true
    AND portal_password IS NOT NULL
    AND portal_password = crypt(p_old_password, portal_password);
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  UPDATE public.end_users
  SET portal_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = v_user_id;
  
  RETURN true;
END;
$$;
