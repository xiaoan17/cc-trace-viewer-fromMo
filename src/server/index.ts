import express from 'express'
import { router } from './api.js'

const app = express()
const PORT = 3001

app.use(express.json())
app.use('/api', router)

app.listen(PORT, () => {
  console.log(`Trace Viewer API running at http://localhost:${PORT}`)
})
