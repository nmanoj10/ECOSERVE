import { BadgeCheck, BarChart3, HandHeart, LayoutDashboard, Truck, Users } from 'lucide-react'

import type { DashboardNavItem } from '@/components/layout/DashboardShell'

export const adminNav: DashboardNavItem[] = [
  { label: 'Overview', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'NGO verification', to: '/admin/ngos', icon: BadgeCheck },
  { label: 'Donations', to: '/admin/donations', icon: HandHeart },
  { label: 'Deliveries', to: '/admin/deliveries', icon: Truck },
  { label: 'Reports', to: '/admin/reports', icon: BarChart3 },
]
