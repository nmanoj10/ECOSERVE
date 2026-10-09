import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import PublicLayout from '@/components/layout/PublicLayout'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/Dropdown'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
      <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-neutral-500">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export default function DemoPage() {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [tab, setTab] = useState('overview')

  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
        <Link to="/" className="text-sm text-neutral-500 transition hover:text-brand-700">
          ← Back to home
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">Design system</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          Every reusable primitive in <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm">src/components/ui</code> —
          built on Tailwind v4 and the Ecoserve brand palette.
        </p>

        <div className="mt-10 space-y-4">
          <Section title="Buttons">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="dark">Dark</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Search">
                <Search className="size-4" />
              </Button>
              <Button disabled>Disabled</Button>
              <Button to="/about">
                Link button
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </Section>

          <Section title="Inputs & select">
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Label" placeholder="Type something…" />
              <Input label="With hint" placeholder="you@example.com" hint="We'll never share your email." />
              <Input label="With error" placeholder="123" defaultValue="42" error="That doesn't look like a phone number." />
              <Input label="Search" placeholder="Search donations…" />
              <Select label="Pick a role" defaultValue="donor">
                <option value="donor">Donor</option>
                <option value="ngo">NGO</option>
                <option value="volunteer">Volunteer</option>
              </Select>
              <Input label="Disabled" placeholder="Locked" disabled />
            </div>
          </Section>

          <Section title="Badges & avatars">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="neutral">Neutral</Badge>
              <Badge variant="brand">Brand</Badge>
              <Badge variant="success" dot>
                Success
              </Badge>
              <Badge variant="warning" dot>
                Warning
              </Badge>
              <Badge variant="danger">Danger</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
            <div className="mt-6 flex items-center gap-4">
              <Avatar name="Priya Sharma" size="sm" />
              <Avatar name="Aarav Mehta" size="md" />
              <Avatar name="Ananya Rao" size="lg" />
              <Avatar name="Rohan Iyer" size="md" src="" />
            </div>
          </Section>

          <Section title="Card">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Donation #4821</CardTitle>
                    <CardDescription>Green Bites Kitchen → Hope Shelter</CardDescription>
                  </div>
                  <Badge variant="success" dot>
                    In transit
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-600">
                    24 meals · 9.6 kg · ETA 12 min. Everything you need to know at a glance.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" size="sm">
                    View details
                  </Button>
                  <Button size="sm">Track</Button>
                </CardFooter>
              </Card>

              <Card className="bg-neutral-950 text-white">
                <CardHeader>
                  <CardTitle className="text-white">Volunteer of the month</CardTitle>
                  <CardDescription className="text-neutral-400">Recognized by the community</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar name="Kabir D'Souza" size="lg" />
                    <div>
                      <p className="font-semibold">Kabir D'Souza</p>
                      <p className="text-sm text-neutral-400">124 deliveries · 5.0 rating</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section title="Tabs">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="donations">Donations</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4 rounded-xl border border-neutral-200 p-5 text-sm text-neutral-600">
                The overview tab shows your impact summary.
              </TabsContent>
              <TabsContent value="donations" className="mt-4 rounded-xl border border-neutral-200 p-5 text-sm text-neutral-600">
                The donations tab lists every surplus listing.
              </TabsContent>
              <TabsContent value="settings" className="mt-4 rounded-xl border border-neutral-200 p-5 text-sm text-neutral-600">
                The settings tab manages notifications and privacy.
              </TabsContent>
            </Tabs>
          </Section>

          <Section title="Dropdown">
            <Dropdown>
              <DropdownTrigger>
                <Button variant="secondary">
                  Actions
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownTrigger>
              <DropdownContent>
                <DropdownItem onClick={() => toast({ variant: 'info', title: 'Editing', description: 'Edit pressed (demo).' })}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownItem>
                <DropdownItem onClick={() => toast({ variant: 'success', title: 'Copied!', description: 'Link copied to clipboard (demo).' })}>
                  <Bell className="size-4" />
                  Notify
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem danger onClick={() => setDialogOpen(true)}>
                  <Trash2 className="size-4" />
                  Delete
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          </Section>

          <Section title="Modal & dialog">
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="size-4" />
                Open modal
              </Button>
              <Button variant="danger" onClick={() => setDialogOpen(true)}>
                <Trash2 className="size-4" />
                Open dialog
              </Button>
            </div>
          </Section>

          <Section title="Toasts">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => toast({ variant: 'success', title: 'Delivery confirmed', description: '24 meals marked as received by Hope Shelter.' })}>
                <CheckCircle2 className="size-4 text-emerald-600" />
                Success
              </Button>
              <Button variant="secondary" onClick={() => toast({ variant: 'error', title: 'Pickup failed', description: 'The volunteer could not reach the donor in time.' })}>
                <AlertTriangle className="size-4 text-red-600" />
                Error
              </Button>
              <Button variant="secondary" onClick={() => toast({ variant: 'warning', title: 'Freshness alert', description: 'This donation expires in under 2 hours.' })}>
                <Info className="size-4 text-amber-600" />
                Warning
              </Button>
              <Button variant="secondary" onClick={() => toast({ variant: 'info', title: 'New feature', description: 'Live tracking just went live for your city.' })}>
                <Info className="size-4 text-neutral-600" />
                Info
              </Button>
            </div>
          </Section>

          <Section title="Table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donation</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Meals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-neutral-900">#4821</TableCell>
                  <TableCell>Green Bites → Hope Shelter</TableCell>
                  <TableCell>
                    <Badge variant="success" dot>
                      Delivered
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">24</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-neutral-900">#4820</TableCell>
                  <TableCell>Daily Mart → Annapurna Trust</TableCell>
                  <TableCell>
                    <Badge variant="brand" dot>
                      In transit
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">18</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-neutral-900">#4819</TableCell>
                  <TableCell>Sunrise Bakery → City Mission</TableCell>
                  <TableCell>
                    <Badge variant="warning" dot>
                      Scheduled
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">40</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Section>

          <Section title="Skeleton, empty & error states">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-5/6" />
                <div className="mt-4 flex gap-2">
                  <Skeleton className="size-10 rounded-full" />
                  <Skeleton className="size-10 rounded-full" />
                </div>
              </div>
              <EmptyState
                title="No donations yet"
                description="When a donation is created it will show up here. Your first listing takes under two minutes."
                action={<Button size="sm">Create a donation</Button>}
              />
              <ErrorState
                title="Couldn't load deliveries"
                description="The network request timed out. Retry to fetch the latest list."
                error={undefined}
                onRetry={async () => {
                  await new Promise((resolve) => setTimeout(resolve, 800))
                }}
              />
            </div>
          </Section>
        </div>

        <p className="mt-10 text-center text-sm text-neutral-500">
          Built with the Ecoserve design system ·{' '}
          <a href="https://tailwindcss.com" className="text-brand-700 hover:underline">
            Tailwind CSS v4
          </a>
        </p>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create a donation"
        description="Let's get your surplus listed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setModalOpen(false)}>Create donation</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="What are you donating?" placeholder="e.g. 40 kg of bread" />
          <Select label="Pickup window" defaultValue="today">
            <option value="today">Today, before 6pm</option>
            <option value="tomorrow">Tomorrow morning</option>
            <option value="recurring">Recurring (weekly)</option>
          </Select>
        </div>
      </Modal>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Delete this donation listing?"
        description="This action can't be undone. The matched NGO will be notified that the listing was withdrawn."
        confirmLabel="Delete listing"
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 600))
          toast({ variant: 'success', title: 'Listing deleted', description: 'The donation was withdrawn.' })
        }}
      />
    </PublicLayout>
  )
}
