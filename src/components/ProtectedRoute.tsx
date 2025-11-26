import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { menuItems } from "@/lib/menu";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkPermission = async () => {
      if (!user || !requiredPermission) {
        setHasPermission(true);
        return;
      }

      try {
        // 1. Get user role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (!profile) {
          setHasPermission(false);
          return;
        }

        // Admin has access to everything
        if (profile.role === 'admin') {
          setHasPermission(true);
          return;
        }

        // 2. Get module ID for the current route
        const { data: moduleData } = await supabase
          .from("app_modules")
          .select("id")
          .eq("route", requiredPermission)
          .maybeSingle();

        if (!moduleData) {
          console.warn(`Module not found for route: ${requiredPermission}`);
          setHasPermission(false);
          return;
        }

        // 3. Check permission
        const { data: permission } = await supabase
          .from("role_module_permissions")
          .select("can_view")
          .eq("role", profile.role)
          .eq("module_id", moduleData.id)
          .maybeSingle();

        if (permission && permission.can_view) {
          setHasPermission(true);
        } else {
          // If permission denied, try to find the first allowed route
          console.log("Permission denied for", requiredPermission, "checking for allowed routes...");

          const { data: allModules } = await supabase
            .from("app_modules")
            .select("id, route");

          const { data: allPermissions } = await supabase
            .from("role_module_permissions")
            .select("module_id, can_view")
            .eq("role", profile.role);

          if (allModules && allPermissions) {
            // Find allowed routes
            const allowedRoutes = allModules
              .filter(m => {
                const p = allPermissions.find(perm => perm.module_id === m.id);
                return p?.can_view;
              })
              .map(m => m.route);

            // Find first menu item that is allowed
            const firstAllowedItem = menuItems.find(item => allowedRoutes.includes(item.url));

            if (firstAllowedItem) {
              console.log("Redirecting to first allowed route:", firstAllowedItem.url);
              navigate(firstAllowedItem.url, { replace: true });
              return;
            }
          }

          setHasPermission(false);
        }
      } catch (error) {
        console.error("Error checking permissions:", error);
        setHasPermission(false);
      }
    };

    if (!authLoading) {
      checkPermission();
    }
  }, [user, authLoading, requiredPermission, navigate]);

  if (authLoading || (requiredPermission && hasPermission === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredPermission && hasPermission === false) {
    // If we are here, it means redirection failed or no modules are allowed
    return <div className="p-8 text-center">No tienes acceso a ningún módulo. Contacta al administrador.</div>;
  }

  return <>{children}</>;
}
