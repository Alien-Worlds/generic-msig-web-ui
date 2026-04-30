import { app, BrowserWindow, nativeImage, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const APP_NAME = 'Generic MSIG';
const distPath = path.join(__dirname, 'dist/index.html');
const iconPath = path.resolve(__dirname, 'src/assets/icon/app-icon.png');

// In development, Electron defaults to the app name "Electron" on macOS.
// Explicitly setting the name ensures the Dock label matches our product name.
app.setName(APP_NAME);

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const icon = nativeImage.createFromPath(iconPath);
  if (process.platform === 'darwin' && app.dock && !icon.isEmpty()) {
    app.dock.setIcon(icon);
  }

  const win = new BrowserWindow({
    width,
    height,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Standalone: load built files from dist/ when they exist (e.g. after yarn build).
  // Dev: only when explicitly in dev mode (yarn dev), load from Vite dev server.
  const isExplicitDev = process.env.NODE_ENV === 'development';
  const hasBuiltApp = fs.existsSync(distPath);

  if (isExplicitDev) {
    // Started via yarn dev — use Vite dev server (hot reload).
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
    win.webContents.on('did-fail-load', (_event, _code, description) => {
      console.error('Failed to load dev server:', description);
      setTimeout(() => win.loadURL('http://localhost:3000'), 1000);
    });
  } else if (hasBuiltApp) {
    // Standalone: run without any server (yarn build && yarn start or packaged app).
    win.loadFile(distPath);
  } else {
    // No dist and not in dev — show a clear message.
    win.loadURL(
      'data:text/html,' +
      encodeURIComponent(`
        <!DOCTYPE html><html><head><meta charset="utf-8"><title>Generic MSIG</title></head>
        <body style="font-family:sans-serif;max-width:480px;margin:2rem auto;padding:1rem;">
          <h1>Generic MSIG</h1>
          <p>No built app found. Either:</p>
          <ul>
            <li>Run <code>yarn build</code> then <code>yarn start</code> to run standalone, or</li>
            <li>Run <code>yarn dev</code> to run with the development server.</li>
          </ul>
        </body></html>
      `)
    );
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
