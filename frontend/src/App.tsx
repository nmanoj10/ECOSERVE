import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import HomePage from '@/pages/public/HomePage'
import NotFoundPage from '@/pages/public/NotFoundPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const DonorDashboardPage = lazy(() => import('@/pages/donor/DashboardPage'))
const NewDonationPage = lazy(() => import('@/pages/donor/NewDonationPage'))
const NgoDashboardPage = lazy(() => import('@/pages/ngo/DashboardPage'))
const VolunteerDashboardPage = lazy(() => import('@/pages/volunteer/DashboardPage'))
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
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
