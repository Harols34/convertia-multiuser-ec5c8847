import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Eye, Save } from "lucide-react";
import { Label } from "@/components/ui/label";

interface ModuleVisibility {
  module_name: string;
  visible: boolean;
}

const AVAILABLE_MODULES = [
  { name: "applications", label: "Mis Aplicativos" },
  { name: "alarms", label: "Mis Alarmas" },
  { name: "create_alarm", label: "Crear Alarma" },
  { name: "chat", label: "Chat" },
  { name: "referrals", label: "Referidos" }
];

interface Props {
  companyId: string;
  companyName: string;
}

export function CompanyModuleVisibility({ companyId, companyName }: Props) {
  const [visibility, setVisibility] = useState<ModuleVisibility[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadVisibility();
  }, [companyId]);

  const loadVisibility = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("company_module_visibility")
      .select("*")
      .eq("company_id", companyId);

    if (data && data.length > 0) {
      setVisibility(data.map(d => ({ module_name: d.module_name, visible: d.visible || false })));
    } else {
      // Initialize with all modules visible by default
      setVisibility(AVAILABLE_MODULES.map(m => ({ module_name: m.name, visible: true })));
    }
    setLoading(false);
  };

  const handleToggle = (moduleName: string, checked: boolean) => {
    setVisibility(prev => {
      const existing = prev.find(v => v.module_name === moduleName);
      if (existing) {
        return prev.map(v => v.module_name === moduleName ? { ...v, visible: checked } : v);
      } else {
        return [...prev, { module_name: moduleName, visible: checked }];
      }
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Delete existing visibility settings
      await supabase
        .from("company_module_visibility")
        .delete()
        .eq("company_id", companyId);

      // Insert new settings
      const inserts = visibility.map(v => ({
        company_id: companyId,
        module_name: v.module_name,
        visible: v.visible
      }));

      const { error } = await supabase
        .from("company_module_visibility")
        .insert(inserts);

      if (error) throw error;

      toast({
        title: "Configuración guardada",
        description: "La visibilidad de módulos se actualizó correctamente"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getModuleVisibility = (moduleName: string): boolean => {
    const found = visibility.find(v => v.module_name === moduleName);
    return found ? found.visible : true;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Configurar Visibilidad de Módulos
        </CardTitle>
        <CardDescription>
          Configura qué módulos son visibles en "Busca tu Información" para {companyName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {AVAILABLE_MODULES.map(module => (
          <div key={module.name} className="flex items-center space-x-2">
            <Checkbox
              id={`module-${module.name}`}
              checked={getModuleVisibility(module.name)}
              onCheckedChange={(checked) => handleToggle(module.name, checked as boolean)}
              disabled={loading}
            />
            <Label
              htmlFor={`module-${module.name}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {module.label}
            </Label>
          </div>
        ))}

        <Button onClick={handleSave} disabled={loading} className="w-full mt-4">
          <Save className="mr-2 h-4 w-4" />
          Guardar Configuración
        </Button>
      </CardContent>
    </Card>
  );
}