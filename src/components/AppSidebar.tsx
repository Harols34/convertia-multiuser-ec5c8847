import { Building2, Users, Grid3x3, Bell, BarChart3, Key, FileText, UserPlus, Shield, ShieldAlert } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { menuItems } from "@/lib/menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { user } = useAuth();
  const [allowedRoutes, setAllowedRoutes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const currentPath = location.pathname;

  useEffect(() => {
    const loadPermissions = async () => {
      if (!user) return;

      try {
        // 1. Get user role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (!profile) return;

        // If admin, allow all
        if (profile.role === 'admin') {
          setAllowedRoutes(menuItems.map(i => i.url));
          setLoading(false);
          return;
        }

        // 2. Get modules and permissions
        const { data: modules } = await supabase
          .from("app_modules")
          .select("id, route");

        const { data: permissions } = await supabase
          .from("role_module_permissions")
          .select("module_id, can_view")
          .eq("role", profile.role);

        if (modules && permissions) {
          const allowed = modules
            .filter(m => {
              const perm = permissions.find(p => p.module_id === m.id);
              return perm?.can_view;
            })
            .map(m => m.route)
            .filter(Boolean) as string[];

          // Always allow Dashboard for everyone, or check if it's in DB
          // For now, assuming Dashboard is a module. If not, we might need to force it.
          // Let's assume strict DB permissions.
          setAllowedRoutes(allowed);
        }
      } catch (error) {
        console.error("Error loading permissions:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user]);

  const isActive = (path: string) => currentPath === path;

  // Filter menu items
  const visibleItems = menuItems.filter(item =>
    // Always show Dashboard if it's not in the DB modules list, or if explicitly allowed
    // But better to rely on DB. If DB is empty for a role, they see nothing.
    // Fallback: If loading, show nothing or skeleton.
    // For better UX, maybe show Dashboard by default? 
    // Let's stick to strict permissions but ensure Dashboard is in DB.
    allowedRoutes.includes(item.url)
  );

  if (loading) return null; // Or a skeleton

  return (
    <Sidebar className={state === "collapsed" ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70">
            Menú Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      {state !== "collapsed" && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
