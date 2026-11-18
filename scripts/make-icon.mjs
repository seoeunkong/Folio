// resources/icon.png (256x256)을 만든다: 검은 둥근 사각형 + 흰 체크 표시.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const S = 256
const px = Buffer.alloc(S * S * 4)

function distToSeg(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
}
function inRoundRect(x, y, r) {
  const cx = Math.min(Math.max(x, r), S - r), cy = Math.min(Math.max(y, r), S - r)
  return Math.hypot(x - cx, y - cy) <= r
}

const SS = 4 // 4x4 슈퍼샘플링으로 가장자리를 부드럽게
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  let bg = 0, fg = 0
  for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
    const fx = x + (sx + 0.5) / SS, fy = y + (sy + 0.5) / SS
    if (!inRoundRect(fx, fy, 56)) continue
    bg++
    const d = Math.min(distToSeg(fx, fy, 70, 132, 110, 172), distToSeg(fx, fy, 110, 172, 188, 88))
    if (d <= 15) fg++
  }
  const n = SS * SS, i = (y * S + x) * 4
  const v = bg ? Math.round((fg / bg) * 255) : 0
  const base = 17
  px[i] = px[i + 1] = px[i + 2] = Math.round(base + (v / 255) * (250 - base))
  px[i + 3] = Math.round((bg / n) * 255)
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6
const raw = Buffer.alloc(S * (S * 4 + 1))
for (let y = 0; y < S; y++) px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4)
writeFileSync(new URL('../resources/icon.png', import.meta.url), Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]))
console.log('resources/icon.png written')
