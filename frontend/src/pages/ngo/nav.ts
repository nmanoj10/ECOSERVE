import { LayoutDashboard } from 'lucide-react'

import type { DashboardNavItem } from '@/components/layout/DashboardShell'

export const ngoNav: DashboardNavItem[] = [
  { label: 'Overview', to: '/ngo', icon: LayoutDashboard, end: true },
]
