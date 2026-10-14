const { ipcRenderer } = require('electron');

let videoData = null;

// Controlos da Janela Personalizada
document.getElementById('btn-minimize').addEventListener('click', () => {
  ipcRenderer.send('window-minimize');
});

document.getElementById('btn-close').addEventListener('click', () => {
  ipcRenderer.send('window-close');
});

// Elementos da DOM
const stepUrl = document.getElementById('step-url');
const stepLoading = document.getElementById('step-loading');
const stepOptions = document.getElementById('step-options');
const stepProgress = document.getElementById('step-progress');

const videoUrlInput = document.getElementById('video-url');
const btnFetch = document.getElementById('btn-fetch');
const urlError = document.getElementById('url-error');

const thumb = document.getElementById('thumb');
const videoTitle = document.getElementById('video-title');
const btnVideo = document.getElementById('btn-video');
const btnAudio = document.getElementById('btn-audio');
const btnToggleAdvanced = document.getElementById('btn-toggle-advanced');
const advancedSection = document.getElementById('advanced-section');
const audioFormatsContainer = document.getElementById('audio-formats');
const videoFormatsContainer = document.getElementById('video-formats');

const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const btnReset = document.getElementById('btn-reset');

function showStep(step) {
  [stepUrl, stepLoading, stepOptions, stepProgress].forEach(s => s.classList.remove('active'));
  step.classList.add('active');
}

// 1. Buscar Vídeo
btnFetch.addEventListener('click', async () => {
  const url = videoUrlInput.value.trim();
  if (!url) return;

  urlError.innerText = '';
  showStep(stepLoading);

  try {
    videoData = await ipcRenderer.invoke('get-video-info', url);
    thumb.src = videoData.thumbnail;
    videoTitle.innerText = videoData.title;

    renderAdvancedFormats(videoData.formats);
    showStep(stepOptions);
  } catch (err) {
    showStep(stepUrl);
    urlError.innerText = 'Erro ao carregar o vídeo. Verifique a URL.';
  }
});

// 2. Download Simples
btnVideo.addEventListener('click', () => startDownload('video-simple'));
btnAudio.addEventListener('click', () => startDownload('audio-simple'));

// Alternar Seção Avançada
btnToggleAdvanced.addEventListener('click', () => {
  advancedSection.classList.toggle('hidden');
});

// Renderizar Opções Avançadas
function renderAdvancedFormats(formats) {
  audioFormatsContainer.innerHTML = '';
  videoFormatsContainer.innerHTML = '';

  const addedResolutions = new Set();

  formats.reverse().forEach(fmt => {
    if (fmt.vcodec !== 'none' && fmt.height && !addedResolutions.has(fmt.height)) {
      addedResolutions.add(fmt.height);
      const btn = document.createElement('button');
      btn.className = 'format-btn';
      btn.innerText = `${fmt.height}p (${fmt.ext.toUpperCase()})`;
      btn.onclick = () => startDownload('advanced', fmt.format_id);
      videoFormatsContainer.appendChild(btn);
    }
  });

  ['MP3 320kbps (Alta Qualidade)', 'M4A Áudio'].forEach((label) => {
    const btn = document.createElement('button');
    btn.className = 'format-btn';
    btn.innerText = label;
    btn.onclick = () => startDownload('audio-simple');
    audioFormatsContainer.appendChild(btn);
  });
}

function startDownload(type, formatId = null) {
  showStep(stepProgress);
  progressBar.style.width = '0%';
  progressText.innerText = 'A iniciar...';
  btnReset.classList.add('hidden');

  ipcRenderer.send('start-download', {
    url: videoUrlInput.value.trim(),
    formatId,
    type
  });
}

// Escutar Progresso
ipcRenderer.on('download-progress', (event, { percentage }) => {
  progressBar.style.width = `${percentage}%`;
  progressText.innerText = `${percentage.toFixed(1)}%`;
});

ipcRenderer.on('download-complete', (event, message) => {
  progressBar.style.width = '100%';
  progressText.innerText = 'Salvo na pasta Downloads!';
  btnReset.classList.remove('hidden');
});

ipcRenderer.on('download-error', (event, errorData) => {
  progressText.innerText = errorData.message;
  const detailsElement = document.getElementById('progress-error-details');
  detailsElement.innerText = `Detalhes técnicos:\n${errorData.details}`;
  detailsElement.classList.remove('hidden');
  btnReset.classList.remove('hidden');
});

btnReset.addEventListener('click', () => {
  videoUrlInput.value = '';
  advancedSection.classList.add('hidden');
  document.getElementById('progress-error-details').classList.add('hidden');
  showStep(stepUrl);
});