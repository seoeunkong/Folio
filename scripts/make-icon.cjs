// resources/icon.png(256x256)을 만든다: 차콜 배경 + 아이보리 세리프 F, 중앙 배치.
// 서체를 그대로 쓰려고 Electron 캔버스로 그린다. 사용: npx electron scripts/make-icon.cjs
const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('node:fs')
const { join } = require('node:path')

const opts = {
  size: 256,
  bg: '#161514', // 거의 검정에 가까운 차콜
  fg: '#EDE5D3', // 크림·아이보리
  font: '"Baskerville Old Face", "Libre Baskerville", Georgia, serif',
}

function draw({ size: S, bg, fg, font }) {
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  g.fillStyle = bg
  g.beginPath()
  g.roundRect(0, 0, S, S, S * 0.22)
  g.fill()
  g.fillStyle = fg
  g.font = `${Math.round(S * 0.66)}px ${font}`
  const m = g.measureText('F')
  // 글자의 실제 잉크 영역을 기준으로 가운데에 놓는다
  const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
  g.fillText('F', (S - w) / 2 + m.actualBoundingBoxLeft, (S - h) / 2 + m.actualBoundingBoxAscent)
  return c.toDataURL('image/png')
}

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false })
  await w.loadURL('data:text/html,<html></html>')
  const dataUrl = await w.webContents.executeJavaScript(`(${draw})(${JSON.stringify(opts)})`)
  writeFileSync(join(__dirname, '../resources/icon.png'), Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log('resources/icon.png written')
  app.quit()
})
