import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, Search, Key, Shield, Users as UsersIcon, Grid3x3, Bell, ArrowRight } from "lucide-react";

export default function Home() {
  const [accessCode, setAccessCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [featureSearch, setFeatureSearch] = useState("");
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

  const features = [
    {
      icon: <Grid3x3 className="h-8 w-8 text-primary" />,
      title: "Tus Aplicativos",
      description: "Accede a todos tus aplicativos con enlaces, usuarios y contraseñas",
      keywords: ["aplicativos", "apps", "enlaces", "login"]
    },
    {
      icon: <Bell className="h-8 w-8 text-primary" />,
      title: "Solicita Ayuda",
      description: "Crea alarmas y reporta problemas con evidencia adjunta",
      keywords: ["ayuda", "soporte", "alarmas", "reportar"]
    },
    {
      icon: <Shield className="h-8 w-8 text-primary" />,
      title: "Seguro y Confiable",
      description: "Tu información está protegida con acceso único y cifrado",
      keywords: ["seguridad", "proteccion", "cifrado"]
    }
  ];

  const filteredFeatures = features.filter(f =>
    f.title.toLowerCase().includes(featureSearch.toLowerCase()) ||
    f.description.toLowerCase().includes(featureSearch.toLowerCase()) ||
    f.keywords.some(k => k.includes(featureSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2 rounded-xl">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Usuarios Convert-IA</h1>
              <p className="text-xs text-muted-foreground font-medium">Gestión Multiempresa</p>
            </div>
          </div>
          <Button variant="ghost" className="font-medium" onClick={() => navigate("/auth")}>
            <Shield className="mr-2 h-4 w-4" />
            Acceso Administrador
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="flex-1 flex items-center justify-center py-12 px-6 bg-gradient-to-b from-background via-muted/30 to-background">
          <div className="w-full max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center p-4 bg-primary/5 rounded-full mb-4 ring-1 ring-primary/10">
                <Search className="h-10 w-10 text-primary" />
              </div>

              <h2 className="text-4xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                Busca tu Información
              </h2>

              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Accede a tus aplicativos, credenciales y datos de forma rápida y segura
              </p>
            </div>

            {/* Búsqueda principal */}
            <Card className="max-w-2xl mx-auto shadow-2xl border-primary/10 overflow-hidden">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div className="space-y-3 text-left">
                    <Label htmlFor="access-code" className="text-lg font-medium ml-1">
                      Ingresa tu Código de Acceso
                    </Label>
                    <div className="flex gap-3 flex-col sm:flex-row">
                      <div className="relative flex-1 group">
                        <Key className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="access-code"
                          placeholder="Ej: 12345678_juan"
                          value={accessCode}
                          onChange={(e) => setAccessCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSearch();
                          }}
                          className="pl-12 h-12 text-lg shadow-sm border-muted-foreground/20 focus-visible:ring-primary"
                          autoFocus
                        />
                      </div>
                      <Button
                        onClick={handleSearch}
                        disabled={searching}
                        size="lg"
                        className="h-12 px-8 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                      >
                        {searching ? "Buscando..." : "Buscar"}
                        {!searching && <ArrowRight className="ml-2 h-5 w-5" />}
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-xl text-left flex gap-3 items-start">
                    <div className="bg-blue-100 dark:bg-blue-900/50 p-1.5 rounded-full mt-0.5">
                      <UsersIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <strong className="text-foreground block mb-0.5">¿No tienes tu código?</strong>
                      Contacta al administrador de tu empresa para obtener tu código único de acceso.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Features Grid (Search removed) */}
        <section className="py-16 px-6 bg-muted/30 border-t">
          <div className="w-full max-w-7xl mx-auto space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h3 className="text-2xl font-bold">¿Qué puedes hacer aquí?</h3>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {features.map((feature, index) => (
                <Card key={index} className="group hover:shadow-xl transition-all duration-300 border-muted-foreground/10 hover:border-primary/20">
                  <CardContent className="pt-8 pb-8 px-6 space-y-4 text-center">
                    <div className="inline-flex p-4 bg-primary/5 rounded-2xl group-hover:bg-primary/10 group-hover:scale-110 transition-all duration-300">
                      {feature.icon}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">{feature.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-8">
        <div className="w-full px-6 text-center text-sm text-muted-foreground">
          <p>© 2024 Usuarios Convert-IA. Plataforma de gestión empresarial segura.</p>
        </div>
      </footer>
    </div>
  );
}
