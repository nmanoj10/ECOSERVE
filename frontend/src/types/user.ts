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
}

export interface NgoProfile {
  ngoName: string
  registrationNumber: string
  address: string
  city: string
  state: string
  capacity?: number | null
  description?: string | null
  verificationStatus: string
}

export interface VolunteerProfile {
  vehicleType?: string | null
  vehicleNumber?: string | null
  availability: string
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
  donor?: DonorProfile | null
  ngo?: NgoProfile | null
  volunteer?: VolunteerProfile | null
}
