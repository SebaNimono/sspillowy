# SSPillowy Mobile App

Consola móvil de gestión de incidentes y aprobación en el bucle (**Human-in-the-Loop / HITL**) para la plataforma SSPillowy.

## 🚀 Funcionalidades Actuales

- **Autenticación de Operadores:**
  - Login con validación estricta de correo electrónico y formato de contraseña.
  - Opción para mostrar/ocultar contraseña (*toggle visibility*).
  - Flujo de Registro con confirmación de clave y restablecimiento de contraseña.

- **Feed de Incidentes (HITL):**
  - Lista de alertas en tiempo real clasificadas por severidad (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
  - Capacidad de **Aprobar** o **Bloquear/Rechazar** acciones automáticas sugeridas por el sistema.
  - Indicadores visuales de estado (*Pending*, *Approved*, *Rejected*).

- **Perfil de Usuario & Ajustes:**
  - Selección de avatar/foto de perfil desde la galería del dispositivo (`image_picker`).
  - Edición de alias con restricción de tiempo (máximo 1 cambio cada 14 días).
  - Switch de estado de guardia (**On-Call**).
  - Diálogo de confirmación para eliminación de cuenta.

## 🛠️ Tecnologías

- **Framework:** Flutter (Dart)
- **Patrón de Arquitectura:** Clean Architecture / Feature-First
- **UI:** Material Design 3 con Dark Theme personalizado