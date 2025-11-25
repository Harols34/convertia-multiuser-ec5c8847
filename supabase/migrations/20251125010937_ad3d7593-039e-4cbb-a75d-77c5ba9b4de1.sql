-- Add timestamp columns to user_applications for credential management
ALTER TABLE user_applications 
ADD COLUMN IF NOT EXISTS credential_created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS credential_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS credential_expires_at TIMESTAMP WITH TIME ZONE;

-- Add responded_at and resolution_time_minutes to alarms
ALTER TABLE alarms 
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolution_time_minutes INTEGER;

-- Create function to update credential timestamp when username or password changes
CREATE OR REPLACE FUNCTION update_credential_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.username IS DISTINCT FROM NEW.username) OR (OLD.password IS DISTINCT FROM NEW.password) THEN
    NEW.credential_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for credential updates
DROP TRIGGER IF EXISTS update_user_applications_credential_timestamp ON user_applications;
CREATE TRIGGER update_user_applications_credential_timestamp
  BEFORE UPDATE ON user_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_credential_timestamp();

-- Create function to calculate resolution time when alarm is closed
CREATE OR REPLACE FUNCTION calculate_resolution_time()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for resolution time calculation
DROP TRIGGER IF EXISTS calculate_alarm_resolution_time ON alarms;
CREATE TRIGGER calculate_alarm_resolution_time
  BEFORE UPDATE ON alarms
  FOR EACH ROW
  EXECUTE FUNCTION calculate_resolution_time();