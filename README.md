# KOA CRM & Service Desk + AI Copilot (MVP)

Plataforma empresarial interna para la gestión de relaciones comerciales (CRM), atención y soporte al cliente / interno (Tickets) e IA copiloto, construida bajo **Clean Architecture** en un **Monolito Modular** impulsado por eventos sobre **RabbitMQ** y **PostgreSQL**, con frontend en **React (TypeScript + Tailwind CSS)** y backend de alto desempeño en **Bun** nativo (sin frameworks).

---

## 🚀 Arquitectura y Componentes Implementados

1. **Backend Monolito Modular en Bun Puro (`Bun.serve()`):**
   - Sin frameworks HTTP externos; router nativo con soporte regex para parámetros de ruta y CORS.
   - Acceso a base de datos mediante cliente nativo `Bun.sql` con consultas SQL parametrizadas directas en PostgreSQL 18.
   - **Clean Architecture:** Estructuración estricta en dominios desacoplados (`iam`, `pipelines`, `crm`, `tickets`, `tasks`, `ai-copilot`, `erp-integration`).
   - **Bus de Eventos Asíncronos (RabbitMQ + Transactional Outbox):** Publicación sobre el topic exchange `koa.events` y persistencia atómica en la tabla `outbox_events` con worker background en tiempo real.

2. **Frontend React + TypeScript + Tailwind CSS (Vite):**
   - **Diseño Ergonómico y Minimalista:** Tema corporativo claro y oscuro (`slate-950` y verde petróleo `#0F5C4D`), basado en las capturas de referencia.
   - **Tablero Kanban Comercial:** Visualización fiel con cálculo dinámico de **Cantidad total (COP)** y **Cantidad ponderada (%)**, píldoras de actividad (`No hay próximas actividades`, `en X días`, `hace X días ⚠️`), drag & drop de etapas y configuración interactiva del pipeline.
   - **Tablero Kanban de Tickets:** Clasificación por pipelines (ej: *Nómina Electrónica*, *Soporte TI Interno*), seguimiento de SLAs, prioridades e identificadores de caso legibles (`ID 3025 - ACUAGAS SAS`).
   - **Bandeja Unificada de Tareas:** Pestañas de productividad (*Todos tareas*, *Vencen hoy*, *Atrasado*, *Próximamente*), vinculación polimórfica a negocios, tickets y empresas, y botón de inicio de jornada.
   - **Drawer de Detalle 360°:** Despliegue lateral sin recarga de pantalla con propiedades editables, línea de tiempo de notas internas/comentarios y tareas vinculadas.
   - **Copiloto de IA Contextual (`✨`):** Panel interactivo con Function Calling que analiza el caso, detecta el asesor comercial responsable de la empresa del cliente y genera automáticamente la tarea comercial y/o negocio asociado.
   - **Consola de Eventos ERP:** Monitor en tiempo real de la cola Outbox y simulador de eventos entrantes (`erp.customer.upserted`) para validar la sincronización asíncrona.
   - **Conmutador de Roles RBAC:** Prueba en vivo como `ADMIN`, `COMERCIAL`, `SOPORTE`, `EMPLEADO_INTERNO`, `CLIENTE` (Portal restringido a sus propios tickets) y `PROVEEDOR`.

---

## 🛠️ Ejecución y Desarrollo Local

### Prerrequisitos
- [Bun](https://bun.sh/) 1.4+
- Docker & Docker Compose

### 1. Levantar Infraestructura (PostgreSQL 18 y RabbitMQ)
```bash
docker compose up -d
```
- PostgreSQL disponible en el puerto `5433` (usuario: `koa_admin`, base de datos: `koa_crm`).
- RabbitMQ en el puerto `5673` (Panel de Administración en `http://localhost:15673`, usuario: `koa_rabbit`, password: `koa_rabbit_2026`).

### 2. Migraciones y Carga de Datos Semilla
```bash
bun run backend/src/database/migrate.ts
bun run backend/src/database/seed.ts
```

### 3. Iniciar Backend y Frontend
```bash
# Iniciar Backend (Puerto 3001)
bun run backend/src/index.ts

# Iniciar Frontend (Puerto 5173)
cd frontend && bun x vite --port 5173 --host
```

Abre tu navegador en: **`http://localhost:5173`**
