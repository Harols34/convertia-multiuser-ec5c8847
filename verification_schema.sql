-- Tabla para logs de acceso (Login)
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id), -- Puede ser nulo si el usuario no existe
  email TEXT,
  role TEXT, -- 'sistema' o 'personal'
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  status TEXT NOT NULL, -- 'success', 'failure', 'blocked'
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla para logs de actividad
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT,
  action_type TEXT NOT NULL, -- 'create', 'read', 'update', 'delete', 'search', etc.
  module TEXT NOT NULL, -- 'referrals', 'auth', etc.
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);

-- Políticas de seguridad (RLS)
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Solo los administradores pueden ver los logs (ajustar según roles reales)
-- Asumiendo que existe una forma de identificar admins, por ahora permitimos lectura a autenticados para desarrollo
-- En producción, esto debería ser más estricto.
CREATE POLICY "Enable read access for authenticated users" ON access_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for all users" ON access_logs FOR INSERT TO public WITH CHECK (true); -- Permitir insertar logs de fallo de login (public)

CREATE POLICY "Enable read access for authenticated users" ON activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);
