import type { Server } from 'http'
import { createServerApp } from './app.js'

export function startServer(port = Number(process.env.PORT) || 3001): Server {
  const app = createServerApp()
  return app.listen(port, () => {
    console.log(`Trace Viewer API running at http://localhost:${port}`)
  })
}

startServer()
