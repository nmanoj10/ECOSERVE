export type Role = 'DONOR' | 'NGO' | 'VOLUNTEER' | 'ADMIN'

export interface DonorProfile {
  organizationName: string
  organizationType: string
  address: string
  city: string
  state: string
  latitude?: number | null
  longitude?: number | null
  description?: string | null
  logoUrl?: string | null
}

export interface NgoProfile {
  ngoName: string
  registrationNumber: string
  address: string
  city: string
  state: string
  latitude?: number | null
  longitude?: number | null
  capacity?: number | null
  description?: string | null
  verificationStatus: string
}

export interface VolunteerProfile {
  vehicleType?: string | null
  vehicleNumber?: string | null
  availability: string
  /** Live location — used to match rescue alerts and as the delivery drop-off. */
  currentLatitude?: number | null
  currentLongitude?: number | null
  rating: number
  totalDeliveries: number
}

export interface UserProfile {
  id: string
  fullName: string
  email: string
  phone?: string | null
  role: Role
  status: string
  profileImage?: string | null
  /** Privacy opt-out: when false, no location-based rescue alerts are sent. */
  locationAlertsEnabled?: boolean
  donor?: DonorProfile | null
  ngo?: NgoProfile | null
  volunteer?: VolunteerProfile | null
}
