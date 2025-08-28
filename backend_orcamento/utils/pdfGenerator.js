// backend_orcamento/utils/pdfGenerator.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs/promises');

const getExecutablePath = () => {
    const CHROME_VERSION = '119.0.6045.105';

    const isPackaged = __dirname.includes('app.asar');

    let chromePath = path.join(__dirname, '..', 'local-chromium');

    if (isPackaged) {
        chromePath = chromePath.replace('app.asar', 'app.asar.unpacked');
    }

    const platform = process.platform;
    if (platform === 'win32') {
        return path.join(chromePath, 'chrome', `win64-${CHROME_VERSION}`, 'chrome-win64', 'chrome.exe');
    }
    return '';
};


async function generateOrderPdf(pedidoData, quadrosAgrupadosData, logoBase64, iconeWhatsappBase64) {
    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: getExecutablePath(),
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        const templatePath = path.join(__dirname, '..', 'pdf_template.html');
        let htmlContent = await fs.readFile(templatePath, 'utf8');

        htmlContent = htmlContent.replace('src="CAMINHO_PARA_SUA_LOGO_AQUI"', `src="${logoBase64}"`);
        htmlContent = htmlContent.replace('src="CAMINHO_ICONE_WHATSAPP"', `src="${iconeWhatsappBase64}"`);

        // Preenchimento dos dados do pedido
        htmlContent = htmlContent.replace('<span id="dataPedido"></span>', `<span id="dataPedido">${new Date(pedidoData.data_criacao).toLocaleDateString('pt-BR')}</span>`);
        htmlContent = htmlContent.replace('<span id="numeroPedido" class="pedido-numero"></span>', `<span id="numeroPedido" class="pedido-numero">${pedidoData.numero_pedido}</span>`);
        htmlContent = htmlContent.replace('<span id="nomeCliente"></span>', `<span id="nomeCliente">${pedidoData.cliente_nome}</span>`);
        htmlContent = htmlContent.replace('<span id="telefoneCliente"></span>', `<span id="telefoneCliente">${pedidoData.cliente_telefone || ''}</span>`);
        htmlContent = htmlContent.replace('<span id="nomeAtendente"></span>', `<span id="nomeAtendente">${pedidoData.atendente || ''}</span>`);

        if (pedidoData.observacoes && pedidoData.observacoes.trim() !== '') {
            htmlContent = htmlContent.replace('<p id="observacoesGerais"></p>', `<p id="observacoesGerais">${pedidoData.observacoes}</p>`);
        } else {
            htmlContent = htmlContent.replace('<div class="observacoes-box" id="observacoesContainer">', '<div class="observacoes-box" id="observacoesContainer" style="display: none;">');
        }

        htmlContent = htmlContent.replace('<span id="valorTotal"></span>', `<span id="valorTotal">R$ ${parseFloat(pedidoData.valor_final).toFixed(2)}</span>`);

        let quadrosHtml = '';
        quadrosAgrupadosData.forEach(grupo => {
            const detalhes = grupo.detalhes;
            quadrosHtml += `<div class="quadro-item-container"><h4>${grupo.quantidade}x Quadro</h4><div class="quadro-item-details"><ul>`;
            let medidasStr = `${parseFloat(detalhes.altura_cm).toFixed(2)}cm x ${parseFloat(detalhes.largura_cm).toFixed(2)}cm`;
            if (detalhes.medida_fornecida_cliente) {
                medidasStr = `Medida fornecida pelo cliente: ${medidasStr}`;
            }
            quadrosHtml += `<li><strong>Medidas:</strong> ${medidasStr}</li>`;
            if (detalhes.molduras && detalhes.molduras.length > 0) {
                quadrosHtml += `<li><strong>Moldura(s):</strong> ${detalhes.molduras.map(m => m.nome).join(', ')}</li>`;
            }
            const listaItens = [];
            if (detalhes.materiais && detalhes.materiais.length > 0) {
                detalhes.materiais.forEach(mat => {
                    if (mat.nome.toLowerCase() === 'paspatur' && mat.espessura_paspatur_cm && parseFloat(mat.espessura_paspatur_cm) > 0) {
                        listaItens.push(`${mat.nome} (${parseFloat(mat.espessura_paspatur_cm).toFixed(2)}cm)`);
                    } else {
                        listaItens.push(mat.nome);
                    }
                });
            }
            if (detalhes.limpeza_flag) {
                const custoLimpeza = detalhes.detalhesCalculo && detalhes.detalhesCalculo.custoLimpezaDetalhe ? parseFloat(detalhes.detalhesCalculo.custoLimpezaDetalhe).toFixed(2) : 'Custo não informado';
                listaItens.push(`Limpeza (R$ ${custoLimpeza})`);
            }
            if (listaItens.length > 0) {
                quadrosHtml += `<li><strong>Itens:</strong> ${listaItens.join(', ')}</li>`;
            }
            quadrosHtml += `</ul></div></div>`;
        });
        htmlContent = htmlContent.replace('<div class="section" id="quadrosList"></div>', `<div class="section" id="quadrosList">${quadrosHtml}</div>`);

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
            timeout: 120000
        });

        console.log(`[GERADOR_PEDIDO_PDF] PDF gerado com sucesso. Tamanho do buffer: ${pdfBuffer.length}`);
        return pdfBuffer;

    } catch (error) {
        console.error('[ERRO_GERADOR_PDF] Falha DENTRO do gerador de PDF (Puppeteer):', error);
        throw new Error(`Falha interna na geração de PDF (Puppeteer): ${error.message || 'Erro desconhecido'}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
module.exports = { generateOrderPdf };