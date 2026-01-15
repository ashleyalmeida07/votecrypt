-- Create a table to track files that need cleanup after user deletion
CREATE TABLE IF NOT EXISTS deleted_voter_ids (
  id SERIAL PRIMARY KEY,
  firebase_uid TEXT NOT NULL,
  voter_id_url TEXT NOT NULL,
  deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cleaned_up BOOLEAN DEFAULT FALSE,
  cleaned_up_at TIMESTAMP
);

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_deleted_voter_ids_cleaned_up ON deleted_voter_ids(cleaned_up);

-- Create function to log voter ID URL before user deletion
CREATE OR REPLACE FUNCTION log_voter_id_for_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if the user has a voter ID URL
  IF OLD.voter_id_url IS NOT NULL THEN
    INSERT INTO deleted_voter_ids (firebase_uid, voter_id_url)
    VALUES (OLD.firebase_uid, OLD.voter_id_url);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run before user deletion
DROP TRIGGER IF EXISTS before_user_delete_trigger ON users;
CREATE TRIGGER before_user_delete_trigger
  BEFORE DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_voter_id_for_cleanup();

-- Mark trigger as active
COMMENT ON TRIGGER before_user_delete_trigger ON users IS 'Logs voter ID URLs for cleanup when users are deleted';
