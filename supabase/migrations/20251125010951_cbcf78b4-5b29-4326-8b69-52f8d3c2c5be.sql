-- Fix search_path for security
CREATE OR REPLACE FUNCTION update_credential_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.username IS DISTINCT FROM NEW.username) OR (OLD.password IS DISTINCT FROM NEW.password) THEN
    NEW.credential_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_resolution_time()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cerrada' AND OLD.status != 'cerrada' THEN
    NEW.resolved_at = now();
    IF NEW.responded_at IS NOT NULL THEN
      NEW.resolution_time_minutes = EXTRACT(EPOCH FROM (NEW.resolved_at - NEW.responded_at)) / 60;
    ELSE
      NEW.resolution_time_minutes = EXTRACT(EPOCH FROM (NEW.resolved_at - NEW.created_at)) / 60;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;