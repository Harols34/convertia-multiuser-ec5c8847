GRANT SELECT ON public.alarm_comments TO anon;
CREATE POLICY "End users can view alarm comments"
ON public.alarm_comments FOR SELECT TO anon USING (true);