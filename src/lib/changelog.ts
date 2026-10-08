export interface Release {
  version: string;
  title: string;
  changes: string[];
}

// Más reciente primero. Al publicar cambios, agrega una nueva entrada arriba.
export const RELEASES: Release[] = [
  {
    version: "V2.4.0",
    title: "Mesa de Ayuda avanzada, Historial y horarios configurables",
    changes: [
      "Mesa de Ayuda en filas con filtros por estado, responsable, colaborador, campaña, prioridad y fecha.",
      "Indicadores superiores: abiertos, en gestión, pendiente de información y resueltos.",
      "Asignación de casos a un Administrador responsable y bandeja 'Mi bandeja'.",
      "Nuevo estado 'Pendiente de información'.",
      "Trazabilidad completa del caso: comentarios, cambios de estado, responsable y prioridad con fecha/hora.",
      "Alertas en tiempo real al crear, asignar, actualizar, escalar o resolver casos.",
      "Portal: Mis Alarmas muestra solo casos en curso; nuevo módulo Historial para casos cerrados.",
      "Portal: filtro por colaborador y comentarios del Staff/usuario en los casos.",
      "Chat: desplazamiento automático al recibir nuevos mensajes.",
      "C-IA: horario de atención, hora de corte y mensajes configurables desde Mesa de Ayuda.",
      "C-IA: detección de solicitudes urgentes y registro de la conversación en el hilo del caso.",
      "Historial de versiones en el menú lateral.",
    ],
  },
  {
    version: "V2.3.0",
    title: "Solicitudes sin duplicados y refresco silencioso",
    changes: [
      "Alerta roja en C-IA cuando ya existe una solicitud en curso para el mismo usuario y aplicativo.",
      "C-IA lista también los casos donde el usuario figura como afectado.",
      "Mis Alarmas se actualiza en segundo plano sin parpadeos.",
      "Tiempos de gestión por aplicativo con selección previa en C-IA.",
      "Orientación de uso y Tips con segundo nivel por subcategoría (RAG).",
      "Bloqueo de creación de novedades para el rol Colaborador.",
    ],
  },
  {
    version: "V2.2.0",
    title: "Cuentas unificadas y roles de acceso",
    changes: [
      "Roles de acceso globales (Staff, Colaborador) editables.",
      "Casos con usuario afectado y aplicativo; bloqueo de solicitudes duplicadas abiertas.",
      "Creación y actualización masiva de personal por Excel con filtros.",
      "Creación de solicitudes guiada desde C-IA.",
    ],
  },
  {
    version: "V2.1.0",
    title: "Privacidad y C-IA con memoria",
    changes: [
      "Módulo Privacidad con posición configurable en landing y portal.",
      "C-IA: texto libre, conversaciones guardadas, historial y ventana movible/redimensionable.",
      "Historial administrativo de conversaciones del bot.",
      "Conocimiento RAG por cuenta, rol y aplicativo; tiempos de gestión.",
    ],
  },
  {
    version: "V2.0.0",
    title: "Asistente C-IA y tiempo real",
    changes: [
      "Bot C-IA flotante con configuración por empresa, campaña y rol.",
      "Tiempo real en estados, comentarios y chat.",
      "Mesa de Ayuda separada en pestañas Casos y Chat.",
      "Historial de comentarios por caso.",
    ],
  },
  {
    version: "V1.5.0",
    title: "Acceso seguro al portal y bienvenida",
    changes: [
      "Acceso a 'Busca tu Info' en dos pasos: código y contraseña.",
      "Módulo Contraseñas Portal con asignación masiva por plantilla.",
      "Mensajes de bienvenida aleatorios administrables.",
      "Portal con menú lateral desplegable.",
    ],
  },
  {
    version: "V1.4.0",
    title: "Navegador embebido",
    changes: [
      "Navegador dentro del portal con lista de sitios permitidos.",
      "Historial de navegación por usuario y módulo administrativo de historial.",
      "El navegador conserva su estado al cambiar de módulo.",
    ],
  },
  {
    version: "V1.3.0",
    title: "Referidos y roles flexibles",
    changes: [
      "Módulo Referidos con bonos, alarmas por tiempo y dashboard.",
      "Roles y permisos granulares por módulo.",
      "Visibilidad de módulos por empresa en el portal.",
    ],
  },
  {
    version: "V1.2.0",
    title: "Reportes BI y tiempos",
    changes: [
      "Descarga de reportes seleccionables en Excel y PDF.",
      "Dashboard de tiempos de respuesta y solución.",
      "Fecha de resolución y último cambio en Mesa de Ayuda.",
    ],
  },
  {
    version: "V1.1.0",
    title: "Credenciales y aplicativos",
    changes: [
      "Actualización masiva de credenciales seleccionando varios aplicativos.",
      "Editar y eliminar aplicativos.",
      "Botón para volver al inicio desde el login.",
    ],
  },
  {
    version: "V1.0.0",
    title: "Lanzamiento inicial",
    changes: [
      "Gestión de empresas, personal, aplicativos y credenciales.",
      "Mesa de Ayuda con alarmas y chat con usuarios.",
      "Portal 'Busca tu Info' para el personal.",
      "Dashboard administrativo.",
    ],
  },
];

export const CURRENT_VERSION = RELEASES[0].version;
