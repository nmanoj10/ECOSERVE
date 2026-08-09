import type { Role } from '@/types/user'

/**
 * Maps each role to its dashboard route. Admin lands on the home page until
 * the admin console ships in a later phase.
 */
export const roleDashboardPath: Record<Role, string> = {
  DONOR: '/donor',
  NGO: '/ngo',
  VOLUNTEER: '/volunteer',
  ADMIN: '/',
}
