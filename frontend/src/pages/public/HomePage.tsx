import AiSection from '@/components/home/AiSection'
import CtaSection from '@/components/home/CtaSection'
import Features from '@/components/home/Features'
import Footer from '@/components/home/Footer'
import Hero from '@/components/home/Hero'
import HowItWorks from '@/components/home/HowItWorks'
import ImpactStats from '@/components/home/ImpactStats'
import LiveTracking from '@/components/home/LiveTracking'
import Navbar from '@/components/home/Navbar'
import Problem from '@/components/home/Problem'
import Solution from '@/components/home/Solution'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <Features />
        <AiSection />
        <LiveTracking />
        <ImpactStats />
        <CtaSection />
      </main>
      <Footer />
    </div>
  )
}
