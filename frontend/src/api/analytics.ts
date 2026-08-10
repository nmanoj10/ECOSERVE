import { api } from './client'

/** One month of a donor's time series (Phase 30, Step 77). */
export interface DonorMonthPoint {
  month: string // "YYYY-MM"
  donations: number
  /** Food saved that month, in kg (delivered donations only). */
  kg: number
}

export interface DonorCategoryPoint {
  category: string
  /** Total listings in this category, any status (cf. `kg` — delivered only). */
  listed: number
  /** Food saved in this category, in kg (DELIVERED donations only). */
  kg: number
}

export interface DonorAnalytics {
  summary: {
    totalDonations: number
    foodSavedKg: number
    peopleServed: number
    co2Kg: number
  }
  byMonth: DonorMonthPoint[]
  byCategory: DonorCategoryPoint[]
}

/** One month of an NGO's time series (Phase 30, Step 78). */
export interface NgoMonthPoint {
  month: string // "YYYY-MM"
  receivedKg: number
  distributedKg: number
}

export interface NgoAnalytics {
  summary: {
    foodReceivedKg: number
    foodDistributedKg: number
    peopleServed: number
    /** Percentage 0–100 of accepted donations that were actually delivered. */
    deliverySuccessRate: number
  }
  byMonth: NgoMonthPoint[]
}

/** One month of a volunteer's delivery series (Phase 30, Step 79). */
export interface VolunteerMonthPoint {
  month: string // "YYYY-MM"
  deliveries: number
  distanceKm: number
}

export interface VolunteerAnalytics {
  summary: {
    /** Completed (DELIVERED) runs, all time. */
    deliveries: number
    distanceKm: number
    mealsDelivered: number
    /** 0–5, from delivery reviews. */
    rating: number
    /** Percentage 0–100 of attempted runs (not cancelled) that were delivered. */
    completionRate: number
  }
  byMonth: VolunteerMonthPoint[]
}

/** One month of platform growth (Phase 30, Step 80). */
export interface AdminMonthPoint {
  month: string // "YYYY-MM"
  foodSavedKg: number
}

/** A ~0.1° grid cell of delivered-food pickup points for the admin heatmap. */
export interface HeatmapCell {
  lat: number
  lng: number
  count: number
  kg: number
}

export interface TopNgo {
  name: string
  city: string | null
  kg: number
  meals: number
}

export interface AdminAnalytics {
  summary: {
    totalUsers: number
    totalDonations: number
    totalNgos: number
    totalVolunteers: number
    foodSavedKg: number
    co2Kg: number
  }
  byMonth: AdminMonthPoint[]
  heatmap: HeatmapCell[]
  topNgos: TopNgo[]
}

/** Step 77 — the donor's impact: donations, food saved, people, CO₂. */
export async function fetchDonorAnalytics(): Promise<DonorAnalytics> {
  const { data } = await api.get<DonorAnalytics>('/v1/analytics/donor')
  return data
}

/** Step 78 — the NGO's impact: food received/distributed, delivery success, growth. */
export async function fetchNgoAnalytics(): Promise<NgoAnalytics> {
  const { data } = await api.get<NgoAnalytics>('/v1/analytics/ngo')
  return data
}

/** Step 79 — the volunteer's impact: deliveries, distance, meals, rating, completion. */
export async function fetchVolunteerAnalytics(): Promise<VolunteerAnalytics> {
  const { data } = await api.get<VolunteerAnalytics>('/v1/analytics/volunteer')
  return data
}

/** Step 80 — platform overview for admins: growth, heatmap, top NGOs. */
export async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  const { data } = await api.get<AdminAnalytics>('/v1/analytics/admin')
  return data
}
