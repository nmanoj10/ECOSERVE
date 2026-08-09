import { z } from 'zod'

const donorProfileSchema = z.object({
  organizationName: z.string().trim().min(1, 'Required').max(150),
  organizationType: z.string().trim().min(1, 'Required').max(100),
  address: z.string().trim().min(1, 'Required').max(250),
  city: z.string().trim().min(1, 'Required').max(100),
  state: z.string().trim().min(1, 'Required').max(100),
})

const ngoProfileSchema = z.object({
  ngoName: z.string().trim().min(1, 'Required').max(150),
  registrationNumber: z.string().trim().min(1, 'Required').max(100),
  address: z.string().trim().min(1, 'Required').max(250),
  city: z.string().trim().min(1, 'Required').max(100),
  state: z.string().trim().min(1, 'Required').max(100),
  description: z.string().trim().max(1000).optional(),
})

const volunteerProfileSchema = z.object({
  vehicleType: z.string().trim().max(50).optional(),
  vehicleNumber: z.string().trim().max(20).optional(),
})

export const registerFormSchema = z
  .object({
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    fullName: z.string().trim().min(1, 'Required').max(100),
    phone: z.string().trim().max(20).optional(),
    role: z.enum(['DONOR', 'NGO', 'VOLUNTEER']),
    donor: donorProfileSchema.optional(),
    ngo: ngoProfileSchema.optional(),
    volunteer: volunteerProfileSchema.optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegisterFormValues = z.infer<typeof registerFormSchema>
