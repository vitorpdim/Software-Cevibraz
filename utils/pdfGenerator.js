// pdfGenerator.js 
const { app } = require('electron');
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs/promises');

const LOGO_BASE64 = ""
const ICONE_WHATSAPP_BASE64 = ""

async function generateOrderPdf(pedidoData, quadrosAgrupadosData) {
    let browser;
    try {
        const isProd = !process.env.ELECTRON_RUN_AS_NODE;
        const chromiumPath = isProd
            ? path.join(process.resourcesPath, 'chromium', 'chrome.exe')
            : path.join(__dirname, '..', '..', 'chromium', 'chrome.exe');

        browser = await puppeteer.launch({
            executablePath: chromiumPath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        const templatePath = app.isPackaged
            ? path.join(process.resourcesPath, 'app.asar', 'backend_orcamento', 'pdf_template.html') // Caminho quando instalado
            : path.join(__dirname, '..', 'pdf_template.html'); // Caminho para desenvolvimento
        let htmlContent = await fs.readFile(templatePath, 'utf8');


        // Substituir o SRC da logo no template
        htmlContent = htmlContent.replace('src="CAMINHO_PARA_SUA_LOGO_AQUI"', `src="${LOGO_BASE64}"`);

        htmlContent = htmlContent.replace('src="CAMINHO_ICONE_WHATSAPP"', `src="${ICONE_WHATSAPP_BASE64}"`);


        // Preencher dados do info-grid
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

        // Construir HTML para os quadros agrupados (LÓGICA EXISTENTE - JÁ FUNCIONANDO BEM)
        let quadrosHtml = '';
        quadrosAgrupadosData.forEach(grupo => {
            const detalhes = grupo.detalhes;
            quadrosHtml += `<div class="quadro-item-container">`;
            quadrosHtml += `    <h4>${grupo.quantidade}x Quadro</h4>`;
            quadrosHtml += `    <div class="quadro-item-details"><ul>`;

            let medidasStr = `${parseFloat(detalhes.altura_cm).toFixed(2)}cm x ${parseFloat(detalhes.largura_cm).toFixed(2)}cm`;
            if (detalhes.medida_fornecida_cliente) {
                medidasStr = `Medida fornecida pelo cliente: ${medidasStr}`;
            }
            quadrosHtml += `        <li><strong>Medidas:</strong> ${medidasStr}</li>`;

            if (detalhes.molduras && detalhes.molduras.length > 0) {
                quadrosHtml += `        <li><strong>Moldura(s):</strong> ${detalhes.molduras.map(m => m.nome).join(', ')}</li>`;
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
                const custoLimpeza = detalhes.detalhesCalculo && detalhes.detalhesCalculo.custoLimpezaDetalhe
                    ? parseFloat(detalhes.detalhesCalculo.custoLimpezaDetalhe).toFixed(2)
                    : 'Custo não informado';
                listaItens.push(`Limpeza (R$ ${custoLimpeza})`);
            }

            if (listaItens.length > 0) {
                quadrosHtml += `        <li><strong>Itens:</strong> ${listaItens.join(', ')}</li>`;
            }
            quadrosHtml += `    </ul></div></div>`;
        });

        const quadrosListPlaceholder = '<div class="section" id="quadrosList">';
        const placeholderEndToken = '</div>';
        const startIndex = htmlContent.indexOf(quadrosListPlaceholder);

        if (startIndex !== -1) {
            const actualEndIndex = htmlContent.indexOf(placeholderEndToken, startIndex + quadrosListPlaceholder.length);
            if (actualEndIndex !== -1) {
                htmlContent = htmlContent.substring(0, startIndex + quadrosListPlaceholder.length) +
                    quadrosHtml +
                    htmlContent.substring(actualEndIndex);
            } else {
                htmlContent = htmlContent.replace(quadrosListPlaceholder + placeholderEndToken, quadrosListPlaceholder + quadrosHtml + placeholderEndToken);
            }
        }

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true, // Importante para fundos de CSS e imagens base64
            margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
            timeout: 60000
        });

        return pdfBuffer;

    } catch (error) {
        console.error('Erro ao gerar PDF do Pedido:', error);
        throw new Error('Falha ao gerar PDF do Pedido.');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = { generateOrderPdf };
