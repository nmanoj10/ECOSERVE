import type { ReactNode } from 'react'

import Footer from '@/components/home/Footer'
import Navbar from '@/components/home/Navbar'

/** Shared shell for the public marketing pages: fixed navbar + footer. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
