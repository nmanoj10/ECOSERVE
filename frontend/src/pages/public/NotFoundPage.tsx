import { Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Leaf className="size-6" />
      </span>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-neutral-600">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        to="/"
        className="mt-8 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        Back home
      </Link>
    </div>
  )
}
