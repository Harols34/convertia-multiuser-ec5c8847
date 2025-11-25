import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, AlertTriangle, Eye, Key } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

const securityTips = [
  {
    icon: Lock,
    title: "Protege tus Contraseñas",
    description: "Nunca compartas tus contraseñas con nadie. Usa combinaciones fuertes de letras, números y símbolos.",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  {
    icon: Eye,
    title: "Verifica URLs",
    description: "Antes de ingresar tus credenciales, asegúrate de estar en el sitio web oficial del aplicativo.",
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  {
    icon: AlertTriangle,
    title: "Cuidado con Phishing",
    description: "No abras enlaces sospechosos en correos o mensajes. Verifica siempre el remitente.",
    color: "text-info",
    bgColor: "bg-info/10",
  },
  {
    icon: Key,
    title: "Cambia Contraseñas Periódicamente",
    description: "Actualiza tus contraseñas cada 3-6 meses para mantener tus cuentas seguras.",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    icon: Shield,
    title: "Reporta Actividad Sospechosa",
    description: "Si notas algo extraño en tus cuentas, crea una alarma inmediatamente para que te ayudemos.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
];

export default function SecurityTips() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Tips de Seguridad
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Carousel className="w-full max-w-full">
          <CarouselContent>
            {securityTips.map((tip, index) => (
              <CarouselItem key={index}>
                <div className="p-1">
                  <Card className={tip.bgColor}>
                    <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                      <div className={`${tip.color} p-4 rounded-full ${tip.bgColor}`}>
                        <tip.icon className="h-12 w-12" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="text-lg font-semibold">{tip.title}</h3>
                        <p className="text-sm text-muted-foreground">{tip.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </CardContent>
    </Card>
  );
}
