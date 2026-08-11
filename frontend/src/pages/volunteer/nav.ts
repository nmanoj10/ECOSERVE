import { LayoutDashboard, Settings } from 'lucide-react'

import type { DashboardNavItem } from '@/components/layout/DashboardShell'

export const volunteerNav: DashboardNavItem[] = [
  { label: 'Overview', to: '/volunteer', icon: LayoutDashboard, end: true },
  { label: 'Profile', to: '/volunteer/profile', icon: Settings },
]
