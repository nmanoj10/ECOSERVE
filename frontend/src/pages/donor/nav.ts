import { LayoutDashboard, Plus } from 'lucide-react'

import type { DashboardNavItem } from '@/components/layout/DashboardShell'

export const donorNav: DashboardNavItem[] = [
  { label: 'Overview', to: '/donor', icon: LayoutDashboard, end: true },
  { label: 'Add donation', to: '/donor/new', icon: Plus },
]
