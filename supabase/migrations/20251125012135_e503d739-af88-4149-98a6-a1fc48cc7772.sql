-- Add additional fields to user_applications for credential management
ALTER TABLE user_applications 
ADD COLUMN IF NOT EXISTS credential_expires_at_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS credential_notes TEXT;

-- Update existing records to set last_password_change if password exists
UPDATE user_applications 
SET last_password_change = credential_updated_at 
WHERE password IS NOT NULL AND last_password_change IS NULL;

-- Create function to track password changes
CREATE OR REPLACE FUNCTION update_last_password_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.password IS DISTINCT FROM NEW.password AND NEW.password IS NOT NULL THEN
    NEW.last_password_change = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for password change tracking
DROP TRIGGER IF EXISTS track_password_change ON user_applications;
CREATE TRIGGER track_password_change
  BEFORE UPDATE ON user_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_last_password_change();