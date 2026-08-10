import { lazy, Suspense, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import HomePage from '@/pages/public/HomePage'
import NotFoundPage from '@/pages/public/NotFoundPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const DonorDashboardPage = lazy(() => import('@/pages/donor/DashboardPage'))
const NewDonationPage = lazy(() => import('@/pages/donor/NewDonationPage'))
const NgoDashboardPage = lazy(() => import('@/pages/ngo/DashboardPage'))
const VolunteerDashboardPage = lazy(() => import('@/pages/volunteer/DashboardPage'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/DashboardPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/UsersPage'))
const AdminNgoVerificationPage = lazy(() => import('@/pages/admin/NgoVerificationPage'))
const AdminDonationsPage = lazy(() => import('@/pages/admin/DonationsPage'))
const AdminDeliveriesPage = lazy(() => import('@/pages/admin/DeliveriesPage'))
const AdminReportsPage = lazy(() => import('@/pages/admin/ReportsPage'))
const AboutPage = lazy(() => import('@/pages/public/AboutPage'))
const HowItWorksPage = lazy(() => import('@/pages/public/HowItWorksPage'))
const FeaturesPage = lazy(() => import('@/pages/public/FeaturesPage'))
const ImpactPage = lazy(() => import('@/pages/public/ImpactPage'))
const ContactPage = lazy(() => import('@/pages/public/ContactPage'))
const DesignSystemPage = lazy(() => import('@/pages/design-system/DemoPage'))

/** Scrolls to the top on route change, without clobbering same-page anchor (#) navigation. */
function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

/**
 * Phase 34, Step 88 — route-level error boundary. Navigating to a different
 * path changes `resetKey`, which clears any caught error and re-renders the
 * routes in place — a crashed route recovers the moment the user moves
 * elsewhere (the top-level boundary in main.tsx stays as the last line of
 * defense).
 */
function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <ErrorBoundary resetKey={location.pathname} label="This page">
      {children}
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white text-sm text-neutral-500">
          Loading…
        </div>
      }
    >
      <ScrollToTop />
      <RouteErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/impact" element={<ImpactPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/design-system" element={<DesignSystemPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/donor"
          element={
            <ProtectedRoute>
              <DonorDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/donor/new"
          element={
            <ProtectedRoute>
              <NewDonationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ngo"
          element={
            <ProtectedRoute>
              <NgoDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/volunteer"
          element={
            <ProtectedRoute>
              <VolunteerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/ngos"
          element={
            <ProtectedRoute>
              <AdminNgoVerificationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/donations"
          element={
            <ProtectedRoute>
              <AdminDonationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/deliveries"
          element={
            <ProtectedRoute>
              <AdminDeliveriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute>
              <AdminReportsPage />
            </ProtectedRoute>
          }
        />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </RouteErrorBoundary>
    </Suspense>
  )
}
