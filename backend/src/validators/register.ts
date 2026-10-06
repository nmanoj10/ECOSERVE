import { z } from 'zod'

const donorProfileSchema = z.object({
  organizationName: z.string().trim().min(1).max(150),
  organizationType: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(250),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  description: z.string().max(1000).optional(),
})

const ngoProfileSchema = z.object({
  ngoName: z.string().trim().min(1).max(150),
  registrationNumber: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(250),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  capacity: z.number().int().positive().optional(),
  description: z.string().max(1000).optional(),
})

const volunteerProfileSchema = z.object({
  vehicleType: z.string().trim().max(50).optional(),
  vehicleNumber: z.string().trim().max(20).optional(),
  availability: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']).optional(),
  currentLatitude: z.number().min(-90).max(90).optional(),
  currentLongitude: z.number().min(-180).max(180).optional(),
})

export const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  role: z.enum(['DONOR', 'NGO', 'VOLUNTEER']),
  phone: z.string().trim().max(20).optional(),
  donor: donorProfileSchema.optional(),
  ngo: ngoProfileSchema.optional(),
  volunteer: volunteerProfileSchema.optional(),
})

export type RegisterBody = z.infer<typeof registerSchema>

/**
 * The registration form saved before email confirmation. `payload` mirrors
 * the body accepted by `POST /auth/register`, so the confirmation-link
 * landing can complete the exact profile the user filled in.
 */
export const pendingRegistrationSchema = z.object({
  email: z.string().email('Enter a valid email'),
  payload: registerSchema,
})

export type PendingRegistrationBody = z.infer<typeof pendingRegistrationSchema>

/**
 * Instant demo signup — the backend creates the auth user pre-confirmed via
 * the Admin API (no confirmation email). Password rules mirror the register
 * form, so the frontend schema and this stay in sync.
 */
export const signupSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
})

export type SignupBody = z.infer<typeof signupSchema>

/**
 * Login schema — validates email/password credentials.
 */
export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginBody = z.infer<typeof loginSchema>
