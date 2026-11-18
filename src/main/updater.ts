import { app, Notification } from 'electron'
import { autoUpdater } from 'electron-updater'

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

/**
 * GitHub Releases(seoeunkong/Folio)에서 새 버전을 확인해 백그라운드로 내려받는다.
 * 설치본에서만 동작한다(개발 실행·FOLIO_USER_DATA 시험 실행은 건너뜀). 확인할 곳은 설치본에 들어가는
 * app-update.yml(package.json build.publish로 생성)에 적혀 있다.
 * 다 받으면 알림을 띄우고 onReady로 알린다. 설치는 트레이 메뉴의 '다시 시작'이나 다음 종료 때 일어난다.
 */
export function setupAutoUpdate(onReady: (version: string) => void) {
  if (!app.isPackaged || process.env.FOLIO_USER_DATA) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-downloaded', ({ version }) => {
    onReady(version)
    new Notification({
      title: `Folio ${version} 준비됨`,
      body: '트레이 메뉴에서 "업데이트 설치 후 다시 시작"을 누르거나, 다음에 종료할 때 설치됩니다.',
    }).show()
  })
  // 오프라인·회사 방화벽 등으로 실패해도 앱 사용에는 영향이 없게 조용히 넘긴다
  autoUpdater.on('error', (e) => console.warn('[update]', e.message))
  const check = () => void autoUpdater.checkForUpdates().catch(() => {})
  check()
  setInterval(check, CHECK_EVERY_MS)
}

export function installUpdateNow() {
  autoUpdater.quitAndInstall(true, true) // 조용히 설치하고 다시 실행
}
