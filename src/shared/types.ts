import z from "zod";

// Organization types
export const OrganizationSchema = z.object({
  id: z.number(),
  name: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type OrganizationType = z.infer<typeof OrganizationSchema>;

// User types
export const UserSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  role: z.enum(['superadmin', 'admin', 'employee']),
  organization_id: z.number().nullable(),
  phone: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type UserType = z.infer<typeof UserSchema>;

// Customer types
export const CustomerSchema = z.object({
  id: z.number(),
  organization_id: z.number(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CustomerType = z.infer<typeof CustomerSchema>;

// Subscription Plan types
export const SubscriptionPlanSchema = z.object({
  id: z.number(),
  organization_id: z.number(),
  name: z.string(),
  duration_type: z.enum(['monthly', 'annual']),
  price: z.number(),
  benefits: z.string().nullable(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SubscriptionPlanType = z.infer<typeof SubscriptionPlanSchema>;

// Subscription types
export const SubscriptionSchema = z.object({
  id: z.number(),
  organization_id: z.number(),
  customer_id: z.number(),
  plan_id: z.number(),
  assigned_employee_id: z.number().nullable(),
  status: z.enum(['pending', 'active', 'expired', 'cancelled']),
  start_date: z.string(),
  end_date: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SubscriptionType = z.infer<typeof SubscriptionSchema>;

// Payment types
export const PaymentSchema = z.object({
  id: z.number(),
  organization_id: z.number(),
  subscription_id: z.number().nullable(),
  amount: z.number(),
  payment_method: z.string(),
  status: z.enum(['pending', 'confirmed', 'failed']),
  transaction_reference: z.string().nullable(),
  payment_date: z.string().nullable(),
  payment_type: z.enum(['new_subscription', 'renewal']),
  is_platform_income: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type PaymentType = z.infer<typeof PaymentSchema>;

// Extended types for API responses
export type SubscriptionWithDetails = SubscriptionType & {
  customer_name: string;
  customer_phone: string | null;
  plan_name: string;
  plan_price: number;
  employee_name: string | null;
};

// Form validation schemas
export const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const CustomerFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  notes: z.string().optional(),
});

export const PlanFormSchema = z.object({
  name: z.string().min(1, 'El nombre del plan es requerido'),
  duration_type: z.enum(['monthly', 'annual']),
  price: z.number().positive('El precio debe ser mayor a 0'),
  benefits: z.string().optional(),
  notes: z.string().optional(),
});

export const SubscriptionFormSchema = z.object({
  customer_id: z.number().positive('Selecciona un cliente'),
  plan_id: z.number().positive('Selecciona un plan'),
  start_date: z.string().min(1, 'La fecha de inicio es requerida'),
  notes: z.string().optional(),
});

// Zod Schemas for Backend Validation
export const UserCreateSchema = z.object({
  organization_id: z.coerce.number(),
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role: z.enum(['superadmin', 'admin', 'employee']).optional(),
});

export const UserUpdateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional().or(z.literal('')),
});

export const BackendSubscriptionCreateSchema = z.object({
  organization_id: z.coerce.number(),
  customer_id: z.coerce.number(),
  plan_id: z.coerce.number(),
  start_date: z.string().min(1, 'La fecha de inicio es requerida'),
  end_date: z.string().optional().nullable(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
  discount: z.coerce.number().optional().default(0),
});

export const SuperAdminCreateSubscriptionSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional().nullable(),
  plan_id: z.coerce.number(),
  organization_name: z.string().min(1, 'La organización es requerida'),
  password: z.string().min(1, 'La contraseña es requerida'),
  start_date: z.string().optional(),
  discount: z.coerce.number().optional().default(0),
});

export type LoginFormType = z.infer<typeof LoginSchema>;
export type CustomerFormType = z.infer<typeof CustomerFormSchema>;
export type PlanFormType = z.infer<typeof PlanFormSchema>;
export type SubscriptionFormType = z.infer<typeof SubscriptionFormSchema>;