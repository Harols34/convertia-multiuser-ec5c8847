# Cuentas unificadas, roles de acceso y control de solicitudes duplicadas

## Objetivo

Dejar una sola cuenta por cliente (Tigo, ETB, etc.) y separar a las personas por **rol de acceso** (staff / colaborador), en lugar de tener cuentas duplicadas. Los aplicativos quedan asociados a la cuenta y sirven para ambos roles. Al crear un caso será obligatorio indicar el usuario afectado y el aplicativo, y no se podrá abrir un caso repetido mientras el anterior siga sin resolverse.

## 1. Unificación de cuentas

- Se fusionan automáticamente las cuentas duplicadas: "Tigo Staff" + "Tigo Operación" -> **Tigo**; "ETB Staff" + "ETB Operación" -> **ETB**.
- Todo se mueve a la cuenta unificada: personas, aplicativos, credenciales, casos, chats, referidos, configuración de visibilidad y configuración del BOT.
- A cada persona se le asigna su rol de acceso según la cuenta de la que venía (los que estaban en "Staff" quedan como staff, los de "Operación" como colaborador).
- Las cuentas vacías duplicadas quedan desactivadas, no se borra información.

## 2. Roles de acceso (nuevo)

- Nueva sección "Roles de Acceso" dentro de Roles y Permisos, independiente de los roles de administrador.
- Se crean dos por defecto: **Staff** y **Colaborador**. Se pueden renombrar, crear nuevos y desactivar.
- Aplican a todas las cuentas por igual.
- Cada rol de acceso tiene interruptores de comportamiento:
  - Puede crear solicitudes.
  - Puede ver todas las solicitudes de su cuenta (staff) o solo las suyas / donde figura como usuario afectado (colaborador).
  - Módulos visibles del portal (Mis Aplicativos, Mis Casos, Crear Caso, Chat, Navegador, Referidos), combinados con la visibilidad ya existente por empresa.
- En Personal y en la carga masiva se puede asignar el rol de acceso a cada persona; por defecto Colaborador.

## 3. Aplicativos de la cuenta

- Los aplicativos creados en una cuenta quedan disponibles para todos los roles de acceso de esa cuenta.
- Las credenciales siguen siendo individuales; el aplicativo como tal es visible para staff al crear casos de otras personas.

## 4. Creación de casos

- El formulario de "Crear Caso" (portal y BOT C-IA) pide:
  - **Usuario afectado**: obligatorio, se elige de la lista de personas de la misma cuenta (incluyéndose a uno mismo).
  - **Aplicativo / tipo de gestión**: obligatorio, lista de aplicativos de la cuenta.
  - Asunto, descripción, adjuntos (igual que hoy).
- Solo pueden crear casos los roles de acceso con el permiso activado; a los demás se les oculta la opción.
- El usuario afectado ve el caso en "Mis Casos" y puede consultar su estado por chat y con el BOT, aunque no lo haya creado él.

## 5. Bloqueo de solicitudes duplicadas

- Llave de control: **documento del usuario afectado + aplicativo/gestión + estado**.
- Si ya existe un caso para esa combinación en estado distinto de *resuelta* o *cerrada*, no se permite crear otro y se muestra:
  "Ya existe una solicitud en curso para este usuario y aplicativo (caso #..., estado: ...). Debes esperar a que sea resuelta."
- Si el caso anterior está resuelto o cerrado, sí se permite crear uno nuevo.
- La validación se aplica tanto en el portal como en el BOT y también en la base de datos, para que no se cuele por otra vía.

## 6. Mesa de ayuda (administrador)

- Las columnas de la lista muestran el usuario afectado y el aplicativo.
- Se puede filtrar por cuenta, rol de acceso, usuario afectado y aplicativo.

## Detalles técnicos

- Nueva tabla `access_roles` (name, label, description, active, can_create_tickets, can_view_all_company_tickets, visible_modules jsonb) con RLS: lectura para portal y administración solo admin; GRANTs a anon/authenticated/service_role según corresponda.
- `end_users.access_role_id uuid references access_roles`, poblado en la migración de unificación; se conserva `bot_role` sincronizado para compatibilidad con el BOT.
- `alarms`: nuevas columnas `affected_end_user_id uuid references end_users`, `application_id uuid`, `global_application_id uuid`, `application_label text`. Backfill de casos existentes con `affected_end_user_id = end_user_id`.
- Índice único parcial sobre (`affected_end_user_id`, aplicativo) donde `status not in ('resuelta','cerrada')`, más validación previa en cliente para dar el mensaje amigable.
- Migración de fusión: `UPDATE` de `company_id` en `end_users`, `company_applications`, `browser_configs`, `company_module_visibility`, `referrals`, `cia_configs`, `cia_knowledge`, `cia_sla` hacia la cuenta destino, con desactivación de la cuenta origen (sin borrados).
- Frontend afectado: `RolesPermissions.tsx` (nueva pestaña), `Personnel.tsx` y cargas masivas, `UserPortal.tsx` (formulario y filtrado de casos), `CIABot.tsx` + `cia-assistant` (flujo de creación con usuario/aplicativo y validación), `HelpDesk.tsx` (columnas y filtros), `Companies.tsx` (mostrar roles de acceso).
