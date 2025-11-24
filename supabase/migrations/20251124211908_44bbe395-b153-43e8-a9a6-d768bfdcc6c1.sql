-- Allow anonymous users to view company applications that are assigned to them
CREATE POLICY "End users can view assigned company applications"
ON company_applications
FOR SELECT
TO anon
USING (
  id IN (
    SELECT application_id 
    FROM user_applications 
    WHERE application_id IS NOT NULL
  )
);

-- Allow anonymous users to view global applications that are assigned to them
CREATE POLICY "End users can view assigned global applications"
ON global_applications
FOR SELECT
TO anon
USING (
  id IN (
    SELECT global_application_id 
    FROM user_applications 
    WHERE global_application_id IS NOT NULL
  )
);