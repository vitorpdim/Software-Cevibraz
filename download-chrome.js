// download-chrome.js
const { install, computeExecutablePath } = require('@puppeteer/browsers');
const path = require('path');
const fs = require('fs');

const CHROME_VERSION = '119.0.6045.105'; 
const cacheDir = path.resolve(__dirname, 'local-chromium');

async function downloadChrome() {
  try {
    console.log(`Verificando o Chromium na pasta: ${cacheDir}`);

    const executablePath = computeExecutablePath({
      browser: 'chrome',
      buildId: CHROME_VERSION,
      cacheDir,
    });

    if (fs.existsSync(executablePath)) {
      console.log(`O Chromium (versão ${CHROME_VERSION}) já existe. Pulando o download.`);
      return;
    }

    console.log(`Baixando o Chromium (versão ${CHROME_VERSION}). Isso pode levar alguns minutos...`);

    await install({
      browser: 'chrome',
      buildId: CHROME_VERSION,
      cacheDir,
      unpack: true,
    });

    console.log('Download do Chromium concluído com sucesso!');

  } catch (error) {
    console.error('Erro ao baixar o Chromium:', error);
    process.exit(1);
  }
}

downloadChrome();
