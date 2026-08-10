import { LayoutDashboard } from 'lucide-react'

import type { DashboardNavItem } from '@/components/layout/DashboardShell'

export const volunteerNav: DashboardNavItem[] = [
  { label: 'Overview', to: '/volunteer', icon: LayoutDashboard, end: true },
]
