import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs/promises";
import { Hono } from "hono";
import { cors } from "hono/cors";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { sign, verify } from "hono/jwt";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  UserType,
  LoginSchema,
  UserCreateSchema,
  UserUpdateSchema,
  BackendSubscriptionCreateSchema,
  SuperAdminCreateSubscriptionSchema
} from "../shared/types";

type Variables = {
  jwtPayload: UserType;
};

const app = new Hono<{ Variables: Variables }>();

app.use("*", cors());

const validateJson = <T extends z.ZodTypeAny>(schema: T) =>
  zValidator("json", schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: result.error.issues[0]?.message || "Datos inválidos" }, 400);
    }
  });

// Configurando Timezone nativo en la conexión a Postgres
const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,
  connection: { timezone: 'America/Lima' }
});

const getLocalTodayString = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

const getLocalIsoString = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Lima' }).replace('T', ' ');

const addMonthsToDateString = (dateStr: string, months: number) => {
  // Se usa T12:00:00Z para evitar cruces por medianoche
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().split('T')[0];
};

const addYearsToDateString = (dateStr: string, years: number) => {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().split('T')[0];
};

app.use('/api/*', async (c, next) => {
  const publicPaths = ['/api/auth/login', '/api/auth/register-free', '/api/platform-customization', '/api/auth/setup-superadmin', '/api/auth/check-setup'];
  if (publicPaths.includes(c.req.path)) {
    return await next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: "No token provisto" }, 401);
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const payload = await verify(token, process.env.JWT_SECRET!);
    const users = await sql`SELECT * FROM users WHERE email = ${payload.email as string} LIMIT 1`;
    if (users.length === 0) return c.json({ error: "Usuario no configurado" }, 401);

    const dbUser = users[0];
    if (!dbUser.is_active) return c.json({ error: "Cuenta suspendida" }, 401); 

    if (dbUser.role === 'admin' || dbUser.role === 'employee') {
      const adminInfo = dbUser.role === 'admin' 
        ? dbUser 
        : (await sql`SELECT is_active, subscription_end_date FROM users WHERE organization_id = ${dbUser.organization_id} AND role = 'admin' LIMIT 1`)[0];
        
      if (adminInfo) {
        if (!adminInfo.is_active) return c.json({ error: "La cuenta de la organización está suspendida." }, 401);
        
        const todayStr = getLocalTodayString();
        const endDateStr = adminInfo.subscription_end_date 
          ? (typeof adminInfo.subscription_end_date === 'string' ? adminInfo.subscription_end_date.split('T')[0] : adminInfo.subscription_end_date.toISOString().split('T')[0]) 
          : null;

        if (endDateStr && endDateStr < todayStr) return c.json({ error: "La suscripción de la organización ha vencido." }, 401);
      }
    }

    c.set('jwtPayload', dbUser as unknown as UserType);
    await next();
  } catch (err) {
    console.error(err);
    return c.json({ error: "Sesión inválida o expirada" }, 401);
  }
});

app.use('/api/superadmin/*', async (c, next) => {
  try {
    const user = c.get('jwtPayload');
    if (!user || user.role !== 'superadmin') {
      return c.json({ error: "Acceso denegado. Se requieren privilegios de SuperAdmin." }, 403);
    }
    await next();
  } catch (err) {
    console.error(err);
    return c.json({ error: "Error de servidor al verificar privilegios" }, 500);
  }
});

const blockEmployeeMutations = async (c: any, next: any) => {
  const user = c.get('jwtPayload');
  if (user && user.role === 'employee' && c.req.method !== 'GET') {
    return c.json({ error: "Acceso denegado: Privilegios insuficientes" }, 403);
  }
  await next();
};

app.use('/api/users*', blockEmployeeMutations);
app.use('/api/organization-payment-methods*', blockEmployeeMutations);
app.use('/api/subscription-plans*', blockEmployeeMutations);
app.use('/api/admin/dashboard-metrics', async (c, next) => {
  const user = c.get('jwtPayload');
  if (user?.role === 'employee') return c.json({ error: "Acceso denegado" }, 403);
  await next();
});

// AUTH
app.get("/api/auth/check-setup", async (c) => {
  try {
    const superadmins = await sql`SELECT COUNT(*) FROM users WHERE role = 'superadmin'`;
    return c.json({ setupRequired: parseInt(superadmins[0].count, 10) === 0 });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error al verificar instalación" }, 500);
  }
});

app.post("/api/auth/login", validateJson(LoginSchema), async (c) => {
  try {
    const { email, password } = c.req.valid('json');
    const users = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
    if (users.length === 0) return c.json({ error: "Credenciales inválidas" }, 401);
    
    const user = users[0];
    if (!user.password_hash) return c.json({ error: "Credenciales inválidas" }, 401);
    
    const isValid = await bcrypt.compare(String(password), String(user.password_hash));
    if (!isValid) return c.json({ error: "Credenciales inválidas" }, 401);
    if (!user.is_active) return c.json({ error: "Tu cuenta ha sido desactivada o cancelada." }, 403);

    if (user.role === 'admin' || user.role === 'employee') {
      const adminInfo = user.role === 'admin' ? user : (await sql`SELECT is_active, subscription_end_date FROM users WHERE organization_id = ${user.organization_id} AND role = 'admin' LIMIT 1`)[0];
      if (adminInfo) {
        if (!adminInfo.is_active) return c.json({ error: "La cuenta de la organización está suspendida." }, 403);
        const todayStr = getLocalTodayString();
        const endDateStr = adminInfo.subscription_end_date ? (typeof adminInfo.subscription_end_date === 'string' ? adminInfo.subscription_end_date.split('T')[0] : adminInfo.subscription_end_date.toISOString().split('T')[0]) : null;
        if (endDateStr && endDateStr < todayStr) return c.json({ error: "La suscripción ha vencido. Por favor, renueva tu plan." }, 403);
      }
    }
    
    const payload = {
      id: user.id, email: user.email, role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    };
    
    const token = await sign(payload, process.env.JWT_SECRET!);
    return c.json({ session: { access_token: token }, user: { id: user.id, email: user.email, name: user.name, role: user.role, organization_id: user.organization_id }});
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/auth/me", async (c) => {
  try {
    const dbUser = c.get('jwtPayload') as any;
    let orgName = null;
    if (dbUser.organization_id) {
      const orgs = await sql`SELECT name FROM organizations WHERE id = ${dbUser.organization_id} LIMIT 1`;
      if (orgs.length > 0) orgName = orgs[0].name;
    }
    
    const { password_hash, ...safeUser } = dbUser;
    return c.json({ user: { ...safeUser, organization_name: orgName } });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/api/auth/setup-superadmin", async (c) => {
  try {
    const superadmins = await sql`SELECT COUNT(*) FROM users WHERE role = 'superadmin'`;
    if (parseInt(superadmins[0].count, 10) > 0) {
      return c.json({ error: "Instalación bloqueada: Ya existe un SuperAdmin en el sistema." }, 403);
    }
    
    const { email, password, name, organization_name } = await c.req.json();
    const existingUser = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (existingUser.length > 0) return c.json({ error: "El correo ya está en uso" }, 400);
    const passwordHash = await bcrypt.hash(password, 10);
    const orgs = await sql`INSERT INTO organizations (name) VALUES (${organization_name}) RETURNING id`;
    await sql`INSERT INTO users (email, name, role, organization_id, is_active, password_hash) VALUES (${email}, ${name}, 'superadmin', ${orgs[0].id}, true, ${passwordHash})`;
    return c.json({ message: "SuperAdmin configurado exitosamente" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/api/auth/register-free", async (c) => {
  try {
    const { name, email, phone, organization_name, password } = await c.req.json();
    const settings = await sql`SELECT setting_value FROM platform_settings WHERE setting_key = 'enable_free_registration' LIMIT 1`;
    if (settings.length === 0 || settings[0].setting_value !== '1') return c.json({ error: "Registro desactivado" }, 403);
    const existingUser = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (existingUser.length > 0) return c.json({ error: "Correo en uso" }, 400);
    const plans = await sql`SELECT * FROM saas_plans WHERE is_free_plan = true AND is_active = true LIMIT 1`;
    if (plans.length === 0) return c.json({ error: "Plan gratuito no disponible" }, 404);
    
    const plan = plans[0];
    const passwordHash = await bcrypt.hash(password, 10);
    const orgs = await sql`INSERT INTO organizations (name) VALUES (${organization_name}) RETURNING id`;
    const sDateStr = getLocalTodayString();
    let eDateStr;
    if (plan.duration_months) eDateStr = addMonthsToDateString(sDateStr, Number(plan.duration_months));
    else eDateStr = addMonthsToDateString(sDateStr, 1);
    
    await sql`INSERT INTO users (email, name, role, organization_id, phone, plan_id, subscription_start_date, subscription_end_date, password_hash, is_active) VALUES (${email}, ${name}, 'admin', ${orgs[0].id}, ${phone || null}, ${plan.id}, ${sDateStr}, ${eDateStr}, ${passwordHash}, true)`;
    return c.json({ message: "Registro exitoso" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

// SUBSCRIPTIONS (ADMIN)
app.get("/api/subscriptions", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const organizationId = c.req.query("organization_id");
    const statusFilter = c.req.query("status") || "all";
    const search = c.req.query("search") || "";
    const sort = c.req.query("sort") || "recent";
    
    const page = parseInt(c.req.query("page") || "1", 10) || 1;
    const limit = parseInt(c.req.query("limit") || "50", 10) || 50;
    const offset = (page - 1) * limit;

    if (!organizationId) return c.json({ error: "organization_id es requerido" }, 400);
    if (user.role !== 'superadmin' && user.organization_id !== parseInt(organizationId)) return c.json({ error: "Acceso denegado" }, 403);

    const todayStr = getLocalTodayString();
    await sql`UPDATE subscriptions SET status = 'active' WHERE organization_id = ${organizationId} AND status = 'pending' AND start_date <= ${todayStr}`;
    await sql`UPDATE subscriptions SET status = 'expired' WHERE organization_id = ${organizationId} AND status = 'active' AND end_date < ${todayStr}`;

    const searchCond = search ? sql` AND (c.name ILIKE ${'%' + search + '%'} OR c.phone ILIKE ${'%' + search + '%'} OR c.email ILIKE ${'%' + search + '%'} OR p.name ILIKE ${'%' + search + '%'})` : sql``;
    
    const calcStatusSql = sql`
      CASE
        WHEN s.status = 'active' AND s.end_date >= DATE(${todayStr}) AND s.end_date <= (DATE(${todayStr}) + INTERVAL '3 days') THEN 'expiring'
        ELSE s.status
      END
    `;
    const statusCond = statusFilter !== 'all' ? sql` AND (${calcStatusSql}) = ${statusFilter}` : sql``;

    let orderByCond;
    if (sort === 'asc') orderByCond = sql`ORDER BY c.name ASC`;
    else if (sort === 'desc_name') orderByCond = sql`ORDER BY c.name DESC`;
    else orderByCond = sql`ORDER BY s.created_at DESC`;

    const countResult = await sql`
      SELECT COUNT(*) FROM subscriptions s 
      LEFT JOIN customers c ON s.customer_id = c.id 
      LEFT JOIN subscription_plans p ON s.plan_id = p.id
      WHERE s.organization_id = ${organizationId} ${statusCond} ${searchCond}
    `;

    const subsQuery = await sql`
      SELECT s.*, c.name as cust_name, c.phone as cust_phone, c.email as cust_email,
             p.name as plan_name, p.price as plan_price, p.duration_type as plan_duration_type, u.name as emp_name
      FROM subscriptions s 
      LEFT JOIN customers c ON s.customer_id = c.id 
      LEFT JOIN subscription_plans p ON s.plan_id = p.id 
      LEFT JOIN users u ON s.assigned_employee_id = u.id
      WHERE s.organization_id = ${organizationId} ${statusCond} ${searchCond}
      ${orderByCond} 
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const total = parseInt(countResult[0].count, 10);

    const subscriptions = subsQuery.map((sub: any) => {
      const startDateStr = sub.start_date ? (typeof sub.start_date === 'string' ? sub.start_date.split('T')[0] : sub.start_date.toISOString().split('T')[0]) : null;
      const endDateStr = sub.end_date ? (typeof sub.end_date === 'string' ? sub.end_date.split('T')[0] : sub.end_date.toISOString().split('T')[0]) : null;
      const isExpiring = sub.status === 'active' && endDateStr && endDateStr >= todayStr && (new Date(endDateStr).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24) <= 3;
      return {
        id: sub.id, organization_id: sub.organization_id, customer_id: sub.customer_id, plan_id: sub.plan_id, start_date: startDateStr, end_date: endDateStr, status: isExpiring ? 'expiring' : sub.status,
        notes: sub.notes, created_at: sub.created_at, customer_name: sub.cust_name, customer_phone: sub.cust_phone, customer_email: sub.cust_email, plan_name: sub.plan_name, plan_price: sub.plan_price, 
        duration_type: sub.plan_duration_type, employee_name: sub.emp_name
      };
    });

    return c.json({ 
      subscriptions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/api/subscriptions", validateJson(BackendSubscriptionCreateSchema), async (c) => {
  try {
    const user = c.get('jwtPayload');
    const { organization_id, customer_id, plan_id, start_date, end_date, status, notes, discount } = c.req.valid('json');
    if (user.role !== 'superadmin' && user.organization_id !== organization_id) return c.json({ error: "Acceso denegado" }, 403);
    
    return await sql.begin(async (tSql) => {
      const customerCheck = await tSql`SELECT id FROM customers WHERE id = ${customer_id} AND organization_id = ${organization_id} LIMIT 1`;
      if (customerCheck.length === 0) return c.json({ error: "El cliente no pertenece a esta organización" }, 403);

      if (user.role === 'admin' || user.role === 'employee') {
        const admins = await tSql`SELECT sp.subscription_limit FROM users u LEFT JOIN saas_plans sp ON u.plan_id = sp.id WHERE u.organization_id = ${organization_id} AND u.role = 'admin' LIMIT 1`;
        if (admins.length > 0 && admins[0].subscription_limit) {
          const counts = await tSql`SELECT COUNT(*) as count FROM subscriptions WHERE organization_id = ${organization_id}`;
          if (counts[0].count >= admins[0].subscription_limit) return c.json({ error: `Límite de suscripciones alcanzado` }, 400);
        }
      }

      const plans = await tSql`SELECT price, duration_months, duration_type FROM subscription_plans WHERE id = ${plan_id} AND organization_id = ${organization_id} LIMIT 1`;
      if (plans.length === 0) return c.json({ error: "Plan no encontrado" }, 404);
      const plan = plans[0];
      
      let calculatedEndDate = end_date;
      if (!calculatedEndDate) {
        if (plan.duration_months) calculatedEndDate = addMonthsToDateString(start_date, Number(plan.duration_months));
        else if (plan.duration_type === 'monthly') calculatedEndDate = addMonthsToDateString(start_date, 1);
        else calculatedEndDate = addYearsToDateString(start_date, 1);
      }
      
      const newSubs = await tSql`INSERT INTO subscriptions (organization_id, customer_id, plan_id, status, start_date, end_date, notes) VALUES (${organization_id}, ${customer_id}, ${plan_id}, ${status || 'pending'}, ${start_date}, ${calculatedEndDate}, ${notes || null}) RETURNING id`;
      const finalAmount = Math.max(0, plan.price - (Number(discount) || 0));
      await tSql`INSERT INTO payments (organization_id, subscription_id, amount, payment_method, status, payment_date, payment_type, is_platform_income) VALUES (${organization_id}, ${newSubs[0].id}, ${finalAmount}, 'other', 'confirmed', NOW(), 'new_subscription', false)`;
      return c.json({ message: "Creada exitosamente", subscription_id: newSubs[0].id });
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/api/subscriptions/:id/renew", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const subscriptionId = c.req.param("id");
    let body: any = {};
    try { body = await c.req.json(); } catch(e) {}
    const newPlanId = body.plan_id;
    const discount = body.discount;

    return await sql.begin(async (tSql) => {
      const subs = await tSql`SELECT s.*, p.price, p.duration_months, p.duration_type FROM subscriptions s JOIN subscription_plans p ON s.plan_id = p.id WHERE s.id = ${subscriptionId} LIMIT 1`;
      if (subs.length === 0) return c.json({ error: "Suscripción no encontrada" }, 404);
      const sub = subs[0];

      if (user.role !== 'superadmin' && user.organization_id !== sub.organization_id) return c.json({ error: "Acceso denegado" }, 403);

      let planToUse = { id: sub.plan_id, price: sub.price, duration_months: sub.duration_months, duration_type: sub.duration_type };
      if (newPlanId && newPlanId !== sub.plan_id) {
        const newPlans = await tSql`SELECT id, price, duration_months, duration_type FROM subscription_plans WHERE id = ${newPlanId} AND organization_id = ${sub.organization_id} LIMIT 1`;
        if (newPlans.length > 0) planToUse = newPlans[0] as any;
        else return c.json({ error: "Plan inválido" }, 400);
      }

      const todayStr = getLocalTodayString();
      let currentEndDateStr = sub.end_date ? (typeof sub.end_date === 'string' ? sub.end_date.split('T')[0] : sub.end_date.toISOString().split('T')[0]) : todayStr;
      let newStartDateStr = null;

      if (currentEndDateStr < todayStr) {
        currentEndDateStr = todayStr;
        newStartDateStr = todayStr;
      }

      let newEndDateStr;
      if (planToUse.duration_months) newEndDateStr = addMonthsToDateString(currentEndDateStr, Number(planToUse.duration_months));
      else if (planToUse.duration_type === 'monthly') newEndDateStr = addMonthsToDateString(currentEndDateStr, 1);
      else newEndDateStr = addYearsToDateString(currentEndDateStr, 1);

      if (newStartDateStr) await tSql`UPDATE subscriptions SET plan_id = ${planToUse.id}, start_date = ${newStartDateStr}, end_date = ${newEndDateStr}, status = 'active', updated_at = NOW() WHERE id = ${subscriptionId}`;
      else await tSql`UPDATE subscriptions SET plan_id = ${planToUse.id}, end_date = ${newEndDateStr}, status = 'active', updated_at = NOW() WHERE id = ${subscriptionId}`;

      const finalAmount = Math.max(0, planToUse.price - (Number(discount) || 0));
      await tSql`INSERT INTO payments (organization_id, subscription_id, amount, payment_method, status, payment_date, payment_type, is_platform_income) VALUES (${sub.organization_id}, ${subscriptionId}, ${finalAmount}, 'other', 'confirmed', NOW(), 'renewal', false)`;
      return c.json({ message: "Renovada exitosamente", new_end_date: newEndDateStr });
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.put("/api/subscriptions/:id", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const subscriptionId = c.req.param("id");
    const { customer_name, customer_phone, customer_email, plan_id, start_date, notes, upgrade_amount } = await c.req.json();
    
    return await sql.begin(async (tSql) => {
      const subs = await tSql`SELECT * FROM subscriptions WHERE id = ${subscriptionId} LIMIT 1`;
      if (subs.length === 0) return c.json({ error: "No encontrada" }, 404);
      const sub = subs[0];

      if (user.role !== 'superadmin' && user.organization_id !== sub.organization_id) return c.json({ error: "Acceso denegado" }, 403);

      if (customer_name !== undefined || customer_phone !== undefined || customer_email !== undefined) {
        const updateCustomerData: any = { updated_at: getLocalIsoString() };
        if (customer_name !== undefined) updateCustomerData.name = customer_name;
        if (customer_phone !== undefined) updateCustomerData.phone = customer_phone;
        if (customer_email !== undefined) updateCustomerData.email = customer_email || null;
        await tSql`UPDATE customers SET ${tSql(updateCustomerData)} WHERE id = ${sub.customer_id}`;
      }

      const parsedPlanId = plan_id ? parseInt(plan_id, 10) : null;
      const planToUse = parsedPlanId || sub.plan_id;
      const isUpgrade = parsedPlanId && parsedPlanId !== sub.plan_id && upgrade_amount > 0;
      
      let startDateToUse = start_date || (sub.start_date ? (typeof sub.start_date === 'string' ? sub.start_date.split('T')[0] : sub.start_date.toISOString().split('T')[0]) : getLocalTodayString());

      if (isUpgrade) startDateToUse = sub.start_date ? (typeof sub.start_date === 'string' ? sub.start_date.split('T')[0] : sub.start_date.toISOString().split('T')[0]) : getLocalTodayString();

      let endDate = sub.end_date ? (typeof sub.end_date === 'string' ? sub.end_date.split('T')[0] : sub.end_date.toISOString().split('T')[0]) : null;
      
      if ((parsedPlanId && parsedPlanId !== sub.plan_id) || (start_date && start_date !== sub.start_date) || isUpgrade) {
        const plans = await tSql`SELECT duration_type, duration_months FROM subscription_plans WHERE id = ${planToUse} AND organization_id = ${sub.organization_id} LIMIT 1`;
        if (plans.length > 0) {
          const plan = plans[0];
          if (plan.duration_type === 'monthly') endDate = addMonthsToDateString(startDateToUse, Number(plan.duration_months) || 1);
          else endDate = addYearsToDateString(startDateToUse, 1);
        }
      }

      const updateSubData: any = { end_date: endDate, notes: notes || null, updated_at: getLocalIsoString() };
      if (parsedPlanId) updateSubData.plan_id = parsedPlanId;
      if (start_date && !isUpgrade) updateSubData.start_date = start_date;
      else if (isUpgrade) updateSubData.start_date = startDateToUse;

      await tSql`UPDATE subscriptions SET ${tSql(updateSubData)} WHERE id = ${subscriptionId}`;

      if (isUpgrade) {
        await tSql`INSERT INTO payments (organization_id, subscription_id, amount, payment_method, status, payment_date, payment_type, is_platform_income) VALUES (${sub.organization_id}, ${subscriptionId}, ${upgrade_amount}, 'other', 'confirmed', NOW(), 'upgrade', false)`;
      }

      const todayStr = getLocalTodayString();
      const updatedSubs = await tSql`SELECT * FROM subscriptions WHERE id = ${subscriptionId} LIMIT 1`;
      
      if (updatedSubs.length > 0 && updatedSubs[0].status !== 'cancelled') {
        const updatedSub = updatedSubs[0];
        const sDateStr = updatedSub.start_date ? (typeof updatedSub.start_date === 'string' ? updatedSub.start_date.split('T')[0] : updatedSub.start_date.toISOString().split('T')[0]) : null;
        const eDateStr = updatedSub.end_date ? (typeof updatedSub.end_date === 'string' ? updatedSub.end_date.split('T')[0] : updatedSub.end_date.toISOString().split('T')[0]) : null;
        let newStatus = updatedSub.status;
        if (sDateStr && eDateStr && sDateStr <= todayStr && eDateStr >= todayStr) newStatus = 'active';
        else if (eDateStr && eDateStr < todayStr) newStatus = 'expired';
        else if (sDateStr && sDateStr > todayStr) newStatus = 'pending';
        if (newStatus !== updatedSub.status) await tSql`UPDATE subscriptions SET status = ${newStatus} WHERE id = ${subscriptionId}`;
      }
      return c.json({ message: "Actualizada" });
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.put("/api/subscriptions/:id/status", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const subscriptionId = c.req.param("id");
    const { status } = await c.req.json();
    if (!['pending', 'active', 'expired', 'cancelled'].includes(status)) return c.json({ error: "Estado inválido" }, 400);

    if (user.role !== 'superadmin') {
      const subs = await sql`SELECT organization_id FROM subscriptions WHERE id = ${subscriptionId} LIMIT 1`;
      if (subs.length === 0 || subs[0].organization_id !== user.organization_id) return c.json({ error: "Acceso denegado" }, 403);
    }
    await sql`UPDATE subscriptions SET status = ${status}, updated_at = NOW() WHERE id = ${subscriptionId}`;
    return c.json({ message: "Estado actualizado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.delete("/api/subscriptions/:id", async (c) => {
  try {
    const user = c.get('jwtPayload');
    if (user.role === 'employee') return c.json({ error: "Los empleados no pueden borrar suscripciones" }, 403);
    const subscriptionId = c.req.param("id");
    const subs = await sql`SELECT organization_id FROM subscriptions WHERE id = ${subscriptionId} LIMIT 1`;
    if (subs.length === 0) return c.json({ error: "No encontrada" }, 404);
    if (user.role !== 'superadmin' && user.organization_id !== subs[0].organization_id) return c.json({ error: "Acceso denegado" }, 403);
    
    await sql`UPDATE payments SET subscription_id = NULL WHERE subscription_id = ${subscriptionId}`;
    await sql`DELETE FROM subscriptions WHERE id = ${subscriptionId}`;
    
    return c.json({ message: "Eliminada" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/customers", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const organizationId = c.req.query("organization_id");
    const page = parseInt(c.req.query("page") || "1", 10) || 1;
    const limit = parseInt(c.req.query("limit") || "50", 10) || 50;
    const offset = (page - 1) * limit;

    if (!organizationId) return c.json({ error: "organization_id requerido" }, 400);
    if (user.role !== 'superadmin' && user.organization_id !== parseInt(organizationId)) return c.json({ error: "Acceso denegado" }, 403);
    
    const countResult = await sql`SELECT COUNT(*) FROM customers WHERE organization_id = ${organizationId}`;
    const total = parseInt(countResult[0].count, 10);
    
    const customers = await sql`
      SELECT * FROM customers 
      WHERE organization_id = ${organizationId} 
      ORDER BY name ASC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    return c.json({ 
      customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/api/customers", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const { organization_id, name, phone, email, notes } = await c.req.json();
    
    if (user.role !== 'superadmin' && user.organization_id !== Number(organization_id)) {
      return c.json({ error: "Acceso denegado: No puedes crear registros para otra organización" }, 403);
    }
    
    const newCust = await sql`INSERT INTO customers (organization_id, name, phone, email, notes) VALUES (${organization_id}, ${name.trim()}, ${phone.trim()}, ${email?.trim() || null}, ${notes?.trim() || null}) RETURNING id`;
    return c.json({ message: "Creado", customer: { id: newCust[0].id, organization_id, name, phone, email, notes } });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

// PLANS AND USERS
app.get("/api/subscription-plans", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const organizationId = c.req.query("organization_id");
    if (!organizationId) return c.json({ error: "organization_id requerido" }, 400);
    if (user.role !== 'superadmin' && user.organization_id !== parseInt(organizationId)) return c.json({ error: "Acceso denegado" }, 403);
    const plans = await sql`SELECT * FROM subscription_plans WHERE organization_id = ${organizationId} AND is_active = true ORDER BY name ASC`;
    return c.json({ plans });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/api/subscription-plans", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const { organization_id, name, duration_months, price, benefits } = await c.req.json();
    if (!organization_id || !name || !price) return c.json({ error: "Faltan campos" }, 400);
    if (user.role !== 'superadmin' && user.organization_id !== organization_id) return c.json({ error: "Acceso denegado" }, 403);
    if (user.role === 'admin' || user.role === 'employee') {
      const admins = await sql`SELECT sp.plan_limit FROM users u LEFT JOIN saas_plans sp ON u.plan_id = sp.id WHERE u.organization_id = ${organization_id} AND u.role = 'admin' LIMIT 1`;
      if (admins.length > 0 && admins[0].plan_limit) {
        const counts = await sql`SELECT COUNT(*) as count FROM subscription_plans WHERE organization_id = ${organization_id}`;
        if (counts[0].count >= admins[0].plan_limit) return c.json({ error: `Límite alcanzado` }, 400);
      }
    }
    const newPlan = await sql`INSERT INTO subscription_plans (organization_id, name, duration_months, duration_type, price, benefits) VALUES (${organization_id}, ${name}, ${duration_months || 1}, 'monthly', ${price}, ${benefits || null}) RETURNING id`;
    return c.json({ message: "Creado", plan_id: newPlan[0].id });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.put("/api/subscription-plans/:id", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const planId = c.req.param("id");
    
    const targetPlan = await sql`SELECT organization_id FROM subscription_plans WHERE id = ${planId} LIMIT 1`;
    if (targetPlan.length === 0) return c.json({ error: "Plan no encontrado" }, 404);
    if (user.role !== 'superadmin' && targetPlan[0].organization_id !== user.organization_id) return c.json({ error: "Acceso denegado" }, 403);

    const { name, duration_months, price, benefits } = await c.req.json();
    await sql`UPDATE subscription_plans SET name = ${name}, duration_months = ${duration_months || 1}, price = ${price}, benefits = ${benefits || null}, updated_at = NOW() WHERE id = ${planId}`;
    await sql`UPDATE subscriptions SET end_date = (start_date::date + interval '1 month' * ${duration_months || 1})::date WHERE plan_id = ${planId} AND status IN ('active', 'pending')`;
    return c.json({ message: "Actualizado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.delete("/api/subscription-plans/:id", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const planId = c.req.param("id");
    
    const targetPlan = await sql`SELECT organization_id FROM subscription_plans WHERE id = ${planId} LIMIT 1`;
    if (targetPlan.length === 0) return c.json({ error: "Plan no encontrado" }, 404);
    if (user.role !== 'superadmin' && targetPlan[0].organization_id !== user.organization_id) return c.json({ error: "Acceso denegado" }, 403);

    const inUse = await sql`SELECT id FROM subscriptions WHERE plan_id = ${planId} LIMIT 1`;
    if (inUse.length > 0) return c.json({ error: "En uso" }, 400);
    await sql`UPDATE subscription_plans SET is_active = false, updated_at = NOW() WHERE id = ${planId}`;
    return c.json({ message: "Eliminado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/users", async (c) => {
  try {
    const organizationId = c.req.query("organization_id");
    const user = c.get('jwtPayload');
    if (!organizationId) return c.json({ error: "organization_id requerido" }, 400);
    if (user.role !== 'superadmin' && user.organization_id !== Number(organizationId)) {
      return c.json({ error: "Acceso denegado: No puedes leer datos de otra organización" }, 403);
    }
    const role = c.req.query("role");
    const page = parseInt(c.req.query("page") || "1", 10) || 1;
    const limit = parseInt(c.req.query("limit") || "50", 10) || 50;
    const offset = (page - 1) * limit;

    let countResult;
    let users;

    if (role) {
      countResult = await sql`SELECT COUNT(*) FROM users WHERE organization_id = ${organizationId} AND role = ${role}`;
      users = await sql`SELECT * FROM users WHERE organization_id = ${organizationId} AND role = ${role} ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`;
    } else {
      countResult = await sql`SELECT COUNT(*) FROM users WHERE organization_id = ${organizationId}`;
      users = await sql`SELECT * FROM users WHERE organization_id = ${organizationId} ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`;
    }

    const total = parseInt(countResult[0].count, 10);

    const safeUsers = users.map(u => { 
      const { password_hash, ...rest } = u as any; 
      return rest; 
    });

    return c.json({ 
      users: safeUsers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/api/users", validateJson(UserCreateSchema), async (c) => {
  try {
    const user = c.get('jwtPayload');
    const { organization_id, name, email, phone, password, role } = c.req.valid('json');

    if (user.role !== 'superadmin' && user.organization_id !== Number(organization_id)) {
      return c.json({ error: "Acceso denegado: No puedes crear registros para otra organización" }, 403);
    }
    
    const exist = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (exist.length > 0) return c.json({ error: "Email en uso" }, 400);

    if (role === 'employee') {
      const admins = await sql`SELECT sp.employee_limit FROM users u LEFT JOIN saas_plans sp ON u.plan_id = sp.id WHERE u.organization_id = ${organization_id} AND u.role = 'admin' LIMIT 1`;
      if (admins.length > 0 && admins[0].employee_limit) {
        const counts = await sql`SELECT COUNT(*) as count FROM users WHERE organization_id = ${organization_id} AND role = 'employee'`;
        if (counts[0].count >= admins[0].employee_limit) return c.json({ error: `Límite alcanzado` }, 400);
      }
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await sql`INSERT INTO users (organization_id, name, email, phone, role, password_hash) VALUES (${organization_id}, ${name}, ${email}, ${phone || null}, ${role || 'employee'}, ${passwordHash}) RETURNING id`;
    return c.json({ message: "Creado", user_id: newUser[0].id });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.put("/api/users/:id", validateJson(UserUpdateSchema), async (c) => {
  try {
    const user = c.get('jwtPayload');
    const userId = c.req.param("id");
    
    const targetUser = await sql`SELECT organization_id FROM users WHERE id = ${userId} LIMIT 1`;
    if (targetUser.length === 0) return c.json({ error: "Usuario no encontrado" }, 404);
    if (user.role !== 'superadmin' && targetUser[0].organization_id !== user.organization_id) return c.json({ error: "Acceso denegado" }, 403);

    const { name, email, phone, password } = c.req.valid('json');
    const updateData: any = { name, email, phone: phone || null, updated_at: getLocalIsoString() };
    if (password) updateData.password_hash = await bcrypt.hash(password, 10);
    await sql`UPDATE users SET ${sql(updateData)} WHERE id = ${userId}`;
    return c.json({ message: "Actualizado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.delete("/api/users/:id", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const userId = c.req.param("id");

    const targetUser = await sql`SELECT role, organization_id FROM users WHERE id = ${userId} LIMIT 1`;
    if (targetUser.length === 0) return c.json({ error: "Usuario no encontrado" }, 404);
    if (user.role !== 'superadmin' && targetUser[0].organization_id !== user.organization_id) return c.json({ error: "Acceso denegado" }, 403);
    if (targetUser[0].role === 'admin' || targetUser[0].role === 'superadmin') return c.json({ error: "No se puede eliminar admin" }, 400);
    
    await sql`UPDATE users SET is_active = false, updated_at = NOW() WHERE id = ${userId}`;
    return c.json({ message: "Eliminado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

// INCOME
const formatIncomeData = (data: any[]) => {
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return data.map(d => {
    if (!d.month_str) return { month: 'Desconocido', amount: Number(d.total) || 0 };
    const parts = d.month_str.split('-');
    if (parts.length !== 2) return { month: 'Desconocido', amount: Number(d.total) || 0 };
    const [year, month] = parts;
    return { month: `${monthNames[parseInt(month)-1]} ${year}`, amount: Number(d.total) };
  });
};

app.use('/api/admin/income*', async (c, next) => {
  const user = c.get('jwtPayload');
  if (user.role === 'employee') return c.json({ error: "Acceso denegado para empleados" }, 403);
  await next();
});

app.get("/api/admin/income", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const orgId = user.organization_id;
    if (!orgId) return c.json({ error: "Sin organización" }, 400);

    const todayStr = getLocalTodayString();
    const currentMonthPrefix = todayStr.substring(0, 7);

    const page = parseInt(c.req.query("page") || "1", 10) || 1;
    const limit = parseInt(c.req.query("limit") || "50", 10) || 50;
    const offset = (page - 1) * limit;

    const search = c.req.query("search");
    const type = c.req.query("type");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const searchCondition = search ? sql` AND (c.name ILIKE ${'%' + search + '%'} OR sp.name ILIKE ${'%' + search + '%'})` : sql``;
    const typeCondition = type && type !== 'all' ? sql` AND p.payment_type = ${type}` : sql``;
    const startCondition = startDate ? sql` AND COALESCE(p.payment_date, p.created_at, NOW()) >= ${startDate}` : sql``;
    const endCondition = endDate ? sql` AND COALESCE(p.payment_date, p.created_at, NOW()) <= ${endDate + ' 23:59:59'}` : sql``;

    const summary = await sql`
      SELECT TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM') as month_str, SUM(p.amount) as total
      FROM payments p
      LEFT JOIN subscriptions s ON p.subscription_id = s.id 
      LEFT JOIN customers c ON s.customer_id = c.id 
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE p.organization_id = ${orgId} AND p.is_platform_income = false AND p.status = 'confirmed' AND COALESCE(p.payment_date, p.created_at, NOW()) >= NOW() - INTERVAL '12 months'
      ${searchCondition} ${typeCondition} ${startCondition} ${endCondition}
      GROUP BY TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM') ORDER BY TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM') ASC
    `;

    const countResult = await sql`
      SELECT COUNT(*) 
      FROM payments p 
      LEFT JOIN subscriptions s ON p.subscription_id = s.id 
      LEFT JOIN customers c ON s.customer_id = c.id 
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE p.organization_id = ${orgId} AND p.is_platform_income = false AND p.status != 'cancelled'
      ${searchCondition} ${typeCondition} ${startCondition} ${endCondition}
    `;
    const total = parseInt(countResult[0].count, 10);

    const detailsQuery = await sql`
      SELECT p.*, TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM-DD"T"HH24:MI:SS') as payment_date_formatted, c.name as customer_name, sp.name as plan_name
      FROM payments p LEFT JOIN subscriptions s ON p.subscription_id = s.id LEFT JOIN customers c ON s.customer_id = c.id LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE p.organization_id = ${orgId} AND p.is_platform_income = false AND p.status != 'cancelled'
      ${searchCondition} ${typeCondition} ${startCondition} ${endCondition}
      ORDER BY COALESCE(p.payment_date, p.created_at, NOW()) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const details = detailsQuery.map(d => ({ ...d, payment_date: d.payment_date_formatted }));
    
    const summaryTotals = await sql`
      SELECT 
        COALESCE(SUM(p.amount), 0) as total_income,
        COALESCE(SUM(CASE WHEN TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM') = ${currentMonthPrefix} THEN p.amount ELSE 0 END), 0) as month_income,
        COALESCE(SUM(CASE WHEN TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM-DD') = ${todayStr} THEN p.amount ELSE 0 END), 0) as day_income
      FROM payments p
      LEFT JOIN subscriptions s ON p.subscription_id = s.id 
      LEFT JOIN customers c ON s.customer_id = c.id 
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE p.organization_id = ${orgId} AND p.is_platform_income = false AND p.status = 'confirmed'
      ${searchCondition} ${typeCondition} ${startCondition} ${endCondition}
    `;

    return c.json({ 
      summary: formatIncomeData(summary), 
      details, 
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      totals: { all: Number(summaryTotals[0].total_income), month: Number(summaryTotals[0].month_income), day: Number(summaryTotals[0].day_income) }
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/superadmin/income", async (c) => {
  try {
    const todayStr = getLocalTodayString();
    const currentMonthPrefix = todayStr.substring(0, 7);

    const page = parseInt(c.req.query("page") || "1", 10) || 1;
    const limit = parseInt(c.req.query("limit") || "50", 10) || 50;
    const offset = (page - 1) * limit;

    const search = c.req.query("search");
    const type = c.req.query("type");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const searchCondition = search ? sql` AND o.name ILIKE ${'%' + search + '%'}` : sql``;
    const typeCondition = type && type !== 'all' ? sql` AND p.payment_type = ${type}` : sql``;
    const startCondition = startDate ? sql` AND COALESCE(p.payment_date, p.created_at, NOW()) >= ${startDate}` : sql``;
    const endCondition = endDate ? sql` AND COALESCE(p.payment_date, p.created_at, NOW()) <= ${endDate + ' 23:59:59'}` : sql``;

    const summary = await sql`
      SELECT TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM') as month_str, SUM(p.amount) as total
      FROM payments p
      LEFT JOIN organizations o ON p.organization_id = o.id
      WHERE p.is_platform_income = true AND p.status = 'confirmed' AND COALESCE(p.payment_date, p.created_at, NOW()) >= NOW() - INTERVAL '12 months'
      ${searchCondition} ${typeCondition} ${startCondition} ${endCondition}
      GROUP BY TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM') ORDER BY TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM') ASC
    `;

    const countResult = await sql`
      SELECT COUNT(*) 
      FROM payments p 
      LEFT JOIN organizations o ON p.organization_id = o.id
      WHERE p.is_platform_income = true AND p.status != 'cancelled'
      ${searchCondition} ${typeCondition} ${startCondition} ${endCondition}
    `;
    const total = parseInt(countResult[0].count, 10);

    const detailsQuery = await sql`
      SELECT p.*, TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM-DD"T"HH24:MI:SS') as payment_date_formatted, o.name as organization_name
      FROM payments p LEFT JOIN organizations o ON p.organization_id = o.id
      WHERE p.is_platform_income = true AND p.status != 'cancelled'
      ${searchCondition} ${typeCondition} ${startCondition} ${endCondition}
      ORDER BY COALESCE(p.payment_date, p.created_at, NOW()) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const details = detailsQuery.map(d => ({ ...d, payment_date: d.payment_date_formatted }));
    
    const summaryTotals = await sql`
      SELECT 
        COALESCE(SUM(p.amount), 0) as total_income,
        COALESCE(SUM(CASE WHEN TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM') = ${currentMonthPrefix} THEN p.amount ELSE 0 END), 0) as month_income,
        COALESCE(SUM(CASE WHEN TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM-DD') = ${todayStr} THEN p.amount ELSE 0 END), 0) as day_income
      FROM payments p
      LEFT JOIN organizations o ON p.organization_id = o.id
      WHERE p.is_platform_income = true AND p.status = 'confirmed'
      ${searchCondition} ${typeCondition} ${startCondition} ${endCondition}
    `;

    return c.json({ 
      summary: formatIncomeData(summary), 
      details, 
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      totals: { all: Number(summaryTotals[0].total_income), month: Number(summaryTotals[0].month_income), day: Number(summaryTotals[0].day_income) }
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/admin/income/export", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const orgId = user.organization_id;
    if (!orgId) return c.json({ error: "Sin organización" }, 400);

    const search = c.req.query("search");
    const type = c.req.query("type");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const searchCondition = search ? sql` AND (c.name ILIKE ${'%' + search + '%'} OR sp.name ILIKE ${'%' + search + '%'})` : sql``;
    const typeCondition = type && type !== 'all' ? sql` AND p.payment_type = ${type}` : sql``;
    const startCondition = startDate ? sql` AND COALESCE(p.payment_date, p.created_at, NOW()) >= ${startDate}` : sql``;
    const endCondition = endDate ? sql` AND COALESCE(p.payment_date, p.created_at, NOW()) <= ${endDate + ' 23:59:59'}` : sql``;

    const detailsQuery = await sql`
      SELECT p.*, TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM-DD"T"HH24:MI:SS') as payment_date_formatted, c.name as customer_name, sp.name as plan_name
      FROM payments p LEFT JOIN subscriptions s ON p.subscription_id = s.id LEFT JOIN customers c ON s.customer_id = c.id LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE p.organization_id = ${orgId} AND p.is_platform_income = false AND p.status != 'cancelled'
      ${searchCondition} ${typeCondition} ${startCondition} ${endCondition}
      ORDER BY COALESCE(p.payment_date, p.created_at, NOW()) DESC
    `;
    const details = detailsQuery.map(d => ({ ...d, payment_date: d.payment_date_formatted }));
    
    return c.json({ details });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/superadmin/income/export", async (c) => {
  try {
    const search = c.req.query("search");
    const type = c.req.query("type");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const searchCondition = search ? sql` AND o.name ILIKE ${'%' + search + '%'}` : sql``;
    const typeCondition = type && type !== 'all' ? sql` AND p.payment_type = ${type}` : sql``;
    const startCondition = startDate ? sql` AND COALESCE(p.payment_date, p.created_at, NOW()) >= ${startDate}` : sql``;
    const endCondition = endDate ? sql` AND COALESCE(p.payment_date, p.created_at, NOW()) <= ${endDate + ' 23:59:59'}` : sql``;

    const detailsQuery = await sql`
      SELECT p.*, TO_CHAR(COALESCE(p.payment_date, p.created_at, NOW()), 'YYYY-MM-DD"T"HH24:MI:SS') as payment_date_formatted, o.name as organization_name
      FROM payments p LEFT JOIN organizations o ON p.organization_id = o.id
      WHERE p.is_platform_income = true AND p.status != 'cancelled'
      ${searchCondition} ${typeCondition} ${startCondition} ${endCondition}
      ORDER BY COALESCE(p.payment_date, p.created_at, NOW()) DESC
    `;
    const details = detailsQuery.map(d => ({ ...d, payment_date: d.payment_date_formatted }));
    
    return c.json({ details });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.delete("/api/payments/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const user = c.get('jwtPayload');
    if (user.role === 'employee') return c.json({ error: "Los empleados no pueden borrar pagos" }, 403);
    const payment = await sql`SELECT organization_id, is_platform_income FROM payments WHERE id = ${id} LIMIT 1`;
    if (payment.length === 0) return c.json({ error: "Pago no encontrado" }, 404);
    if (user.role !== 'superadmin' && (payment[0].organization_id !== user.organization_id || payment[0].is_platform_income)) return c.json({ error: "No autorizado" }, 403);
    await sql`UPDATE payments SET status = 'cancelled' WHERE id = ${id}`;
    return c.json({ message: "Eliminado lógicamente" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/api/payments/bulk-delete", async (c) => {
  try {
    const user = c.get('jwtPayload');
    if (user.role === 'employee') return c.json({ error: "Los empleados no pueden borrar pagos" }, 403);
    
    const { ids } = await c.req.json();
    if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: "No se proporcionaron IDs" }, 400);

    if (user.role !== 'superadmin') {
      const payments = await sql`SELECT id, organization_id, is_platform_income FROM payments WHERE id IN ${sql(ids)}`;
      for (const p of payments) {
        if (p.organization_id !== user.organization_id || p.is_platform_income) {
          return c.json({ error: "No autorizado para eliminar algunos de estos pagos" }, 403);
        }
      }
    }

    await sql`UPDATE payments SET status = 'cancelled' WHERE id IN ${sql(ids)}`;
    return c.json({ message: "Eliminados lógicamente" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

// DASHBOARD METRICS
app.get("/api/admin/dashboard-metrics", async (c) => {
  try {
    const orgId = c.req.query("organization_id");
    const user = c.get('jwtPayload');
    if (!orgId) return c.json({ error: "organization_id requerido" }, 400);
    if (user.role !== 'superadmin' && user.organization_id !== Number(orgId)) {
      return c.json({ error: "Acceso denegado: No puedes leer datos de otra organización" }, 403);
    }
    const todayStr = getLocalTodayString();
    
    const planLimits = await sql`
      SELECT sp.name, sp.subscription_limit, sp.employee_limit, sp.plan_limit 
      FROM users u LEFT JOIN saas_plans sp ON u.plan_id = sp.id 
      WHERE u.organization_id = ${orgId} AND u.role = 'admin' LIMIT 1
    `;
    
    const counts = await sql`
      SELECT 
        (SELECT COUNT(*) FROM subscriptions WHERE organization_id = ${orgId}) as current_usage,
        (SELECT COUNT(*) FROM users WHERE organization_id = ${orgId} AND role = 'employee' AND is_active = true) as employee_count,
        (SELECT COUNT(*) FROM subscription_plans WHERE organization_id = ${orgId}) as plans_count,
        (SELECT COUNT(*) FROM subscriptions WHERE organization_id = ${orgId} AND status = 'active' AND end_date > (DATE(${todayStr}) + INTERVAL '3 days')) as active_subs,
        (SELECT COUNT(*) FROM subscriptions WHERE organization_id = ${orgId} AND status = 'expired') as expired_subs,
        (SELECT COUNT(*) FROM subscriptions WHERE organization_id = ${orgId} AND status = 'cancelled') as cancelled_subs,
        (SELECT COUNT(*) FROM subscriptions WHERE organization_id = ${orgId} AND status = 'active' AND end_date <= (DATE(${todayStr}) + INTERVAL '3 days')) as expiring_subs
    `;

    const pd = planLimits[0] || {};
    const cd = counts[0] || {};

    return c.json({
      plan_name: pd.name || 'Sin Plan',
      plan_limit: pd.subscription_limit || 0,
      current_usage: Number(cd.current_usage) || 0,
      employee_limit: pd.employee_limit || 0,
      employee_count: Number(cd.employee_count) || 0,
      plan_creation_limit: pd.plan_limit || 0,
      plans_count: Number(cd.plans_count) || 0,
      active_subscriptions: Number(cd.active_subs) || 0,
      expired_subscriptions: Number(cd.expired_subs) || 0,
      cancelled_subscriptions: Number(cd.cancelled_subs) || 0,
      expiring_subscriptions: Number(cd.expiring_subs) || 0
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/superadmin/stats", async (c) => {
  try {
    const todayStr = getLocalTodayString();
    const currentMonth = todayStr.substring(0, 7);

    const counts = await sql`
      SELECT 
        COUNT(*) as total_subs,
        SUM(CASE WHEN is_active = true AND subscription_end_date > (DATE(${todayStr}) + INTERVAL '3 days') THEN 1 ELSE 0 END) as active_subs,
        SUM(CASE WHEN is_active = true AND subscription_end_date >= ${todayStr} AND subscription_end_date <= (DATE(${todayStr}) + INTERVAL '3 days') THEN 1 ELSE 0 END) as expiring_subs,
        SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as cancelled_subs,
        SUM(CASE WHEN is_active = true AND subscription_end_date < ${todayStr} THEN 1 ELSE 0 END) as expired_subs
      FROM users WHERE role = 'admin'
    `;
    
    const revenue = await sql`
      SELECT 
        COALESCE(SUM(CASE WHEN TO_CHAR(COALESCE(payment_date, created_at, NOW()), 'YYYY-MM-DD') = ${todayStr} THEN amount ELSE 0 END), 0) as daily_rev,
        COALESCE(SUM(CASE WHEN TO_CHAR(COALESCE(payment_date, created_at, NOW()), 'YYYY-MM') = ${currentMonth} THEN amount ELSE 0 END), 0) as monthly_rev,
        COALESCE(SUM(CASE WHEN COALESCE(payment_date, created_at, NOW()) >= NOW() - INTERVAL '12 months' THEN amount ELSE 0 END), 0) as total_rev
      FROM payments
      WHERE is_platform_income = true AND status = 'confirmed'
    `;

    const cd = counts[0] || {};
    const rd = revenue[0] || {};

    return c.json({
      totalSubscriptions: Number(cd.total_subs) || 0,
      activeSubscriptions: Number(cd.active_subs) || 0,
      expiredSubscriptions: Number(cd.expired_subs) || 0,
      cancelledSubscriptions: Number(cd.cancelled_subs) || 0,
      expiringSubscriptions: Number(cd.expiring_subs) || 0,
      dailyRevenue: Number(rd.daily_rev) || 0,
      monthlyRevenue: Number(rd.monthly_rev) || 0,
      totalRevenue: Number(rd.total_rev) || 0
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

// SAAS PLANS, ADMINS Y SUPERADMIN
app.get("/api/superadmin/saas-plans", async (c) => {
  try {
    const plans = await sql`SELECT * FROM saas_plans ORDER BY is_free_plan DESC, price ASC`;
    return c.json({ plans });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/api/superadmin/saas-plans", async (c) => {
  try {
    const { name, duration_months, price, subscription_limit, employee_limit, plan_limit, benefits } = await c.req.json();
    const newPlan = await sql`INSERT INTO saas_plans (name, duration_months, duration_type, price, subscription_limit, employee_limit, plan_limit, benefits) VALUES (${name}, ${duration_months || 1}, 'monthly', ${price}, ${subscription_limit}, ${employee_limit || 10}, ${plan_limit || 10}, ${benefits || null}) RETURNING id`;
    return c.json({ message: "Creado", plan_id: newPlan[0].id });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.put("/api/superadmin/saas-plans/:id", async (c) => {
  try {
    const planId = c.req.param("id");
    const { name, duration_months, price, subscription_limit, employee_limit, plan_limit, benefits } = await c.req.json();
    await sql`UPDATE saas_plans SET name=${name}, duration_months=${duration_months || 1}, price=${price}, subscription_limit=${subscription_limit}, employee_limit=${employee_limit || 10}, plan_limit=${plan_limit || 10}, benefits=${benefits || null}, updated_at=NOW() WHERE id=${planId}`;
    return c.json({ message: "Actualizado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.put("/api/superadmin/saas-plans/:id/toggle", async (c) => {
  try {
    await sql`UPDATE saas_plans SET is_active=${(await c.req.json()).is_active} WHERE id=${c.req.param("id")}`;
    return c.json({ message: "Actualizado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.delete("/api/superadmin/saas-plans/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const plan = await sql`SELECT is_free_plan FROM saas_plans WHERE id = ${id} LIMIT 1`;
    if (plan.length > 0 && plan[0].is_free_plan) return c.json({ error: "No se puede eliminar plan GRATIS" }, 400);
    const inUse = await sql`SELECT id FROM users WHERE plan_id = ${id} LIMIT 1`;
    if (inUse.length > 0) return c.json({ error: "En uso" }, 400);
    await sql`UPDATE saas_plans SET is_active = false, updated_at = NOW() WHERE id = ${id}`;
    return c.json({ message: "Eliminado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/api/superadmin/create-subscription", validateJson(SuperAdminCreateSubscriptionSchema), async (c) => {
  try {
    const { name, email, phone, plan_id, organization_name, password, start_date, discount } = c.req.valid('json');
    
    return await sql.begin(async (tSql) => {
      const existing = await tSql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
      if (existing.length > 0) return c.json({ error: "Correo en uso" }, 400);
      const plans = await tSql`SELECT * FROM saas_plans WHERE id = ${plan_id} LIMIT 1`;
      if (plans.length === 0) return c.json({ error: "Plan no encontrado" }, 404);
      
      const plan = plans[0];
      const org = await tSql`INSERT INTO organizations (name) VALUES (${organization_name}) RETURNING id`;
      const sDateStr = start_date || getLocalTodayString();
      let eDateStr;
      if (plan.duration_months) eDateStr = addMonthsToDateString(sDateStr, Number(plan.duration_months));
      else eDateStr = addYearsToDateString(sDateStr, 1);
      
      const passwordHash = await bcrypt.hash(password, 10);
      await tSql`INSERT INTO users (email, name, role, organization_id, phone, plan_id, subscription_start_date, subscription_end_date, password_hash, is_active) VALUES (${email}, ${name}, 'admin', ${org[0].id}, ${phone || null}, ${plan_id}, ${sDateStr}, ${eDateStr}, ${passwordHash}, true)`;

      const finalAmount = Math.max(0, plan.price - (Number(discount) || 0));
      await tSql`INSERT INTO payments (organization_id, amount, payment_method, status, payment_date, payment_type, is_platform_income) VALUES (${org[0].id}, ${finalAmount}, 'other', 'confirmed', NOW(), 'new_subscription', true)`;
      return c.json({ message: "Creado" });
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/api/superadmin/admin-subscriptions/:id/renew", async (c) => {
  try {
    const userId = c.req.param("id");
    let body: any = {}; try { body = await c.req.json(); } catch(e) {}
    const newPlanId = body.plan_id;
    const discount = body.discount;
    
    return await sql.begin(async (tSql) => {
      const users = await tSql`SELECT u.*, p.price, p.duration_months, p.duration_type FROM users u JOIN saas_plans p ON u.plan_id = p.id WHERE u.id = ${userId} AND u.role = 'admin' LIMIT 1`;
      if (users.length === 0) return c.json({ error: "No encontrado" }, 404);
      const targetUser = users[0];
      
      let planToUse = { id: targetUser.plan_id, price: targetUser.price, duration_months: targetUser.duration_months, duration_type: targetUser.duration_type };
      if (newPlanId && newPlanId !== targetUser.plan_id) {
        const newPlans = await tSql`SELECT id, price, duration_months, duration_type FROM saas_plans WHERE id = ${newPlanId} LIMIT 1`;
        if (newPlans.length > 0) planToUse = newPlans[0] as any;
        else return c.json({ error: "Plan inexistente" }, 400);
      }
      
      const todayStr = getLocalTodayString();
      let currentEndDateStr = targetUser.subscription_end_date ? (typeof targetUser.subscription_end_date === 'string' ? targetUser.subscription_end_date.split('T')[0] : targetUser.subscription_end_date.toISOString().split('T')[0]) : todayStr;
      let newStartDateStr = null;

      if (currentEndDateStr < todayStr) {
        currentEndDateStr = todayStr;
        newStartDateStr = todayStr;
      }

      let newEndDateStr;
      if (planToUse.duration_months) newEndDateStr = addMonthsToDateString(currentEndDateStr, Number(planToUse.duration_months));
      else if (planToUse.duration_type === 'monthly') newEndDateStr = addMonthsToDateString(currentEndDateStr, 1);
      else newEndDateStr = addYearsToDateString(currentEndDateStr, 1);

      if (newStartDateStr) await tSql`UPDATE users SET plan_id = ${planToUse.id}, subscription_start_date = ${newStartDateStr}, subscription_end_date = ${newEndDateStr}, is_active = true, updated_at = NOW() WHERE id = ${userId}`;
      else await tSql`UPDATE users SET plan_id = ${planToUse.id}, subscription_end_date = ${newEndDateStr}, is_active = true, updated_at = NOW() WHERE id = ${userId}`;

      const finalAmount = Math.max(0, planToUse.price - (Number(discount) || 0));
      await tSql`INSERT INTO payments (organization_id, amount, payment_method, status, payment_date, payment_type, is_platform_income) VALUES (${targetUser.organization_id}, ${finalAmount}, 'other', 'confirmed', NOW(), 'renewal', true)`;
      return c.json({ message: "Renovación exitosa", new_end_date: newEndDateStr });
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/superadmin/admin-subscriptions", async (c) => {
  try {
    const statusFilter = c.req.query("status") || "all";
    const search = c.req.query("search") || "";
    const sort = c.req.query("sort") || "recent";
    const todayStr = getLocalTodayString();

    const page = parseInt(c.req.query("page") || "1", 10) || 1;
    const limit = parseInt(c.req.query("limit") || "50", 10) || 50;
    const offset = (page - 1) * limit;

    const calcStatusSql = sql`
      CASE
        WHEN u.is_active = false THEN 'cancelled'
        WHEN u.subscription_end_date::date < CURRENT_DATE THEN 'expired'
        WHEN u.subscription_start_date::date > CURRENT_DATE THEN 'pending'
        WHEN u.subscription_end_date::date <= (CURRENT_DATE + 3) THEN 'expiring'
        ELSE 'active'
      END
    `;

    const searchCond = search ? sql` AND (u.name ILIKE ${'%' + search + '%'} OR u.email ILIKE ${'%' + search + '%'} OR o.name ILIKE ${'%' + search + '%'} OR p.name ILIKE ${'%' + search + '%'})` : sql``;
    const statusCond = statusFilter !== 'all' ? sql` AND (${calcStatusSql}) = ${statusFilter}` : sql``;

    let orderByCond;
    if (sort === 'asc') orderByCond = sql`ORDER BY u.name ASC`;
    else if (sort === 'desc_name') orderByCond = sql`ORDER BY u.name DESC`;
    else orderByCond = sql`ORDER BY u.created_at DESC`;

    const countResult = await sql`
      SELECT COUNT(*) FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id 
      LEFT JOIN saas_plans p ON u.plan_id = p.id 
      WHERE u.role = 'admin' ${statusCond} ${searchCond}
    `;
    const total = parseInt(countResult[0].count, 10);

    const users = await sql`
      SELECT u.*, o.name as org_name, p.name as plan_name, p.price as plan_price, p.duration_type,
             ${calcStatusSql} as calc_status
      FROM users u 
      LEFT JOIN organizations o ON u.organization_id = o.id 
      LEFT JOIN saas_plans p ON u.plan_id = p.id 
      WHERE u.role = 'admin' ${statusCond} ${searchCond}
      ${orderByCond} 
      LIMIT ${limit} OFFSET ${offset}
    `;

    const subscriptions = users.map((u: any) => {
      const startDateStr = u.subscription_start_date ? (typeof u.subscription_start_date === 'string' ? u.subscription_start_date.split('T')[0] : u.subscription_start_date.toISOString().split('T')[0]) : null;
      const endDateStr = u.subscription_end_date ? (typeof u.subscription_end_date === 'string' ? u.subscription_end_date.split('T')[0] : u.subscription_end_date.toISOString().split('T')[0]) : null;

      return {
        id: u.id, admin_name: u.name, admin_email: u.email, admin_phone: u.phone,
        start_date: startDateStr, end_date: endDateStr, is_active: u.is_active, created_at: u.created_at,
        organization_name: u.org_name, plan_id: u.plan_id, plan_name: u.plan_name, plan_price: u.plan_price,
        duration_type: u.duration_type, status: u.calc_status
      };
    });
    
    return c.json({ 
      subscriptions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.put("/api/superadmin/admin-subscriptions/:id/status", async (c) => {
  try {
    const { status } = await c.req.json();
    const isActive = (status !== 'cancelled' && status !== 'expired');
    await sql`UPDATE users SET is_active = ${isActive} WHERE id = ${c.req.param("id")}`;
    return c.json({ message: "Actualizado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.delete("/api/superadmin/admin-subscriptions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const u = await sql`SELECT organization_id FROM users WHERE id = ${id} LIMIT 1`;
    if (u.length > 0) {
      await sql`UPDATE payments SET organization_id = NULL WHERE organization_id = ${u[0].organization_id} AND is_platform_income = true`;
      await sql`DELETE FROM organizations WHERE id = ${u[0].organization_id}`;
    }
    return c.json({ message: "Eliminado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.put("/api/superadmin/admin-subscriptions/:id", async (c) => {
  try {
    const userId = c.req.param("id");
    const { name, email, phone, organization_name, plan_id, start_date, password, upgrade_amount } = await c.req.json();
    const curr = await sql`SELECT email, plan_id, subscription_start_date, organization_id FROM users WHERE id = ${userId} LIMIT 1`;
    if (curr.length === 0) return c.json({ error: "Usuario no encontrado" }, 404);

    const updateData: any = { name, email, phone: phone || null, updated_at: getLocalIsoString() };
    if (password) updateData.password_hash = await bcrypt.hash(password, 10);

    const parsedPlanId = plan_id ? parseInt(plan_id, 10) : null;
    const pId = parsedPlanId || curr[0].plan_id;
    const isUpgrade = parsedPlanId && parsedPlanId !== curr[0].plan_id && upgrade_amount > 0;
    
    let sDate = start_date || (curr[0].subscription_start_date ? (typeof curr[0].subscription_start_date === 'string' ? curr[0].subscription_start_date.split('T')[0] : curr[0].subscription_start_date.toISOString().split('T')[0]) : getLocalTodayString());
    if (isUpgrade) sDate = curr[0].subscription_start_date ? (typeof curr[0].subscription_start_date === 'string' ? curr[0].subscription_start_date.split('T')[0] : curr[0].subscription_start_date.toISOString().split('T')[0]) : getLocalTodayString();
    
    if (pId && sDate) {
      const p = await sql`SELECT * FROM saas_plans WHERE id = ${pId} LIMIT 1`;
      if (p.length > 0) {
        if (p[0].duration_months) updateData.subscription_end_date = addMonthsToDateString(sDate, Number(p[0].duration_months));
        else updateData.subscription_end_date = addYearsToDateString(sDate, 1);
        updateData.plan_id = pId;
        if (!isUpgrade && start_date) updateData.subscription_start_date = start_date;
        else if (isUpgrade) updateData.subscription_start_date = sDate;
      }
    }
    
    await sql`UPDATE users SET ${sql(updateData)} WHERE id = ${userId}`;
    if (organization_name && curr[0].organization_id) await sql`UPDATE organizations SET name = ${organization_name} WHERE id = ${curr[0].organization_id}`;

    if (isUpgrade) {
      await sql`INSERT INTO payments (organization_id, amount, payment_method, status, payment_date, payment_type, is_platform_income) VALUES (${curr[0].organization_id}, ${upgrade_amount}, 'other', 'confirmed', NOW(), 'upgrade', true)`;
    }
    return c.json({ message: "Actualizado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

// PAYMENT METHODS
app.get("/api/organization-payment-methods", async (c) => {
  try {
    const orgId = c.req.query("organization_id");
    const user = c.get('jwtPayload');
    if (!orgId) return c.json({ error: "organization_id requerido" }, 400);
    if (user.role !== 'superadmin' && user.organization_id !== Number(orgId)) {
      return c.json({ error: "Acceso denegado: No puedes leer datos de otra organización" }, 403);
    }
    const payment_methods = await sql`SELECT * FROM organization_payment_methods WHERE organization_id = ${orgId} ORDER BY name ASC`;
    return c.json({ payment_methods });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/api/organization-payment-methods", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const { organization_id, name, type, qr_image_url, account_number, account_holder, bank_name } = await c.req.json();
    
    if (user.role !== 'superadmin' && user.organization_id !== Number(organization_id)) {
      return c.json({ error: "Acceso denegado: No puedes crear registros para otra organización" }, 403);
    }
    
    const data = await sql`INSERT INTO organization_payment_methods (organization_id, name, type, qr_image_url, account_number, account_holder, bank_name) VALUES (${organization_id}, ${name}, ${type}, ${qr_image_url || null}, ${account_number || null}, ${account_holder || null}, ${bank_name || null}) RETURNING id`;
    return c.json({ message: "Creado", payment_method_id: data[0].id });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.put("/api/organization-payment-methods/:id", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const id = c.req.param("id");
    
    const targetMethod = await sql`SELECT organization_id FROM organization_payment_methods WHERE id = ${id} LIMIT 1`;
    if (targetMethod.length === 0) return c.json({ error: "Método de pago no encontrado" }, 404);
    if (user.role !== 'superadmin' && targetMethod[0].organization_id !== user.organization_id) return c.json({ error: "Acceso denegado" }, 403);

    const { name, type, qr_image_url, account_number, account_holder, bank_name } = await c.req.json();
    await sql`UPDATE organization_payment_methods SET name=${name}, type=${type}, qr_image_url=${qr_image_url || null}, account_number=${account_number || null}, account_holder=${account_holder || null}, bank_name=${bank_name || null}, updated_at=NOW() WHERE id=${id}`;
    return c.json({ message: "Actualizado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.delete("/api/organization-payment-methods/:id", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const id = c.req.param("id");
    
    const targetMethod = await sql`SELECT organization_id FROM organization_payment_methods WHERE id = ${id} LIMIT 1`;
    if (targetMethod.length === 0) return c.json({ error: "Método de pago no encontrado" }, 404);
    if (user.role !== 'superadmin' && targetMethod[0].organization_id !== user.organization_id) return c.json({ error: "Acceso denegado" }, 403);

    await sql`DELETE FROM organization_payment_methods WHERE id = ${id}`;
    return c.json({ message: "Eliminado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/superadmin/payment-methods", async (c) => {
  try {
    const payment_methods = await sql`SELECT * FROM payment_methods ORDER BY name ASC`;
    return c.json({ payment_methods });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/global-payment-methods", async (c) => {
  try {
    const payment_methods = await sql`SELECT * FROM payment_methods WHERE is_active = true ORDER BY name ASC`;
    return c.json({ payment_methods });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/api/superadmin/payment-methods", async (c) => {
  try {
    const { name, type, qr_image_url, account_number, account_holder, bank_name } = await c.req.json();
    const data = await sql`INSERT INTO payment_methods (name, type, qr_image_url, account_number, account_holder, bank_name) VALUES (${name}, ${type}, ${qr_image_url || null}, ${account_number || null}, ${account_holder || null}, ${bank_name || null}) RETURNING id`;
    return c.json({ message: "Creado", payment_method_id: data[0].id });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.put("/api/superadmin/payment-methods/:id", async (c) => {
  try {
    const { name, type, qr_image_url, account_number, account_holder, bank_name } = await c.req.json();
    await sql`UPDATE payment_methods SET name=${name}, type=${type}, qr_image_url=${qr_image_url || null}, account_number=${account_number || null}, account_holder=${account_holder || null}, bank_name=${bank_name || null}, updated_at=NOW() WHERE id=${c.req.param("id")}`;
    return c.json({ message: "Actualizado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.delete("/api/superadmin/payment-methods/:id", async (c) => {
  try {
    await sql`DELETE FROM payment_methods WHERE id = ${c.req.param("id")}`;
    return c.json({ message: "Eliminado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.put("/api/superadmin/payment-methods/:id/toggle", async (c) => {
  try {
    await sql`UPDATE payment_methods SET is_active=${(await c.req.json()).is_active} WHERE id=${c.req.param("id")}`;
    return c.json({ message: "Actualizado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

// PLATFORM & ACCOUNT
app.get("/api/admin/customization", async (c) => {
  try {
    const superadminCust = await sql`SELECT * FROM platform_customization WHERE setting_type = 'superadmin' AND organization_id IS NULL ORDER BY updated_at DESC LIMIT 1`;
    const phoneRow = await sql`SELECT setting_value FROM platform_settings WHERE setting_key = 'support_phone' LIMIT 1`;

    const cust = superadminCust[0] || {};
    return c.json({ 
      settings: {
        support_phone: phoneRow[0]?.setting_value || '',
        platform_name: cust.platform_name || 'Isites Pro',
        logo_url: cust.logo_url || '',
        favicon_url: cust.favicon_url || '',
        page_title: cust.page_title || 'Isites Pro',
        primary_color: cust.primary_color || '#2563eb',
        secondary_color: cust.secondary_color || '#9333ea'
      } 
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/platform-customization", async (c) => {
  try {
    const custRes = await sql`SELECT * FROM platform_customization WHERE setting_type = 'superadmin' AND organization_id IS NULL ORDER BY updated_at DESC LIMIT 1`;
    const phoneRes = await sql`SELECT setting_value FROM platform_settings WHERE setting_key = 'support_phone' LIMIT 1`;
    const freeRegRes = await sql`SELECT setting_value FROM platform_settings WHERE setting_key = 'enable_free_registration' LIMIT 1`;
    
    const cust = custRes[0] || {};
    return c.json({ settings: {
      support_phone: phoneRes[0]?.setting_value || '',
      platform_name: cust.platform_name || 'Isites Pro',
      logo_url: cust.logo_url || '',
      favicon_url: cust.favicon_url || '',
      page_title: cust.page_title || 'Isites Pro',
      enable_free_registration: freeRegRes[0]?.setting_value === '1',
      primary_color: cust.primary_color || '#2563eb',
      secondary_color: cust.secondary_color || '#9333ea'
    }});
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/superadmin/platform-customization", async (c) => {
  try {
    const custRes = await sql`SELECT * FROM platform_customization WHERE setting_type = 'superadmin' AND organization_id IS NULL ORDER BY updated_at DESC LIMIT 1`;
    const phoneRes = await sql`SELECT setting_value FROM platform_settings WHERE setting_key = 'support_phone' LIMIT 1`;
    const freeRegRes = await sql`SELECT setting_value FROM platform_settings WHERE setting_key = 'enable_free_registration' LIMIT 1`;
    
    const cust = custRes[0] || {};
    return c.json({ settings: {
      support_phone: phoneRes[0]?.setting_value || '',
      platform_name: cust.platform_name || 'Isites Pro',
      logo_url: cust.logo_url || '',
      favicon_url: cust.favicon_url || '',
      page_title: cust.page_title || 'Isites Pro',
      enable_free_registration: freeRegRes[0]?.setting_value === '1',
      primary_color: cust.primary_color || '#2563eb',
      secondary_color: cust.secondary_color || '#9333ea'
    }});
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.put("/api/superadmin/platform-customization", async (c) => {
  try {
    const { support_phone, platform_name, logo_url, favicon_url, page_title, enable_free_registration, primary_color, secondary_color } = await c.req.json();
    
    // Migración automática de columnas para colores dinámicos por si no existen
    try {
      await sql`ALTER TABLE platform_customization ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '#2563eb'`;
      await sql`ALTER TABLE platform_customization ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(20) DEFAULT '#9333ea'`;
    } catch(e) {
      // Si la BD restringe ALTER, omitimos el error y continúa
    }

    const existing = await sql`SELECT id FROM platform_customization WHERE setting_type = 'superadmin' AND organization_id IS NULL LIMIT 1`;
    if (existing.length > 0) {
      await sql`UPDATE platform_customization SET platform_name=${platform_name}, logo_url=${logo_url}, favicon_url=${favicon_url}, page_title=${page_title}, primary_color=${primary_color || '#2563eb'}, secondary_color=${secondary_color || '#9333ea'} WHERE id=${existing[0].id}`;
    } else {
      await sql`INSERT INTO platform_customization (setting_type, platform_name, logo_url, favicon_url, page_title, primary_color, secondary_color) VALUES ('superadmin', ${platform_name}, ${logo_url}, ${favicon_url}, ${page_title}, ${primary_color || '#2563eb'}, ${secondary_color || '#9333ea'})`;
    }
    
    const upsertSetting = async (key: string, val: string) => {
      const e = await sql`SELECT id FROM platform_settings WHERE setting_key = ${key} LIMIT 1`;
      if (e.length > 0) await sql`UPDATE platform_settings SET setting_value = ${val} WHERE id = ${e[0].id}`;
      else await sql`INSERT INTO platform_settings (setting_key, setting_value) VALUES (${key}, ${val})`;
    };
    
    await upsertSetting('support_phone', support_phone || '');
    await upsertSetting('enable_free_registration', enable_free_registration ? '1' : '0');

    if (enable_free_registration) {
      const freePlans = await sql`SELECT id FROM saas_plans WHERE is_free_plan = true LIMIT 1`;
      if (freePlans.length === 0) {
        await sql`INSERT INTO saas_plans (name, duration_months, duration_type, price, subscription_limit, employee_limit, plan_limit, benefits, is_free_plan, is_active) VALUES ('Plan Gratuito', 1, 'monthly', 0, 10, 2, 2, 'Acceso básico', true, true)`;
      } else {
        await sql`UPDATE saas_plans SET is_active = true WHERE is_free_plan = true`;
      }
    }
    
    return c.json({ message: "Actualizado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/my-account/:id", async (c) => {
  try {
    const user = c.get('jwtPayload');
    if (user.role !== 'superadmin' && user.id !== parseInt(c.req.param("id"))) return c.json({ error: "Acceso denegado" }, 403);

    const users = await sql`SELECT u.*, o.name as org_name, p.name as plan_name, p.price as plan_price, p.duration_months FROM users u LEFT JOIN organizations o ON u.organization_id = o.id LEFT JOIN saas_plans p ON u.plan_id = p.id WHERE u.id = ${c.req.param("id")} LIMIT 1`;
    if (users.length === 0) return c.json({ error: "No encontrado" }, 404);
    const u = users[0];
    
    const todayStr = getLocalTodayString();
    let isSubActive = 1; let status = 'pending';
    
    const endDateStr = u.subscription_end_date ? (typeof u.subscription_end_date === 'string' ? u.subscription_end_date.split('T')[0] : u.subscription_end_date.toISOString().split('T')[0]) : null;
    const startDateStr = u.subscription_start_date ? (typeof u.subscription_start_date === 'string' ? u.subscription_start_date.split('T')[0] : u.subscription_start_date.toISOString().split('T')[0]) : null;

    if (!u.is_active || (endDateStr && endDateStr < todayStr)) {
      isSubActive = 0; status = u.is_active ? 'expired' : 'cancelled';
    } else if (startDateStr && startDateStr > todayStr) {
      status = 'pending';
    } else if (endDateStr && endDateStr >= todayStr) {
      const diffDays = (new Date(endDateStr).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24);
      status = diffDays <= 3 ? 'expiring' : 'active';
    }

    delete u.password_hash;

    return c.json({ user: { ...u, organization_name: u.org_name, plan_name: u.plan_name, plan_price: u.plan_price, duration_months: u.duration_months, is_subscription_active: isSubActive, subscription_status: status }});
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.put("/api/my-account/:id", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const userId = c.req.param("id");
    
    if (user.role !== 'superadmin' && user.id !== parseInt(userId)) {
      return c.json({ error: "Acceso denegado" }, 403);
    }

    const { name, email, phone, organization_name, password } = await c.req.json();
    const targetUser = await sql`SELECT organization_id FROM users WHERE id = ${userId} LIMIT 1`;
    if (targetUser.length === 0) return c.json({ error: "No encontrado" }, 404);

    const updateData: any = { name, email, phone: phone || null };
    if (password) updateData.password_hash = await bcrypt.hash(password, 10);
    await sql`UPDATE users SET ${sql(updateData)} WHERE id = ${userId}`;
    
    if (organization_name && targetUser[0].organization_id && user.role !== 'employee') {
      await sql`UPDATE organizations SET name = ${organization_name} WHERE id = ${targetUser[0].organization_id}`;
    }
    
    return c.json({ message: "Actualizado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/available-plans", async (c) => {
  try {
    const plans = await sql`SELECT * FROM saas_plans WHERE is_active = true AND is_free_plan = false ORDER BY price ASC`;
    return c.json({ plans });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

// EXTRA CONTACTS
app.get("/api/admin/contacts", async (c) => {
  try {
    const orgId = c.req.query("organization_id");
    const user = c.get('jwtPayload');
    if (!orgId) return c.json({ error: "organization_id requerido" }, 400);
    if (user.role !== 'superadmin' && user.organization_id !== Number(orgId)) {
      return c.json({ error: "Acceso denegado: No puedes leer datos de otra organización" }, 403);
    }
    const data = await sql`SELECT DISTINCT ON (phone) id, name, phone FROM customers WHERE organization_id = ${orgId} AND phone IS NOT NULL AND phone != ''`;
    const contacts = data.map(c => ({ customer_id: c.id, customer_name: c.name, customer_phone: c.phone }));
    return c.json({ contacts });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.delete("/api/admin/contacts/:id", async (c) => {
  try {
    const user = c.get('jwtPayload');
    const customerId = c.req.param("id");
    
    const targetCustomer = await sql`SELECT organization_id FROM customers WHERE id = ${customerId} LIMIT 1`;
    if (targetCustomer.length === 0) return c.json({ error: "Cliente no encontrado" }, 404);
    if (user.role !== 'superadmin' && targetCustomer[0].organization_id !== user.organization_id) return c.json({ error: "Acceso denegado" }, 403);

    await sql`UPDATE customers SET phone = null WHERE id = ${customerId}`;
    return c.json({ message: "Eliminado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.get("/api/superadmin/contacts", async (c) => {
  try {
    const data = await sql`SELECT DISTINCT ON (u.phone) u.id, u.name, u.phone, o.name as org_name FROM users u LEFT JOIN organizations o ON u.organization_id = o.id WHERE u.role = 'admin' AND u.phone IS NOT NULL AND u.phone != ''`;
    const contacts = data.map(u => ({ user_id: u.id, admin_name: u.name, admin_phone: u.phone, organization_name: u.org_name }));
    return c.json({ contacts });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.delete("/api/superadmin/contacts/:id", async (c) => {
  try {
    await sql`UPDATE users SET phone = null WHERE id = ${c.req.param("id")}`;
    return c.json({ message: "Eliminado" });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

// Serve static assets for production
app.use('/assets/*', serveStatic({ root: './dist' }));
app.use('/favicon.ico', serveStatic({ path: './dist/favicon.ico' }));
app.use('/vite.svg', serveStatic({ path: './dist/vite.svg' }));

// Catch-all route to serve the React app
app.get('*', async (c) => {
  if (c.req.path.startsWith('/api')) {
    return c.json({ error: 'Endpoint no encontrado' }, 404);
  }
  
  try {
    const html = await fs.readFile('./dist/index.html', 'utf-8');
    return c.html(html);
  } catch (e) {
    return c.text('El frontend no ha sido construido aún. Ejecuta "npm run build".', 404);
  }
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
serve({ 
  fetch: app.fetch, 
  port: port,
  hostname: '0.0.0.0'
}, (info) => {
  console.log(`🚀 Servidor backend corriendo en http://${info.address}:${info.port}`);
});