import express from 'express'
import { router } from './api.js'

export function createServerApp() {
  const app = express()

  app.use(express.json())
  app.use('/api', router)

  return app
}
