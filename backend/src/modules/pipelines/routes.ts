import { NativeRouter, jsonResponse, parseBody } from "../../shared/infrastructure/Router";
import { sql } from "../../database/db";
import { resolveAuthUser } from "../../shared/presentation/authMiddleware";

export function registerPipelineRoutes(router: NativeRouter) {
  // 1. Obtener todos los pipelines por tipo de módulo (CRM, TICKETS, o ALL)
  router.get("/api/pipelines", async (req) => {
    const url = new URL(req.url);
    const moduleType = url.searchParams.get("module") || "CRM";
    const user = await resolveAuthUser(req);
    if (!user) {
      return jsonResponse({ error: "No autorizado: se requiere iniciar sesión" }, 401);
    }

    let pipelines;
    if (moduleType === "ALL") {
      pipelines = await sql`
        SELECT id, module_type, name, description, is_default, is_internal_only, created_at
        FROM pipelines
        ORDER BY module_type ASC, is_default DESC, name ASC;
      `;
    } else {
      pipelines = await sql`
        SELECT id, module_type, name, description, is_default, is_internal_only, created_at
        FROM pipelines
        WHERE module_type = ${moduleType}
        ORDER BY is_default DESC, name ASC;
      `;
    }

    // Clientes no deben visualizar flujos internos (ej. Soporte Interno TI)
    if (user.role === "CLIENTE") {
      pipelines = pipelines.filter((p: any) => !p.is_internal_only);
    }

    return jsonResponse({ data: pipelines });
  });

  // 2. Obtener un pipeline con todas sus etapas configuradas (para el tablero Kanban)
  router.get("/api/pipelines/:id/stages", async (_, params) => {
    const pipeline = await sql`
      SELECT id, module_type, name, description, is_default, is_internal_only
      FROM pipelines
      WHERE id = ${params.id}
      LIMIT 1;
    `;
    if (!pipeline || pipeline.length === 0) {
      return jsonResponse({ error: "Pipeline not found" }, 404);
    }

    const stages = await sql`
      SELECT id, pipeline_id, name, position, win_probability, status_category, default_sla_hours, color_hex
      FROM pipeline_stages
      WHERE pipeline_id = ${params.id}
      ORDER BY position ASC;
    `;

    return jsonResponse({
      data: {
        pipeline: pipeline[0],
        stages,
      },
    });
  });

  // 3. Crear nuevo pipeline (Solo ADMIN)
  router.post("/api/pipelines", async (req) => {
    const user = await resolveAuthUser(req);
    if (!user) {
      return jsonResponse({ error: "No autorizado: se requiere iniciar sesión" }, 401);
    }
    if (user.role !== "ADMIN") {
      return jsonResponse({ error: "Solo el administrador puede crear nuevos pipelines" }, 403);
    }

    const body = await parseBody(req);
    const { module_type, name, description, stages, is_internal_only } = body;

    if (!module_type || !name) {
      return jsonResponse({ error: "module_type y name son requeridos" }, 400);
    }

    const pRes = await sql`
      INSERT INTO pipelines (module_type, name, description, is_default, is_internal_only)
      VALUES (${module_type}, ${name}, ${description || null}, FALSE, ${Boolean(is_internal_only)})
      RETURNING id, module_type, name, description, is_internal_only;
    `;
    const newPipelineId = pRes[0].id;

    if (Array.isArray(stages) && stages.length > 0) {
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        await sql`
          INSERT INTO pipeline_stages (pipeline_id, name, position, win_probability, status_category, default_sla_hours, color_hex)
          VALUES (
            ${newPipelineId}, 
            ${s.name}, 
            ${i + 1}, 
            ${s.win_probability || 0}, 
            ${s.status_category || 'OPEN'}, 
            ${s.default_sla_hours || null}, 
            ${s.color_hex || '#0F5C4D'}
          );
        `;
      }
    } else {
      if (module_type === "CRM") {
        const defaultStages = [
          { name: "Contacto Inicial", win_prob: 10, status: "OPEN", color: "#3B82F6" },
          { name: "Propuesta / Cotización", win_prob: 40, status: "OPEN", color: "#6366F1" },
          { name: "Negociación", win_prob: 70, status: "IN_PROGRESS", color: "#EC4899" },
          { name: "Cierre Ganado", win_prob: 100, status: "WON_RESOLVED", color: "#059669" },
        ];
        for (let i = 0; i < defaultStages.length; i++) {
          const st = defaultStages[i];
          await sql`
            INSERT INTO pipeline_stages (pipeline_id, name, position, win_probability, status_category, color_hex)
            VALUES (${newPipelineId}, ${st.name}, ${i + 1}, ${st.win_prob}, ${st.status}, ${st.color});
          `;
        }
      } else {
        const defaultStages = [
          { name: "Nuevo", sla: 4, status: "OPEN", color: "#3B82F6" },
          { name: "En Análisis", sla: 12, status: "IN_PROGRESS", color: "#F59E0B" },
          { name: "En Resolución", sla: 24, status: "IN_PROGRESS", color: "#8B5CF6" },
          { name: "Resuelto", sla: 48, status: "WON_RESOLVED", color: "#10B981" },
          { name: "Cerrado", sla: 0, status: "LOST_CLOSED", color: "#64748B" },
        ];
        for (let i = 0; i < defaultStages.length; i++) {
          const st = defaultStages[i];
          await sql`
            INSERT INTO pipeline_stages (pipeline_id, name, position, win_probability, status_category, default_sla_hours, color_hex)
            VALUES (${newPipelineId}, ${st.name}, ${i + 1}, 0, ${st.status}, ${st.sla}, ${st.color});
          `;
        }
      }
    }

    return jsonResponse({ data: pRes[0] }, 201);
  });

  // 4. Actualizar etapas de un pipeline (Solo ADMIN)
  router.put("/api/pipelines/:id/stages", async (req, params) => {
    const user = await resolveAuthUser(req);
    if (!user) {
      return jsonResponse({ error: "No autorizado: se requiere iniciar sesión" }, 401);
    }
    if (user.role !== "ADMIN") {
      return jsonResponse({ error: "Solo el administrador puede modificar etapas de pipelines" }, 403);
    }

    const body = await parseBody(req);
    const { stages } = body;

    if (!Array.isArray(stages)) {
      return jsonResponse({ error: "stages array is required" }, 400);
    }

    const currentStageIds = stages.filter((s: any) => s.id).map((s: any) => s.id);

    if (currentStageIds.length > 0) {
      await sql`
        DELETE FROM pipeline_stages
        WHERE pipeline_id = ${params.id} AND id NOT IN ${sql(currentStageIds)};
      `;
    } else if (stages.length === 0) {
      await sql`DELETE FROM pipeline_stages WHERE pipeline_id = ${params.id};`;
    }

    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      if (s.id) {
        await sql`
          UPDATE pipeline_stages
          SET name = ${s.name},
              position = ${i + 1},
              win_probability = ${s.win_probability || 0},
              status_category = ${s.status_category || 'OPEN'},
              default_sla_hours = ${s.default_sla_hours || null},
              color_hex = ${s.color_hex || '#0F5C4D'},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${s.id} AND pipeline_id = ${params.id};
        `;
      } else {
        await sql`
          INSERT INTO pipeline_stages (pipeline_id, name, position, win_probability, status_category, default_sla_hours, color_hex)
          VALUES (${params.id}, ${s.name}, ${i + 1}, ${s.win_probability || 0}, ${s.status_category || 'OPEN'}, ${s.default_sla_hours || null}, ${s.color_hex || '#0F5C4D'});
        `;
      }
    }

    const updatedStages = await sql`
      SELECT id, pipeline_id, name, position, win_probability, status_category, default_sla_hours, color_hex
      FROM pipeline_stages
      WHERE pipeline_id = ${params.id}
      ORDER BY position ASC;
    `;

    return jsonResponse({ data: updatedStages });
  });
}
