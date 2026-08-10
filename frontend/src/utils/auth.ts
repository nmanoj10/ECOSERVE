import type { Role } from '@/types/user'

/** Maps each role to its dashboard route. */
export const roleDashboardPath: Record<Role, string> = {
  DONOR: '/donor',
  NGO: '/ngo',
  VOLUNTEER: '/volunteer',
  ADMIN: '/admin',
}
