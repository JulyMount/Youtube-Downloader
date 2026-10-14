const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 620,
    height: 760,
    resizable: false,
    frame: false, // Remove a moldura padrão do Windows para um aspeto orgânico
    transparent: true, // Permite cantos arredondados na janela
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Controlos da Janela Personalizada
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-close', () => mainWindow.close());

// Caminhos dos executáveis locais
const binDir = path.join(__dirname, 'bin');
const ytDlpPath = path.join(binDir, 'yt-dlp.exe');
const ffmpegPath = path.join(binDir, 'ffmpeg.exe');
const downloadFolder = path.join(os.homedir(), 'Downloads');

// Handler 1: Obter detalhes do vídeo/playlist
ipcMain.handle('get-video-info', async (event, url) => {
  return new Promise((resolve, reject) => {
    const process = spawn(ytDlpPath, ['-J', '--no-warnings', url]);
    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => output += data.toString());
    process.stderr.on('data', (data) => errorOutput += data.toString());

    process.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(output));
        } catch (e) {
          reject('Falha ao ler os dados do vídeo.');
        }
      } else {
        reject(errorOutput || 'Erro ao carregar informações do vídeo.');
      }
    });
  });
});

// Handler 2: Iniciar Download
ipcMain.on('start-download', (event, { url, formatId, type }) => {
  let args = [];
  const outputTemplate = path.join(downloadFolder, '%(title)s.%(ext)s');

  if (type === 'audio-simple') {
    args = ['-x', '--audio-format', 'mp3', '--ffmpeg-location', ffmpegPath, '-o', outputTemplate, url];
  } else if (type === 'video-simple') {
    args = ['-f', 'bv*+ba/b', '--merge-output-format', 'mp4', '--ffmpeg-location', ffmpegPath, '-o', outputTemplate, url];
  } else if (type === 'advanced') {
    args = ['-f', formatId, '--ffmpeg-location', ffmpegPath, '-o', outputTemplate, url];
  }

  const downloader = spawn(ytDlpPath, args);
  let errorOutput = '';

  downloader.stdout.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/\[download\]\s+(\d+\.?\d*)%/);
    if (match) {
      const percentage = parseFloat(match[1]);
      mainWindow.webContents.send('download-progress', { percentage, raw: text });
    }
  });

  downloader.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  downloader.on('close', (code) => {
    if (code === 0) {
      mainWindow.webContents.send('download-complete', 'Download concluído com sucesso!');
    } else {
      mainWindow.webContents.send('download-error', { 
        message: 'Ocorreu um erro durante o download.',
        details: errorOutput
      });
    }
  });
});