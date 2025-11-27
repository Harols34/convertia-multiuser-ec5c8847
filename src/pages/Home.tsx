import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, Key, Shield, ArrowRight, Layout, Users, Lock, Database, BarChart3, Globe, Zap, CheckCircle2, TrendingUp, Sparkles } from "lucide-react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { RadialIntro } from "@/components/ui/radial-intro";
import DisplayCards from "@/components/ui/display-cards";
import { BIDashboard } from "@/components/ui/bi-dashboard";

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

    navigate(`/busca-tu-info?code=${accessCode.trim()}`);
    setSearching(false);
  };

  const orbitItems = [
    {
      id: 1,
      name: 'Seguridad',
      icon: <Shield className="h-8 w-8 text-slate-900" />,
    },
    {
      id: 2,
      name: 'Usuarios',
      icon: <Users className="h-8 w-8 text-slate-900" />,
    },
    {
      id: 3,
      name: 'Datos',
      icon: <Database className="h-8 w-8 text-slate-900" />,
    },
    {
      id: 4,
      name: 'Analítica',
      icon: <BarChart3 className="h-8 w-8 text-slate-900" />,
    },
    {
      id: 5,
      name: 'Global',
      icon: <Globe className="h-8 w-8 text-slate-900" />,
    },
  ];

  const featureCards = [
    {
      icon: <Layout className="size-5 text-white" />,
      title: "Gestión Centralizada",
      description: "Administra múltiples empresas y usuarios desde un solo lugar.",
      date: "Eficiencia",
      iconClassName: "text-emerald-600",
      titleClassName: "text-emerald-700 font-bold",
      className: "[grid-area:stack] hover:-translate-y-12 hover:scale-105 bg-white border-emerald-300 shadow-2xl hover:shadow-emerald-200/50 transition-all duration-500",
    },
    {
      icon: <Lock className="size-5 text-white" />,
      title: "Acceso Seguro",
      description: "Autenticación robusta con códigos únicos y roles dinámicos.",
      date: "Seguridad",
      iconClassName: "text-teal-600",
      titleClassName: "text-teal-700 font-bold",
      className: "[grid-area:stack] translate-x-24 translate-y-12 hover:-translate-y-1 hover:scale-105 bg-white border-teal-300 shadow-2xl hover:shadow-teal-200/50 transition-all duration-500",
    },
    {
      icon: <Users className="size-5 text-white" />,
      title: "Colaboración",
      description: "Conecta equipos y departamentos de forma fluida.",
      date: "Conectividad",
      iconClassName: "text-green-600",
      titleClassName: "text-green-700 font-bold",
      className: "[grid-area:stack] translate-x-48 translate-y-24 hover:translate-y-12 hover:scale-105 bg-white border-green-300 shadow-2xl hover:shadow-green-200/50 transition-all duration-500",
    },
  ];

  const benefits = [
    { icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />, text: "Gestión unificada de credenciales" },
    { icon: <CheckCircle2 className="h-5 w-5 text-teal-600" />, text: "Sistema de roles dinámicos" },
    { icon: <CheckCircle2 className="h-5 w-5 text-green-600" />, text: "Soporte multi-empresa integrado" },
    { icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />, text: "Dashboard analítico avanzado" },
  ];

  return (
    <AuroraBackground>
      <div className="min-h-screen flex flex-col relative z-10">
        {/* Header */}
        <header className="w-full px-4 lg:px-12 py-6 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 p-3 rounded-2xl shadow-lg shadow-emerald-500/30">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Usuarios Convert-IA
                <Sparkles className="h-4 w-4 text-emerald-600 animate-pulse" />
              </h1>
              <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Gestión Multiempresa 2025
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            className="font-medium text-slate-700 hover:bg-white/60 hover:text-slate-900 border-2 border-slate-200 hover:border-emerald-300 transition-all"
            onClick={() => navigate("/auth")}
          >
            <Shield className="mr-2 h-4 w-4" />
            Acceso Administrador
          </Button>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col gap-12 px-4 lg:px-12 relative py-8">
          {/* Hero Section with Login */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Login */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-2 border-emerald-200 rounded-full px-4 py-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    Plataforma de Nueva Generación
                  </span>
                </div>

                <h2 className="text-6xl md:text-8xl font-extrabold tracking-tight text-slate-900 drop-shadow-md leading-tight">
                  Busca tu <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600">
                    Información
                  </span>
                </h2>
                <p className="text-2xl md:text-3xl text-slate-700 font-semibold leading-relaxed">
                  Accede a tus aplicativos, credenciales y datos de forma <span className="text-emerald-600 font-bold">rápida y segura</span>.
                </p>

                {/* Benefits List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
                  {benefits.map((benefit, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-base text-slate-700"
                    >
                      {benefit.icon}
                      <span className="font-medium">{benefit.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="bg-white/90 backdrop-blur-xl border-2 border-emerald-200 shadow-2xl shadow-emerald-500/10 ring-1 ring-emerald-100">
                <CardContent className="p-10">
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="access-code" className="text-xl font-bold text-slate-800">
                          Ingresa tu Código de Acceso
                        </Label>
                        <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <Shield className="h-3 w-3" />
                          Seguro
                        </div>
                      </div>
                      <div className="relative group">
                        <Key className="absolute left-4 top-4 h-6 w-6 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                        <Input
                          id="access-code"
                          placeholder="Ej: 12345678_juan"
                          value={accessCode}
                          onChange={(e) => setAccessCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSearch();
                          }}
                          className="pl-14 h-14 text-xl bg-white border-2 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 shadow-inner rounded-xl font-medium"
                          autoFocus
                        />
                      </div>
                      <Button
                        onClick={handleSearch}
                        disabled={searching}
                        size="lg"
                        className="w-full h-14 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] rounded-xl font-bold"
                      >
                        {searching ? (
                          <>
                            <Zap className="mr-2 h-5 w-5 animate-spin" />
                            Buscando...
                          </>
                        ) : (
                          <>
                            Buscar
                            <ArrowRight className="ml-2 h-6 w-6" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Visuals */}
            <div className="flex flex-col items-center justify-center gap-16 relative min-h-[600px]">
              {/* Radial Intro - Static for performance */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 pointer-events-none scale-110">
                <RadialIntro orbitItems={orbitItems} stageSize={650} imageSize={90} />
              </div>

              {/* Feature Cards */}
              <DisplayCards cards={featureCards} className="max-w-md" />
            </div>
          </div>

          {/* BI Dashboard Section */}
          <div className="w-full">
            <BIDashboard />
          </div>
        </main>

        <footer className="relative py-6 text-center border-t-2 border-emerald-200/50 backdrop-blur-sm mt-12">
          <p className="text-sm text-slate-600 font-medium">
            © 2025 <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Usuarios Convert-IA</span> · Plataforma de gestión empresarial de nueva generación
          </p>
        </footer>
      </div>
    </AuroraBackground>
  );
}
