import { LayoutDashboard, Settings } from 'lucide-react'

import type { DashboardNavItem } from '@/components/layout/DashboardShell'

export const ngoNav: DashboardNavItem[] = [
  { label: 'Overview', to: '/ngo', icon: LayoutDashboard, end: true },
  { label: 'Profile', to: '/ngo/profile', icon: Settings },
]
