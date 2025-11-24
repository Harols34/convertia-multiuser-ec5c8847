import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, Search, Key, Shield, Users as UsersIcon, Grid3x3, Bell } from "lucide-react";

export default function Home() {
  const [accessCode, setAccessCode] = useState("");
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!accessCode.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu código de acceso",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);

    const { data: user, error } = await supabase
      .from("end_users")
      .select("id")
      .eq("access_code", accessCode.trim())
      .maybeSingle();

    if (error || !user) {
      toast({
        title: "Código no encontrado",
        description: "No se encontró ningún usuario con ese código de acceso",
        variant: "destructive",
      });
      setSearching(false);
      return;
    }

    // Navegar al portal con el código
    navigate(`/busca-tu-info?code=${accessCode.trim()}`);
    setSearching(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Usuarios Convert-IA</h1>
              <p className="text-xs text-muted-foreground">Gestión Multiempresa</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/auth")}>
            <Shield className="mr-2 h-4 w-4" />
            Acceso Administrador
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center justify-center p-4 bg-muted rounded-2xl mb-4">
            <Search className="h-12 w-12 text-foreground" />
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Busca tu Información
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Accede a tus aplicativos, credenciales y datos de forma rápida y segura
          </p>

          {/* Búsqueda principal */}
          <Card className="max-w-xl mx-auto shadow-lg mt-8">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="access-code" className="text-base">
                    Ingresa tu Código de Acceso
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Key className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="access-code"
                        placeholder="Ej: 12345678_juan"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearch();
                        }}
                        className="pl-10 h-12 text-lg"
                        autoFocus
                      />
                    </div>
                    <Button 
                      onClick={handleSearch} 
                      disabled={searching}
                      size="lg"
                      className="px-8"
                    >
                      {searching ? "Buscando..." : "Buscar"}
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-info/10 border border-info/20 rounded-lg text-left">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">¿No tienes tu código?</strong><br/>
                    Contacta al administrador de tu empresa para obtener tu código único de acceso.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 space-y-3">
              <div className="inline-flex p-3 bg-muted rounded-xl">
                <Grid3x3 className="h-8 w-8 text-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Tus Aplicativos</h3>
              <p className="text-sm text-muted-foreground">
                Accede a todos tus aplicativos con enlaces, usuarios y contraseñas
              </p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 space-y-3">
              <div className="inline-flex p-3 bg-muted rounded-xl">
                <Bell className="h-8 w-8 text-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Solicita Ayuda</h3>
              <p className="text-sm text-muted-foreground">
                Crea alarmas y reporta problemas con evidencia adjunta
              </p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 space-y-3">
              <div className="inline-flex p-3 bg-muted rounded-xl">
                <Shield className="h-8 w-8 text-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Seguro y Confiable</h3>
              <p className="text-sm text-muted-foreground">
                Tu información está protegida con acceso único y cifrado
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card mt-16">
        <div className="container mx-auto px-6 py-8 text-center text-sm text-muted-foreground">
          <p>© 2024 Usuarios Convert-IA. Plataforma de gestión empresarial segura.</p>
        </div>
      </footer>
    </div>
  );
}
