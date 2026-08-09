import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register plugins once for the whole app. `useGSAP` scopes animations to a
// component and cleans them up automatically on unmount.
gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger, useGSAP }
