import { build } from 'esbuild'
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const outDir = path.join(root, 'dist-electron')

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

await build({
  entryPoints: ['src/electron/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'dist-electron/main.js',
  packages: 'external',
  sourcemap: false,
})

fs.copyFileSync('src/electron/preload.cjs', 'dist-electron/preload.cjs')
