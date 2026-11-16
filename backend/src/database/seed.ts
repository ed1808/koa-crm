import { sql } from "./db";

export async function runSeed() {
  console.log("Seeding KOA CRM database with initial data...");

  // 1. Limpiar datos existentes en orden inverso
  await sql`TRUNCATE TABLE outbox_events, interactions_comments, tasks, deals, tickets, contacts, companies, pipeline_stages, pipelines, users CASCADE;`;

  // 2. Usuarios del sistema (Roles acordados)
  const users = [
    {
      full_name: "Administrador General",
      email: "admin@koa.com",
      role: "ADMIN",
      department: "Dirección",
    },
    {
      full_name: "Rafael Betancourt",
      email: "rafael.betancourt@koa.com",
      role: "COMERCIAL",
      department: "Ventas B2B",
    },
    {
      full_name: "Yorlady Alvarez Castaño",
      email: "yorlady.alvarez@koa.com",
      role: "COMERCIAL",
      department: "Ventas B2B",
    },
    {
      full_name: "Juan Fernando Ordóñez",
      email: "juan.ordonez@koa.com",
      role: "COMERCIAL",
      department: "Ventas B2B",
    },
    {
      full_name: "Cristi Paola Ruiz Álvarez",
      email: "cristi.ruiz@koa.com",
      role: "SOPORTE",
      department: "Atención al Cliente",
    },
    {
      full_name: "Jaime Enrique Barbón Díaz",
      email: "jaime.barbon@koa.com",
      role: "SOPORTE",
      department: "Atención al Cliente",
    },
    {
      full_name: "Olga Patricia Macea Fernandez",
      email: "olga.macea@koa.com",
      role: "SOPORTE",
      department: "Atención al Cliente",
    },
    {
      full_name: "Carlos Ingeniero TI",
      email: "carlos.ti@koa.com",
      role: "EMPLEADO_INTERNO",
      department: "Tecnología",
    },
    {
      full_name: "Claudia Otalvaro Garcia",
      email: "claudia.otalvaro@acuagas.com",
      role: "CLIENTE",
      department: "Contabilidad",
    },
    {
      full_name: "DevOps Externo Cloud",
      email: "cloud@proveedorexterno.com",
      role: "PROVEEDOR",
      department: "Infraestructura Cloud",
    },
  ];

  const userMap = new Map<string, string>();
  for (const u of users) {
    const res = await sql`
      INSERT INTO users (full_name, email, password_hash, role, department)
      VALUES (${u.full_name}, ${u.email}, 'pbkdf2_dummy_hash_for_mvp', ${u.role}, ${u.department})
      RETURNING id, email, full_name;
    `;
    userMap.set(u.email, res[0].id);
    userMap.set(u.full_name, res[0].id);
  }

  // 3. Pipelines de COMERCIAL (CRM)
  const crmPipelineRes = await sql`
    INSERT INTO pipelines (module_type, name, description, is_default, is_internal_only)
    VALUES ('CRM', 'Pipeline de ventas', 'Flujo principal comercial de oportunidades y negocios', TRUE, FALSE)
    RETURNING id;
  `;
  const crmPipelineId = crmPipelineRes[0].id;

  const crmStages = [
    { name: "Contacto", position: 1, win_prob: 10, status: "OPEN", color: "#3B82F6" },
    { name: "Cotización", position: 2, win_prob: 30, status: "OPEN", color: "#6366F1" },
    { name: "Demo", position: 3, win_prob: 60, status: "IN_PROGRESS", color: "#EC4899" },
    { name: "Venta $", position: 4, win_prob: 90, status: "IN_PROGRESS", color: "#10B981" },
    { name: "Cerrado Ganado", position: 5, win_prob: 100, status: "WON_RESOLVED", color: "#059669" },
  ];

  const crmStageMap = new Map<string, string>();
  for (const st of crmStages) {
    const sRes = await sql`
      INSERT INTO pipeline_stages (pipeline_id, name, position, win_probability, status_category, color_hex)
      VALUES (${crmPipelineId}, ${st.name}, ${st.position}, ${st.win_prob}, ${st.status}, ${st.color})
      RETURNING id, name;
    `;
    crmStageMap.set(st.name, sRes[0].id);
  }

  // 4. Pipelines de SOPORTE (Nómina Electrónica, Puesta a Punto y Soporte Interno TI)
  const ticketPipelineRes = await sql`
    INSERT INTO pipelines (module_type, name, description, is_default, is_internal_only)
    VALUES ('TICKETS', 'Nómina Electrónica', 'Gestión de casos de soporte del producto de Nómina', TRUE, FALSE)
    RETURNING id;
  `;
  const ticketPipelineId = ticketPipelineRes[0].id;

  const ticketStages = [
    { name: "Nuevo", position: 1, status: "OPEN", sla_hours: 4, color: "#3B82F6" },
    { name: "Pasó a desarrollo", position: 2, status: "IN_PROGRESS", sla_hours: 24, color: "#F59E0B" },
    { name: "En análisis", position: 3, status: "IN_PROGRESS", sla_hours: 12, color: "#8B5CF6" },
    { name: "Resuelto", position: 4, status: "WON_RESOLVED", sla_hours: 48, color: "#10B981" },
    { name: "Cerrado", position: 5, status: "LOST_CLOSED", sla_hours: 0, color: "#64748B" },
  ];

  const ticketStageMap = new Map<string, string>();
  for (const st of ticketStages) {
    const sRes = await sql`
      INSERT INTO pipeline_stages (pipeline_id, name, position, win_probability, status_category, default_sla_hours, color_hex)
      VALUES (${ticketPipelineId}, ${st.name}, ${st.position}, 0, ${st.status}, ${st.sla_hours}, ${st.color})
      RETURNING id, name;
    `;
    ticketStageMap.set(st.name, sRes[0].id);
  }

  // Pipeline dedicado de Puesta a Punto en Soporte
  const onboardingPipelineRes = await sql`
    INSERT INTO pipelines (module_type, name, description, is_default, is_internal_only)
    VALUES ('TICKETS', 'Puesta a Punto', 'Implementación, configuración inicial y acompañamiento post-venta por el equipo de soporte', FALSE, FALSE)
    RETURNING id;
  `;
  const onboardingPipelineId = onboardingPipelineRes[0].id;
  const onboardingStages = [
    { name: "Por Iniciar", position: 1, status: "OPEN", sla_hours: 8, color: "#3B82F6" },
    { name: "En Configuración", position: 2, status: "IN_PROGRESS", sla_hours: 24, color: "#F59E0B" },
    { name: "Capacitación y Pruebas", position: 3, status: "IN_PROGRESS", sla_hours: 24, color: "#8B5CF6" },
    { name: "Finalizado", position: 4, status: "WON_RESOLVED", sla_hours: 48, color: "#10B981" },
  ];
  const onboardingStageMap = new Map<string, string>();
  for (const st of onboardingStages) {
    const oRes = await sql`
      INSERT INTO pipeline_stages (pipeline_id, name, position, win_probability, status_category, default_sla_hours, color_hex)
      VALUES (${onboardingPipelineId}, ${st.name}, ${st.position}, 0, ${st.status}, ${st.sla_hours}, ${st.color})
      RETURNING id, name;
    `;
    onboardingStageMap.set(st.name, oRes[0].id);
  }

  // Pipeline Interno de Soporte TI
  const internalPipelineRes = await sql`
    INSERT INTO pipelines (module_type, name, description, is_default, is_internal_only)
    VALUES ('TICKETS', 'Soporte Interno TI & Infraestructura', 'Mesa de ayuda para requerimientos entre departamentos', FALSE, TRUE)
    RETURNING id;
  `;
  const internalPipelineId = internalPipelineRes[0].id;
  const internalStages = [
    { name: "Solicitud Recibida", position: 1, status: "OPEN", sla_hours: 8 },
    { name: "En Proceso", position: 2, status: "IN_PROGRESS", sla_hours: 24 },
    { name: "Finalizado", position: 3, status: "WON_RESOLVED", sla_hours: 48 },
  ];
  for (const st of internalStages) {
    await sql`
      INSERT INTO pipeline_stages (pipeline_id, name, position, win_probability, status_category, default_sla_hours)
      VALUES (${internalPipelineId}, ${st.name}, ${st.position}, 0, ${st.status}, ${st.sla_hours});
    `;
  }

  // 5. Empresas y Contactos
  const companies = [
    {
      name: "ACUAGAS SAS",
      tax_id: "900.345.678-1",
      external_erp_id: "ERP-CLI-1001",
      industry: "Servicios Públicos",
      owner: userMap.get("Jaime Enrique Barbón Díaz") || userMap.get("Rafael Betancourt"),
    },
    {
      name: "BARRILEROS SAS",
      tax_id: "901.890.123-4",
      external_erp_id: "ERP-CLI-1002",
      industry: "Gastronomía & Eventos",
      owner: userMap.get("Yorlady Alvarez Castaño"),
    },
    {
      name: "METAL-PLASTICOS CONSTRUCCIONES SAS",
      tax_id: "800.112.233-9",
      external_erp_id: "ERP-CLI-1003",
      industry: "Construcción",
      owner: userMap.get("Jaime Enrique Barbón Díaz") || userMap.get("Rafael Betancourt"),
    },
    {
      name: "Ecoshopping SAS",
      tax_id: "901.445.566-7",
      external_erp_id: "ERP-CLI-1004",
      industry: "Comercio Electrónico",
      owner: userMap.get("Olga Patricia Macea Fernandez"),
    },
    {
      name: "SETAS DE LA COSTA",
      tax_id: "900.778.899-2",
      external_erp_id: "ERP-CLI-1005",
      industry: "Alimentos",
      owner: userMap.get("Rafael Betancourt"),
    },
  ];

  const companyMap = new Map<string, string>();
  for (const c of companies) {
    const cRes = await sql`
      INSERT INTO companies (name, tax_id, external_erp_id, industry, commercial_owner_id, phone, email)
      VALUES (${c.name}, ${c.tax_id}, ${c.external_erp_id}, ${c.industry}, ${c.owner}, '3104567890', ${c.name.toLowerCase().replace(/\s+/g, '') + '@correo.com'})
      RETURNING id, name;
    `;
    companyMap.set(c.name, cRes[0].id);
  }

  // Actualizar empresa para el usuario Cliente
  const acuagasId = companyMap.get("ACUAGAS SAS");
  const clienteUserId = userMap.get("Claudia Otalvaro Garcia");
  if (clienteUserId && acuagasId) {
    await sql`UPDATE users SET linked_company_id = ${acuagasId} WHERE id = ${clienteUserId};`;
  }

  // Contactos
  const contacts = [
    {
      company: "ACUAGAS SAS",
      name: "Claudia Otalvaro Garcia",
      email: "claudia.otalvaro@acuagas.com",
      phone: "3118904567",
      title: "Jefe de Nómina y Tesorería",
      owner: userMap.get("Rafael Betancourt"),
    },
    {
      company: "ACUAGAS SAS",
      name: "Alexander Gutierrez",
      email: "alexander.gutierrez@acuagas.com",
      phone: "3127891234",
      title: "Gerente de Operaciones",
      owner: userMap.get("Rafael Betancourt"),
    },
    {
      company: "BARRILEROS SAS",
      name: "Nanny Cortés",
      email: "nanny.cortes@barrileros.com",
      phone: "3134567891",
      title: "Líder Administrativo",
      owner: userMap.get("Yorlady Alvarez Castaño"),
    },
    {
      company: "METAL-PLASTICOS CONSTRUCCIONES SAS",
      name: "Jaziel Garcia",
      email: "jaziel.garcia@metalplasticos.com",
      phone: "3145678912",
      title: "Director Financiero",
      owner: userMap.get("Juan Fernando Ordóñez"),
    },
  ];

  const contactMap = new Map<string, string>();
  for (const ct of contacts) {
    const compId = companyMap.get(ct.company);
    const ctRes = await sql`
      INSERT INTO contacts (company_id, commercial_owner_id, full_name, email, phone, position_title)
      VALUES (${compId}, ${ct.owner}, ${ct.name}, ${ct.email}, ${ct.phone}, ${ct.title})
      RETURNING id, full_name;
    `;
    contactMap.set(ct.name, ctRes[0].id);
  }

  // 6. Tickets de Soporte Reales (Como en la Imagen 2)
  const tickets = [
    {
      ticket_number: 3025,
      stage: "Resuelto",
      company: "ACUAGAS SAS",
      subject: "Error en el producto al emitir nómina electrónica",
      description: "El cliente presenta inconsistencias al sincronizar los comprobantes de nómina de octubre.",
      category: "Error en el producto",
      priority: "MEDIUM",
      agent: userMap.get("Jaime Enrique Barbón Díaz"),
      sla_hours: 48,
    },
    {
      ticket_number: 12941,
      stage: "Cerrado",
      company: "METAL-PLASTICOS CONSTRUCCIONES SAS",
      subject: "Ajuste de cuentas contables de retención en nómina",
      description: "Se configuraron las cuentas contables de acuerdo con la última resolución de la DIAN.",
      category: "Error en el producto",
      priority: "HIGH",
      agent: userMap.get("Jaime Enrique Barbón Díaz"),
      sla_hours: 24,
    },
    {
      ticket_number: 3491,
      stage: "Cerrado",
      company: "Ecoshopping SAS",
      subject: "Capacitación sobre nuevo módulo de novedades",
      description: "El cliente requiere orientación sobre horas extras y recargos nocturnos.",
      category: "Error en el producto",
      priority: "HIGH",
      agent: userMap.get("Olga Patricia Macea Fernandez"),
      sla_hours: 24,
    },
    {
      ticket_number: 1045,
      stage: "En análisis",
      company: "ACUAGAS SAS",
      subject: "Claudia Otalvaro Garcia - Mejora en la nómina (Requiere módulo adicional de facturación)",
      description: "Durante la llamada la jefa de nómina solicitó cotización del módulo de facturación recurrente para 3 sucursales.",
      category: "Solicitud nueva característica",
      priority: "MEDIUM",
      agent: userMap.get("Cristi Paola Ruiz Álvarez"),
      sla_hours: 12,
    },
  ];

  const ticketMap = new Map<number, string>();
  for (const tk of tickets) {
    const stageId = ticketStageMap.get(tk.stage);
    const companyId = companyMap.get(tk.company);
    const slaDue = new Date(Date.now() + (tk.sla_hours || 24) * 3600 * 1000);
    const nextAct = new Date(Date.now() + 4 * 24 * 3600 * 1000);

    const tkRes = await sql`
      INSERT INTO tickets (ticket_number, ticket_scope, pipeline_id, stage_id, company_id, assigned_agent_id, queue_name, category, priority, subject, description, sla_due_at, next_activity_at)
      VALUES (${tk.ticket_number}, 'CUSTOMER', ${ticketPipelineId}, ${stageId}, ${companyId}, ${tk.agent}, 'Atención Nómina', ${tk.category}, ${tk.priority}, ${tk.subject}, ${tk.description}, ${slaDue}, ${nextAct})
      RETURNING id, ticket_number;
    `;
    ticketMap.set(tk.ticket_number, tkRes[0].id);
  }

  // 7. Negocios Comerciales Reales (Como en la Imagen 1 con Totales y Ponderados)
  const deals = [
    {
      title: "Registro en CUENTI",
      company: "METAL-PLASTICOS CONSTRUCCIONES SAS",
      contact: "Jaziel Garcia",
      owner: userMap.get("Juan Fernando Ordóñez"),
      stage: "Contacto",
      amount: 0.00,
      close_date: "2026-11-12",
      next_act_days: null,
    },
    {
      title: "Otro comercio",
      company: "BARRILEROS SAS",
      contact: "Nanny Cortés",
      owner: userMap.get("Yorlady Alvarez Castaño"),
      stage: "Cotización",
      amount: 86000.00,
      close_date: "2026-12-05",
      next_act_days: null,
    },
    {
      title: "Servicios",
      company: "ACUAGAS SAS",
      contact: "Alexander Gutierrez",
      owner: userMap.get("Rafael Betancourt"),
      stage: "Demo",
      amount: 17240000.00,
      close_date: "2026-12-04",
      next_act_days: 4,
    },
    {
      title: "Producción",
      company: "ACUAGAS SAS",
      contact: "Claudia Otalvaro Garcia",
      owner: userMap.get("Rafael Betancourt"),
      stage: "Venta $",
      amount: 152700.00,
      close_date: "2026-07-06",
      next_act_days: -365,
    },
    {
      title: "BARRILEROS SAS",
      company: "BARRILEROS SAS",
      contact: "Nanny Cortés",
      owner: userMap.get("Yorlady Alvarez Castaño"),
      stage: "Venta $",
      amount: 661200.00,
      close_date: "2026-05-31",
      next_act_days: -365,
    },
    {
      title: "Distribuidoras",
      company: "SETAS DE LA COSTA",
      contact: null,
      owner: userMap.get("Rafael Betancourt"),
      stage: "Cerrado Ganado",
      amount: 8940000.00,
      close_date: "2026-11-23",
      next_act_days: -8, // hace 8 días
    },
  ];

  const dealMap = new Map<string, string>();
  for (const d of deals) {
    const stageId = crmStageMap.get(d.stage);
    const compId = companyMap.get(d.company);
    const ctId = d.contact ? contactMap.get(d.contact) : null;
    let nextActDate: Date | null = null;
    if (d.next_act_days !== null) {
      nextActDate = new Date(Date.now() + d.next_act_days * 24 * 3600 * 1000);
    }

    const dRes = await sql`
      INSERT INTO deals (pipeline_id, stage_id, company_id, primary_contact_id, owner_id, title, amount, currency, expected_close_date, next_activity_at)
      VALUES (${crmPipelineId}, ${stageId}, ${compId}, ${ctId}, ${d.owner}, ${d.title}, ${d.amount}, 'COP', ${d.close_date}, ${nextActDate})
      RETURNING id, title;
    `;
    dealMap.set(d.title, dRes[0].id);

    await sql`
      INSERT INTO interactions_comments (target_type, target_id, author_id, interaction_type, is_internal, body)
      VALUES ('DEAL', ${dRes[0].id}, ${d.owner}, 'STAGE_HISTORY', TRUE, ${`Oportunidad creada en etapa: ${d.stage}`});
    `;
  }

  // Ticket de ejemplo en el pipeline Puesta a Punto
  const ppStageId = onboardingStageMap.get("Por Iniciar");
  if (ppStageId) {
    const ppTk = await sql`
      INSERT INTO tickets (ticket_number, ticket_scope, pipeline_id, stage_id, company_id, assigned_agent_id, queue_name, category, priority, subject, description, sla_due_at)
      VALUES (1801, 'CUSTOMER', ${onboardingPipelineId}, ${ppStageId}, ${companyMap.get("BARRILEROS SAS")}, ${userMap.get("Cristi Paola Ruiz Álvarez")}, 'Puesta a Punto', 'Implementación Inicial', 'MEDIUM', 'Puesta a Punto - Configuración sucursal principal', 'Parametrización inicial de puntos de venta y capacitación al equipo administrativo.', ${new Date(Date.now() + 8 * 3600 * 1000)})
      RETURNING id;
    `;
    await sql`
      INSERT INTO interactions_comments (target_type, target_id, author_id, interaction_type, is_internal, body)
      VALUES ('TICKET', ${ppTk[0].id}, ${userMap.get("Rafael Betancourt")}, 'STAGE_HISTORY', TRUE, 'Ticket creado en etapa: Por Iniciar');
    `;
  }

  // 8. Tareas Transversales (Como en la Imagen 3)
  const tasks = [
    {
      title: "Seguimiento cotización 4463",
      task_type: "COMMERCIAL_FOLLOWUP",
      status: "NOT_STARTED",
      priority: "MEDIUM",
      assigned_to: userMap.get("Rafael Betancourt"),
      due_at: new Date(Date.now() - 24 * 3600 * 1000), // Atrasado
      company: "ACUAGAS SAS",
      deal: dealMap.get("Servicios"),
    },
    {
      title: "Seguimiento con ID: 15496 DIÁLOGO EXISTENCIAL Reorganizar las variantes para los medios de pago de la integración",
      task_type: "INTERNAL_ACTION",
      status: "NOT_STARTED",
      priority: "HIGH",
      assigned_to: userMap.get("Carlos Ingeniero TI"),
      due_at: new Date(Date.now() - 48 * 3600 * 1000), // Atrasado
      company: null,
      deal: null,
    },
    {
      title: "Seguimiento con ID 9397 FEEL TIME NOVEDAD EN EL BUZON DE RECEPCION",
      task_type: "INTERNAL_ACTION",
      status: "NOT_STARTED",
      priority: "MEDIUM",
      assigned_to: userMap.get("Cristi Paola Ruiz Álvarez"),
      due_at: new Date(Date.now() - 12 * 3600 * 1000),
      company: null,
      deal: null,
    },
    {
      title: "Seguimiento con ID 4371 KIRONIANOS SAS, Presenta novedad al ingresar un Conteo de Productos",
      task_type: "CALL",
      status: "NOT_STARTED",
      priority: "MEDIUM",
      assigned_to: userMap.get("Jaime Enrique Barbón Díaz"),
      due_at: new Date(Date.now() - 36 * 3600 * 1000),
      company: null,
      deal: null,
    },
    {
      title: "Seguimiento con ID 17449 SETAS DE LA COSTA Nueva implementación",
      task_type: "COMMERCIAL_FOLLOWUP",
      status: "NOT_STARTED",
      priority: "HIGH",
      assigned_to: userMap.get("Rafael Betancourt"),
      due_at: new Date(Date.now() + 2 * 3600 * 1000), // Vence hoy
      company: "SETAS DE LA COSTA",
      deal: dealMap.get("Distribuidoras"),
    },
    {
      title: "Seguimiento con Ana María",
      task_type: "CALL",
      status: "NOT_STARTED",
      priority: "LOW",
      assigned_to: userMap.get("Yorlady Alvarez Castaño"),
      due_at: new Date(Date.now() + 48 * 3600 * 1000), // Próximamente
      company: "BARRILEROS SAS",
      deal: dealMap.get("Otro comercio"),
    },
  ];

  for (const t of tasks) {
    const compId = t.company ? companyMap.get(t.company) : null;
    const tRes = await sql`
      INSERT INTO tasks (title, task_type, status, priority, assigned_to_id, due_at, company_id, deal_id)
      VALUES (${t.title}, ${t.task_type}, ${t.status}, ${t.priority}, ${t.assigned_to}, ${t.due_at}, ${compId}, ${t.deal})
      RETURNING id;
    `;
    await sql`
      INSERT INTO interactions_comments (target_type, target_id, author_id, interaction_type, is_internal, body)
      VALUES ('TASK', ${tRes[0].id}, ${t.assigned_to}, 'STAGE_HISTORY', TRUE, 'Tarea creada con estado: Sin iniciar');
    `;
  }

  // 9. Comentarios e historial inicial en tickets
  const ticket1045Id = ticketMap.get(1045);
  if (ticket1045Id) {
    await sql`
      INSERT INTO interactions_comments (target_type, target_id, author_id, interaction_type, is_internal, body)
      VALUES 
      ('TICKET', ${ticket1045Id}, ${userMap.get("Cristi Paola Ruiz Álvarez")}, 'STAGE_HISTORY', TRUE, 'Etapa cambiada: Nuevo → En análisis'),
      ('TICKET', ${ticket1045Id}, ${userMap.get("Cristi Paola Ruiz Álvarez")}, 'INTERNAL_NOTE', TRUE, 'Cliente Claudia Otalvaro reporta interés en adquirir módulo de facturación para 3 puntos de venta.'),
      ('TICKET', ${ticket1045Id}, ${userMap.get("Cristi Paola Ruiz Álvarez")}, 'COMMENT', FALSE, 'Hola Claudia, estamos validando los requerimientos de la nómina y el asesor comercial se pondrá en contacto para las sucursales adicionales.');
    `;
  }

  console.log("Database seeded successfully with realistic reference CRM & Ticket data.");
}

if (import.meta.main) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
