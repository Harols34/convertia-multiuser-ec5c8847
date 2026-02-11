import { Building2, Users, Grid3x3, Bell, BarChart3, Key, FileText, UserPlus, Shield, ShieldAlert, Globe } from "lucide-react";

export const menuItems = [
    { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
    { title: "Empresas", url: "/companies", icon: Building2 },
    { title: "Personal", url: "/personnel", icon: Users },
    { title: "Aplicativos", url: "/applications", icon: Grid3x3 },
    { title: "Credenciales", url: "/application-credentials", icon: Key },
    { title: "Mesa de Ayuda", url: "/help-desk", icon: Bell },
    { title: "Reportes", url: "/reports", icon: FileText },
    { title: "Referidos", url: "/referrals", icon: UserPlus },
    { title: "Config Navegador", url: "/browser-config", icon: Globe },
    { title: "Roles y Permisos", url: "/roles", icon: Shield },
    { title: "Usuarios del Sistema", url: "/system-users", icon: Users },
    { title: "Verificación", url: "/verification", icon: ShieldAlert },
];
