import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Lightbulb, Sparkles, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { api } from '@/api/client'
import DashboardShell from '@/components/layout/DashboardShell'
import { ImageUpload, type DonationImage } from '@/components/donation/ImageUpload'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { donorNav } from '@/pages/donor/nav'

const categories = ['Grains', 'Fresh Produce', 'Cooked Meals', 'Bakery', 'Dairy', 'Packaged & Sealed', 'Other'] as const
const units = ['kg', 'g', 'litres', 'pieces', 'meals'] as const

const donationSchema = z
  .object({
    foodName: z.string().trim().min(1, 'Required').max(150),
    category: z.string().min(1, 'Required'),
    quantity: z.string().refine((value) => value.trim() !== '' && Number(value) > 0, 'Enter a quantity greater than 0'),
    unit: z.string().min(1, 'Required'),
    preparedAt: z.string().optional(),
    expiryTime: z.string().min(1, 'Pickup expiry is required'),
    pickupTime: z.string().min(1, 'Pickup time is required'),
    pickupAddress: z.string().trim().min(1, 'Required').max(250),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((data) => data.expiryTime > data.pickupTime, {
    message: 'Pickup must happen before the food expires',
    path: ['pickupTime'],
  })
  .refine((data) => !data.preparedAt || data.expiryTime > data.preparedAt, {
    message: 'Expiry must be after the prepared time',
    path: ['expiryTime'],
  })

type DonationFormValues = z.infer<typeof donationSchema>

const mealsPerKg: Record<string, number> = {
  'Cooked Meals': 4,
  Bakery: 5,
  Grains: 6,
  'Fresh Produce': 3,
  Dairy: 4,
  'Packaged & Sealed': 4,
  Other: 3,
}

function estimateMeals(category: string, quantity: string, unit: string) {
  const qty = Number(quantity)
  if (!qty || qty <= 0) return null
  const kg =
    unit === 'kg' ? qty : unit === 'g' ? qty / 1000 : unit === 'litres' ? qty : unit === 'pieces' ? qty * 0.2 : qty
  return Math.max(1, Math.round(kg * (mealsPerKg[category] ?? 3)))
}

function nowLocalInput() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const defaultValues: DonationFormValues = {
  foodName: '',
  category: categories[0],
  quantity: '',
  unit: 'kg',
  preparedAt: '',
  expiryTime: '',
  pickupTime: '',
  pickupAddress: '',
  notes: '',
}

export default function NewDonationPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [images, setImages] = useState<DonationImage[]>([])
  const uploadingCount = images.filter((img) => img.uploading).length

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<DonationFormValues>({
    resolver: zodResolver(donationSchema),
    defaultValues,
  })

  const category = watch('category')
  const quantity = watch('quantity')
  const unit = watch('unit')
  const estimatedMeals = estimateMeals(category, quantity, unit)

  const onSubmit = async (values: DonationFormValues) => {
    if (uploadingCount > 0) return
    setSubmitting(true)

    // Step 45: the photo upload already happened on the client (ImageKit); we
    // send the returned URL + file metadata to the backend for persistence.
    const payload = {
      foodName: values.foodName,
      category: values.category,
      quantity: Number(values.quantity),
      unit: values.unit,
      preparedAt: values.preparedAt ? new Date(values.preparedAt).toISOString() : undefined,
      expiryTime: new Date(values.expiryTime).toISOString(),
      pickupTime: new Date(values.pickupTime).toISOString(),
      pickupAddress: values.pickupAddress,
      description: values.notes || undefined,
      images: images
        .filter((img) => img.url)
        .map((img) => ({
          url: img.url as string,
          fileId: img.fileId,
          fileName: img.fileName ?? 'donation.jpg',
          fileSize: img.fileSize,
          mimeType: img.mimeType,
        })),
    }

    try {
      await api.post('/v1/donations', payload)
      toast({
        variant: 'success',
        title: 'Donation listed',
        description: `${values.foodName} is live — NGOs can now claim it.`,
      })
      navigate('/donor')
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
        'Could not list your donation — please try again.'
      toast({ variant: 'error', title: 'Could not list donation', description: message })
      setSubmitting(false)
    }
  }

  return (
    <DashboardShell roleLabel="Donor" nav={donorNav} title="Add donation" subtitle="List surplus food for rescue">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Left: details */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Donation details</CardTitle>
              <CardDescription>
                Accurate times and photos help NGOs commit faster — AI matches better listings.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label="Food name *"
                  placeholder="e.g. Fresh vegetable biryani, 40 kg of bread"
                  {...register('foodName')}
                  error={errors.foodName?.message}
                />
              </div>

              <Select label="Category *" error={errors.category?.message} {...register('category')}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Quantity *"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  {...register('quantity')}
                  error={errors.quantity?.message}
                />
                <Select label="Unit *" error={errors.unit?.message} {...register('unit')}>
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Input
                  label="Cooked / prepared time"
                  type="datetime-local"
                  min={nowLocalInput()}
                  {...register('preparedAt')}
                />
                <p className="mt-1 text-xs text-neutral-500">Optional — when the food was prepared.</p>
              </div>

              <Input
                label="Expiry *"
                type="datetime-local"
                min={nowLocalInput()}
                {...register('expiryTime')}
                error={errors.expiryTime?.message}
              />

              <Input
                label="Pickup time *"
                type="datetime-local"
                min={nowLocalInput()}
                {...register('pickupTime')}
                error={errors.pickupTime?.message}
              />

              <div className="sm:col-span-2">
                <Input
                  label="Pickup address *"
                  placeholder="Street address where volunteers collect"
                  {...register('pickupAddress')}
                  error={errors.pickupAddress?.message}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Notes
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  placeholder="Storage instructions, packaging, allergens, best window…"
                  className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  {...register('notes')}
                />
                {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-5">
              <Button type="submit" disabled={submitting || uploadingCount > 0}>
                {submitting ? 'Listing…' : uploadingCount > 0 ? `Uploading ${uploadingCount} photo${uploadingCount > 1 ? 's' : ''}…` : 'List donation'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate('/donor')}>
                <ArrowLeft className="size-4" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right: images + impact */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Food image</CardTitle>
              <CardDescription>Up to 3 photos — real photos get matched 2× faster.</CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUpload images={images} onChange={setImages} />
              {images.length > 0 && images.every((img) => !img.url) && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
                  Photos are preview-only until ImageKit is configured — they won&apos;t be attached to the listing yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-brand-600" />
                <CardTitle>Estimated impact</CardTitle>
              </div>
              <CardDescription>AI preview of what this listing could save</CardDescription>
            </CardHeader>
            <CardContent>
              {estimatedMeals ? (
                <div className="flex items-end gap-6">
                  <div>
                    <p className="text-4xl font-semibold tracking-tight text-neutral-900">~{estimatedMeals}</p>
                    <p className="mt-1 text-sm text-neutral-500">meals served</p>
                  </div>
                  <div className="pb-1">
                    <p className="text-2xl font-semibold tracking-tight text-neutral-900">~{(estimatedMeals * 0.25).toFixed(1)} kg</p>
                    <p className="text-sm text-neutral-500">CO₂ avoided</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">Enter a quantity to see the estimated reach.</p>
              )}
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-50 px-3.5 py-3 text-xs leading-relaxed text-brand-800">
                <Lightbulb className="mt-0.5 size-4 shrink-0" />
                Listings with a photo, quantity, and expiry are accepted by NGOs twice as often.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Good to know</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5 text-sm text-neutral-600">
                <li className="flex items-start gap-2.5">
                  <UtensilsCrossed className="mt-0.5 size-4 shrink-0 text-brand-600" />
                  Pickup time should be before expiry so food travels fresh.
                </li>
                <li className="flex items-start gap-2.5">
                  <UtensilsCrossed className="mt-0.5 size-4 shrink-0 text-brand-600" />
                  You&apos;ll be notified the moment an NGO requests your donation.
                </li>
                <li className="flex items-start gap-2.5">
                  <UtensilsCrossed className="mt-0.5 size-4 shrink-0 text-brand-600" />
                  This form is a demo — posting to the live API arrives in a later phase.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </form>
    </DashboardShell>
  )
}
