// Static Git/file audit only: no browser, server, build or network required.
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '../..')
const tracked = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))
const required = new Set(require('./runtime-images.json').map(name => `frontend/public/${name}`))
const visualExtension = /\.(avif|png|jpe?g|webp|gif|svg|ico|ttf|otf|woff2?)$/i
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const name = `${dir}/${entry.name}`
    return entry.isDirectory() ? walk(name) : [name]
  })
}
for (const dir of ['frontend/public/assets', 'frontend/public/fonts', 'frontend/src']) {
  for (const file of walk(dir)) {
    if (visualExtension.test(file)) required.add(file)
    if (!/\.(vue|ts|css)$/.test(file)) continue
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    for (const match of source.matchAll(/["'`]\/(assets|fonts|img)\/([^"'`\n<>]+)["'`]/g)) {
      if (match[2].includes('${')) continue
      required.add(`frontend/public/${match[1]}/${match[2].split('?')[0]}`)
    }
  }
}
const errors = []
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing: ${file}`)
  else if (!tracked.has(file)) errors.push(`Not tracked: ${file}`)
}
for (const file of tracked) {
  if (/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file)) errors.push(`Audio is tracked: ${file}`)
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`${required.size} required visual files exist and are tracked; no audio files are tracked.`)
  console.log('Dynamic card art is CDN-backed and is not validated by this static audit.')
}
