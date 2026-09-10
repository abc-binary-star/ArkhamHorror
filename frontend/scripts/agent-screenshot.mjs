// Screenshot the agent verification Chrome. Launch it once with:
//   open -na "Google Chrome" --args --user-data-dir=/tmp/ah-agent-profile \
//     --remote-debugging-port=9223 http://127.0.0.1:8080/#/sign-in
// then log in by hand in that window. Usage:
//   node scripts/agent-screenshot.mjs [out.png] [urlSubstring]
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const [out = '/tmp/ah-shot/agent.png', filter = '127.0.0.1:8080'] = process.argv.slice(2)
const PORT = process.env.CDP_PORT || 9223

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
const target = targets.find((t) => t.type === 'page' && t.url.includes(filter))
if (!target) {
  console.error(`no page matching "${filter}"; open it in the verification Chrome first`)
  process.exit(1)
}

const ws = new WebSocket(target.webSocketDebuggerUrl)
const timer = setTimeout(() => {
  console.error('screenshot timed out')
  process.exit(1)
}, 15000)

ws.onopen = () =>
  ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }))
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id !== 1) return
  clearTimeout(timer)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, Buffer.from(msg.result.data, 'base64'))
  console.log(out)
  ws.close()
}
