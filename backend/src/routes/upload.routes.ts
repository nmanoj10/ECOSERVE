import { Router } from 'express'

import { imagekitAuth } from '../controllers/uploadController.js'
import { authRequired } from '../middleware/auth.js'

export const uploadRoutes = Router()

// ImageKit client-upload signing (Step 44). Protected so only signed-in users
// can mint upload signatures. Returns `{ configured: false }` until the
// IMAGEKIT_PRIVATE_KEY env var is set.
uploadRoutes.post('/imagekit-auth', authRequired, imagekitAuth)
