// -----------------------------------------------------------------------------
// SEÇÃO 1: CONSTANTES E VARIÁVEIS GLOBAIS
// -----------------------------------------------------------------------------
const API_URL = 'http://localhost:3000/api';

// variáveis de estado
let modoEdicao = false;
let pedidoEditadoId = null;
let quadrosDoPedido = [];
let quadroAtualIndex = 0;

// seletores de Elementos do DOM 

const molduraContainer = document.getElementById('moldura-container');
const checkboxInicial = document.getElementById('checkbox-inicial');
const inputInicial = document.getElementById('input-inicial');
const datalist = document.getElementById('lista-molduras');
const btnAdicionarNovaMoldura = document.getElementById('btnAdicionarNovaMoldura');

const inputLarguraQuadro = document.getElementById('inputLarguraQuadro');
const inputAlturaQuadro = document.getElementById('inputAlturaQuadro');
const btnCalcularPreco = document.getElementById('btnCalcularPreco');
const resultadoCalculoDiv = document.getElementById('resultadoCalculo');

const chkFundo = document.getElementById('chkFundo');
const chkSarrafo = document.getElementById('chkSarrafo');
const chkVidro = document.getElementById('chkVidro');
const chkSegundoVidro = document.getElementById('chkSegundoVidro');

const chkPaspatur = document.getElementById('checkbox-paspatur');
const paspaturOpcoes = document.getElementById('paspatur-opcoes');
const btnEspessura = document.getElementById('btn-espessura');
const inputEspessura = document.getElementById('input-espessura');

const chkMedidaCliente = document.getElementById('chkMedidaCliente');
const chkLimpeza = document.getElementById('chkLimpeza');

const inputNomeAtendente = document.getElementById('inputNomeAtendente');
const inputNomeCliente = document.getElementById('inputNomeCliente');
const inputTelefoneCliente = document.getElementById('inputTelefoneCliente');
const textareaObservacoes = document.getElementById('textareaObservacoes');

const btnNovoQuadro = document.getElementById('btnNovoQuadro');
const btnCopiarQuadro = document.getElementById('btnCopiarQuadro');
const btnSalvarQuadro = document.getElementById('btnSalvarQuadro');
const btnFinalizarPedido = document.getElementById('btnFinalizarPedido');

// eElementos de navegação 
const navegacaoQuadrosContainer = document.getElementById('navegacao-quadros-container');
const btnQuadroAnterior = document.getElementById('btnQuadroAnterior');
const btnQuadroProximo = document.getElementById('btnQuadroProximo');
const contadorQuadrosDisplay = document.getElementById('contadorQuadros');

// elementos de edição de valor final 
const chkEditarValorFinal = document.getElementById('chkEditarValorFinal');
const edicaoValorFinalContainer = document.getElementById('edicaoValorFinalContainer');
const inputValorFinalEditado = document.getElementById('inputValorFinalEditado');
const btnSalvarValorEditado = document.getElementById('btnSalvarValorEditado');

// -----------------------------------------------------------------------------
// SEÇÃO 2: FUNÇÕES DE MANIPULAÇÃO DO FORMULÁRIO E DADOS
// -----------------------------------------------------------------------------

function showCustomAlert(message) {
    if (window.electronAPI && typeof window.electronAPI.showAlert === 'function') {
        window.electronAPI.showshowCustomAlert(message);
    } else {
        showCustomAlert(message);
    }
}


function getDadosQuadroAtual() {
    const moldurasSelecionadas = getMoldurasSelecionadas();
    const materiaisSelecionados = getMateriaisSelecionados();
    const espessuraPaspatur = chkPaspatur.checked ? parseFloat(inputEspessura.value) || 0 : 0;
    const medidaFornecidaCliente = chkMedidaCliente.checked;
    const limpezaSelecionada = chkLimpeza.checked;
    let valorCalculadoQuadro = parseFloat(resultadoCalculoDiv.dataset.valorTotalQuadro) || 0;

    return {
        altura: parseFloat(inputAlturaQuadro.value) || 0,
        largura: parseFloat(inputLarguraQuadro.value) || 0,
        moldurasSelecionadas, materiaisSelecionados, espessuraPaspatur,
        medidaFornecidaCliente, limpezaSelecionada, valorCalculado: valorCalculadoQuadro
    };
}

function preencherFormularioQuadro(quadro) {
    if (!quadro) return;
    limparFormularioQuadro(); // limpar o formulário antes de preencher

    inputAlturaQuadro.value = quadro.altura || '';
    inputLarguraQuadro.value = quadro.largura || '';
    chkMedidaCliente.checked = quadro.medidaFornecidaCliente || false;
    chkLimpeza.checked = quadro.limpezaSelecionada || false;

    if (quadro.moldurasSelecionadas && quadro.moldurasSelecionadas.length > 0) {
        checkboxInicial.checked = true;
        inputInicial.disabled = false;
        inputInicial.value = quadro.moldurasSelecionadas[0];
        for (let i = 1; i < quadro.moldurasSelecionadas.length; i++) {
            adicionarLinhaMolduraDinamica(quadro.moldurasSelecionadas[i]);
        }
    }

    if (quadro.materiaisSelecionados) {
        quadro.materiaisSelecionados.forEach(material => {
            const chk = document.querySelector(`input[type="checkbox"][value="${material}"]`);
            if (chk) chk.checked = true;
            if (material === 'Paspatur') {
                chkPaspatur.checked = true;
                paspaturOpcoes.classList.remove('d-none');
                if (quadro.espessuraPaspatur > 0) {
                    inputEspessura.classList.remove('d-none');
                    inputEspessura.value = quadro.espessuraPaspatur;
                }
            }
        });
    }

    if (quadro.valorCalculado && quadro.valorCalculado > 0) {
        resultadoCalculoDiv.innerHTML = `<h4>Total do Quadro Atual: R$ ${quadro.valorCalculado.toFixed(2)}</h4>`;
        resultadoCalculoDiv.dataset.valorTotalQuadro = quadro.valorCalculado.toFixed(2);
    }
}

function limparFormularioQuadro() {
    inputLarguraQuadro.value = '';
    inputAlturaQuadro.value = '';
    chkMedidaCliente.checked = false;
    chkLimpeza.checked = false;

    checkboxInicial.checked = false;
    inputInicial.value = '';
    inputInicial.disabled = true;
    molduraContainer.querySelectorAll('.moldura-linha:not(:first-child)').forEach(linha => linha.remove());

    [chkFundo, chkSarrafo, chkVidro, chkSegundoVidro, chkPaspatur].forEach(chk => chk.checked = false);
    paspaturOpcoes.classList.add('d-none');
    inputEspessura.classList.add('d-none');
    inputEspessura.value = '';
    resultadoCalculoDiv.innerHTML = '';
    resultadoCalculoDiv.dataset.valorTotalQuadro = '0';
}

function resetarFormularioCompleto(limparTudo = false) {
    limparFormularioQuadro();

    if (limparTudo) {
        inputNomeAtendente.value = '';
        inputNomeCliente.value = '';
        inputTelefoneCliente.value = '';
        textareaObservacoes.value = '';

        inputNomeAtendente.disabled = false;
        inputNomeCliente.disabled = false;
        inputTelefoneCliente.disabled = false;

        chkEditarValorFinal.checked = false;
        edicaoValorFinalContainer.classList.add('d-none');
        inputValorFinalEditado.value = '';

        document.querySelector('h1').textContent = 'Orçamento de Quadros';
        btnFinalizarPedido.textContent = 'Finalizar Pedido (PDF)';
    }

    quadrosDoPedido = [getDadosQuadroAtual()];
    quadroAtualIndex = 0;
    atualizarContadorQuadros();

    inputLarguraQuadro.focus();
}

function marcarQuadroComoNaoCalculado() {
    const quadroAtual = quadrosDoPedido[quadroAtualIndex];
    if (!quadroAtual) return;

    if (quadroAtual.valorCalculado > 0) {
        resultadoCalculoDiv.innerHTML = '<span class="text-warning fw-bold">O preço foi alterado. Por favor, recalcule.</span>';
    }

    quadroAtual.valorCalculado = 0;
    resultadoCalculoDiv.dataset.valorTotalQuadro = '0';
    atualizarContadorQuadros();
}

function atualizarContadorQuadros() {
    const totalQuadros = quadrosDoPedido.length;
    if (totalQuadros === 0) {
        contadorQuadrosDisplay.textContent = `Quadro 1 de 1`;
    } else {
        contadorQuadrosDisplay.textContent = `Quadro ${quadroAtualIndex + 1} de ${totalQuadros}`;
    }

    // ----- LÓGICA DE ALERTA VISUAL -----
    const quadroAtual = quadrosDoPedido[quadroAtualIndex];
    if (quadroAtual && quadroAtual.valorCalculado === 0 && temDadosQuadroPreenchidos()) {
        contadorQuadrosDisplay.classList.add('text-danger', 'fw-bold');
        contadorQuadrosDisplay.title = 'Atenção: o preço deste quadro ainda não foi calculado!';
    } else {
        contadorQuadrosDisplay.classList.remove('text-danger', 'fw-bold');
        contadorQuadrosDisplay.title = '';
    }
    // ----- FIM DA LÓGICA DE ALERTA -----

    btnQuadroAnterior.disabled = quadroAtualIndex === 0;
    btnQuadroProximo.disabled = quadroAtualIndex === totalQuadros - 1;
}

function adicionarLinhaMolduraDinamica(valorMoldura = '') {
    const novaLinhaDiv = document.createElement('div');
    novaLinhaDiv.className = 'form-check mb-2 d-flex align-items-center moldura-linha';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'form-check-input me-2 checkbox-moldura-ativa';
    checkbox.checked = true;
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Código/Nome da moldura';
    input.className = 'form-control input-moldura-codigo interactive-number-input';
    input.setAttribute('list', 'lista-molduras');
    input.value = valorMoldura;
    const btnRemover = document.createElement('button');
    btnRemover.type = 'button';
    btnRemover.className = 'btn btn-sm btn-danger ms-2 btn-remover-moldura-custom';
    btnRemover.textContent = 'X';
    btnRemover.onclick = function () { novaLinhaDiv.remove(); };
    checkbox.addEventListener('change', function () {
        input.disabled = !this.checked;
        if (!this.checked) input.value = '';
    });
    checkbox.addEventListener('change', marcarQuadroComoNaoCalculado);
    input.addEventListener('input', marcarQuadroComoNaoCalculado);
    novaLinhaDiv.appendChild(checkbox);
    novaLinhaDiv.appendChild(input);
    novaLinhaDiv.appendChild(btnRemover);
    molduraContainer.appendChild(novaLinhaDiv);
}

function getMoldurasSelecionadas() {
    const molduras = [];
    if (checkboxInicial.checked && inputInicial.value.trim()) {
        molduras.push(inputInicial.value.trim());
    }
    molduraContainer.querySelectorAll('.moldura-linha:not(:first-child)').forEach(linha => {
        const checkbox = linha.querySelector('.checkbox-moldura-ativa');
        const input = linha.querySelector('.input-moldura-codigo');
        if (checkbox && checkbox.checked && input && input.value.trim()) {
            molduras.push(input.value.trim());
        }
    });
    return molduras;
}

function getMateriaisSelecionados() {
    const materiais = [];
    if (chkFundo.checked) materiais.push(chkFundo.value);
    if (chkSarrafo.checked) materiais.push(chkSarrafo.value);
    if (chkVidro.checked) materiais.push(chkVidro.value);
    if (chkSegundoVidro.checked) materiais.push(chkSegundoVidro.value);
    if (chkPaspatur.checked) materiais.push(chkPaspatur.value);
    return materiais;
}

function temDadosQuadroPreenchidos(quadro) {
    if (!quadro) return false;
    return (
        quadro.altura > 0 ||
        quadro.largura > 0 ||
        (quadro.moldurasSelecionadas && quadro.moldurasSelecionadas.length > 0) ||
        (quadro.materiaisSelecionados && quadro.materiaisSelecionados.length > 0) ||
        quadro.limpezaSelecionada
    );
}

function validarDadosClienteAtendente() {
    if (!inputNomeAtendente.value.trim()) {
        showCustomAlert('Por favor, preencha o nome do atendente.');
        inputNomeAtendente.focus();
        return false;
    }
    if (!inputNomeCliente.value.trim()) {
        showCustomAlert('Por favor, preencha o nome do cliente.');
        inputNomeCliente.focus();
        return false;
    }
    return true;
}

function validarMedidasQuadroAtual(mostrarAlerta = true) {
    if (temDadosQuadroPreenchidos()) {
        const altura = parseFloat(inputAlturaQuadro.value);
        const largura = parseFloat(inputLarguraQuadro.value);
        if (isNaN(altura) || altura <= 0 || isNaN(largura) || largura <= 0) {
            if (mostrarAlerta) {
                showCustomAlert('Se itens foram selecionados, por favor, preencha altura e largura válidas (maiores que zero).');
                inputLarguraQuadro.focus();
            }
            return false;
        }
    }
    return true;
}

// -----------------------------------------------------------------------------
// SEÇÃO 3: LÓGICA DE AÇÕES E EVENTOS
// -----------------------------------------------------------------------------

async function carregarMolduras() {
    try {
        const response = await fetch(`${API_URL}/molduras`);
        if (!response.ok) throw new Error(`Erro HTTP! Status: ${response.status}`);
        const molduras = await response.json();
        datalist.innerHTML = '';
        molduras.forEach(m => {
            const option = document.createElement('option');
            option.value = m.nome;
            datalist.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar molduras:', error);
    }
}

async function calcularPrecoViaBackend() {
    if (!validarMedidasQuadroAtual()) return;
    const dadosQuadroAtual = getDadosQuadroAtual();
    try {
        const response = await fetch(`${API_URL}/quadro/calcular`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosQuadroAtual)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Erro HTTP! Status: ${response.status}`);
        }
        const resultado = await response.json();
        resultadoCalculoDiv.dataset.valorTotalQuadro = resultado.total.toFixed(2);
        if (quadrosDoPedido[quadroAtualIndex]) {
            quadrosDoPedido[quadroAtualIndex].valorCalculado = resultado.total;
        }
        let htmlResultado = `<h4>Total do Quadro Atual: R$ ${resultado.total.toFixed(2)}</h4>`;
        if (resultado.detalhes && resultado.detalhes.length > 0) {
            htmlResultado += `<h5>Detalhes do Cálculo:</h5><ul>`;
            resultado.detalhes.forEach(detalhe => htmlResultado += `<li>${detalhe}</li>`);
            htmlResultado += `</ul>`;
        }
        resultadoCalculoDiv.innerHTML = htmlResultado;
    } catch (error) {
        console.error('Erro ao calcular preço:', error);
        resultadoCalculoDiv.innerHTML = `<span style="color: red;">Erro ao calcular: ${error.message}</span>`;
    }
}

function salvarQuadroAtual(silencioso = false) {
    // passando os dados do form para a função
    const dadosFormulario = getDadosQuadroAtual();

    if (!validarMedidasQuadroAtual(!silencioso)) {
        return false;
    }
    quadrosDoPedido[quadroAtualIndex] = dadosFormulario;

    if (!silencioso) {
        showCustomAlert(`Quadro ${quadroAtualIndex + 1} salvo localmente!`);
    }

    console.log(`Quadro ${quadroAtualIndex + 1} salvo. Array:`, JSON.parse(JSON.stringify(quadrosDoPedido)));
    atualizarContadorQuadros();
    return true;
}

// ------- FUNÇÃO ÚNICA PARA FINALIZAR (NOVO) OU SALVAR (EDIÇÃO) #####
async function finalizarOuSalvarPedido() {

    if (temDadosQuadroPreenchidos(getDadosQuadroAtual())) {
        if (!salvarQuadroAtual(true)) {
            showCustomAlert('O quadro atual possui dados inválidos. Corrija antes de prosseguir.');
            return;
        }
    }

    for (let i = 0; i < quadrosDoPedido.length; i++) {
        const quadro = quadrosDoPedido[i];
        if (temDadosQuadroPreenchidos(quadro) && quadro.valorCalculado === 0) {
            showCustomAlert(`Atenção: O Quadro ${i + 1} possui itens mas seu preço não foi calculado.\n\nPor favor, navegue até ele, clique em "Calcular Preço" e salve o quadro antes de finalizar o pedido.`);
            return;
        }
    }

    if (!validarDadosClienteAtendente() && !modoEdicao) {
        return;
    }
    const quadrosValidosParaEnvio = quadrosDoPedido.filter(q => q.altura > 0 && q.largura > 0);
    if (quadrosValidosParaEnvio.length === 0) {
        showCustomAlert('Nenhum quadro com medidas válidas para salvar/finalizar.');
        return;
    }

    btnFinalizarPedido.disabled = true;

    const valorCalculadoReal = quadrosValidosParaEnvio.reduce((sum, quadro) => sum + (quadro.valorCalculado || 0), 0);
    const dadosPedido = {
        observacoes: textareaObservacoes.value,
        quadros: quadrosValidosParaEnvio,
        valor_final_calculado: valorCalculadoReal
    };

    if (!modoEdicao) {
        dadosPedido.nomeAtendente = inputNomeAtendente.value;
        dadosPedido.nomeCliente = inputNomeCliente.value;
        dadosPedido.telefoneCliente = inputTelefoneCliente.value;
    }

    const metodo = modoEdicao ? 'PUT' : 'POST';
    const url = modoEdicao ? `${API_URL}/pedidos/${pedidoEditadoId}` : `${API_URL}/pedidos`;

    try {
        const response = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosPedido)
        });

        const responseText = await response.text();
        if (!response.ok) {
            let errorMessage = `Erro HTTP! Status: ${response.status}.`;
            try { errorMessage = JSON.parse(responseText).message || errorMessage; }
            catch (e) { errorMessage += ` Resposta: ${responseText}`; }
            throw new Error(errorMessage);
        }

        const data = JSON.parse(responseText);

        if (modoEdicao) {
            showCustomAlert(data.message);
            window.location.href = 'backlog/index.html';
        } else {
            let valorFinalDisplayPdf = chkEditarValorFinal.checked ? (parseFloat(inputValorFinalEditado.value) || valorCalculadoReal) : valorCalculadoReal;
            showCustomAlert(`Pedido ${data.numeroPedido} criado!`);

            let urlPdfPedido = `${API_URL}/pedidos/${data.pedidoId}/pdf?valor_editado=${valorFinalDisplayPdf.toFixed(2)}`;

            const pdfResponse = await fetch(urlPdfPedido);
            if (!pdfResponse.ok) throw new Error('Falha ao gerar PDF do Pedido.');

            const pdfBlob = await pdfResponse.blob();
            const pdfUrl = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = pdfUrl;
            a.download = `orcamento_pedido_${data.numeroPedido}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(pdfUrl);

            resetarFormularioCompleto(true);
        }
    } catch (error) {
        console.error('Erro:', error);
        showCustomAlert(`Ocorreu um erro: ${error.message}`);
    } finally {
        btnFinalizarPedido.disabled = false;
    }
}

// ----- LÓGICA DE EDIÇÃO -------
async function carregarPedidoParaEdicao(pedidoId) {
    try {
        const response = await fetch(`${API_URL}/pedidos/${pedidoId}`);
        if (!response.ok) {
            throw new Error('Pedido não encontrado ou erro no servidor.');
        }
        const data = await response.json();

        inputNomeAtendente.value = data.atendente;
        inputNomeCliente.value = data.clienteNome;
        inputTelefoneCliente.value = data.clienteTelefone;
        textareaObservacoes.value = data.observacoes;

        inputNomeAtendente.disabled = true;
        inputNomeCliente.disabled = true;
        inputTelefoneCliente.disabled = true;

        quadrosDoPedido = data.quadros.length > 0 ? data.quadros : [getDadosQuadroAtual()];
        quadroAtualIndex = 0;
        preencherFormularioQuadro(quadrosDoPedido[0]);
        atualizarContadorQuadros();

        document.querySelector('h1').textContent = `Editando Pedido #${pedidoEditadoId}`;
        btnFinalizarPedido.textContent = 'Salvar Alterações';
        navegacaoQuadrosContainer.classList.remove('d-none');

    } catch (error) {
        console.error('Erro ao carregar pedido para edição:', error);
        showCustomAlert('Não foi possível carregar o pedido para edição.');
        window.location.href = 'index.html';
    }
}


// -----------------------------------------------------------------------------
// SEÇÃO 4: EVENT LISTENERS
// -----------------------------------------------------------------------------

checkboxInicial.addEventListener('change', function () {
    inputInicial.disabled = !this.checked;
    if (!this.checked) {
        inputInicial.value = '';
    }
});

btnCalcularPreco.addEventListener('click', calcularPrecoViaBackend);

btnNovoQuadro.addEventListener('click', () => {
    // Validação de segurança que você sugeriu, garantindo que o quadro atual foi calculado
    const quadroAtual = quadrosDoPedido[quadroAtualIndex];
    if (temDadosQuadroPreenchidos(quadroAtual) && quadroAtual.valorCalculado === 0) {
        showCustomAlert('Atenção: Por favor, calcule o preço do quadro atual antes de criar um novo.');
        return;
    }
    if (!salvarQuadroAtual(true)) {
        if (!confirm('O quadro atual tem dados inválidos. Deseja descartá-lo para criar um novo quadro?')) {
            return;
        }
    }
    quadrosDoPedido.push({
        altura: 0, largura: 0, moldurasSelecionadas: [],
        materiaisSelecionados: [], espessuraPaspatur: 0,
        medidaFornecidaCliente: false, limpezaSelecionada: false, valorCalculado: 0
    });

    quadroAtualIndex = quadrosDoPedido.length - 1;

    limparFormularioQuadro();
    atualizarContadorQuadros();

    // Mostra a navegação se agora tivermos mais de um quadro
    if (quadrosDoPedido.length > 1) {
        navegacaoQuadrosContainer.classList.remove('d-none');
    }

    inputLarguraQuadro.focus();
});

btnCopiarQuadro.addEventListener('click', () => {
    // validação de segurança
    const quadroAtual = quadrosDoPedido[quadroAtualIndex];
    if (temDadosQuadroPreenchidos(getDadosQuadroAtual()) && quadroAtual && quadroAtual.valorCalculado === 0) {
        showCustomAlert('Atenção: Por favor, calcule o preço do quadro atual antes de copiá-lo.');
        return;
    }
    if (!temDadosQuadroPreenchidos(getDadosQuadroAtual())) {
        showCustomAlert('O quadro atual está vazio. Preencha para poder copiar.');
        return;
    }

    if (!salvarQuadroAtual(true)) {
        showCustomAlert('Não foi possível salvar o quadro atual. Verifique os dados.');
        return;
    }

    const quadroCopiado = JSON.parse(JSON.stringify(quadrosDoPedido[quadroAtualIndex]));
    quadrosDoPedido.push(quadroCopiado);
    quadroAtualIndex = quadrosDoPedido.length - 1;
    preencherFormularioQuadro(quadroCopiado);

    navegacaoQuadrosContainer.classList.remove('d-none');
    atualizarContadorQuadros();
    showCustomAlert(`Quadro copiado. Agora você está editando a cópia (Quadro ${quadroAtualIndex + 1}).`);
});

btnQuadroAnterior.addEventListener('click', () => {
    if (quadroAtualIndex > 0) {
        salvarQuadroAtual(true);
        quadroAtualIndex--;
        preencherFormularioQuadro(quadrosDoPedido[quadroAtualIndex]);
        atualizarContadorQuadros();
    }
});

btnQuadroProximo.addEventListener('click', () => {
    if (quadroAtualIndex < quadrosDoPedido.length - 1) {
        salvarQuadroAtual(true);
        quadroAtualIndex++;
        preencherFormularioQuadro(quadrosDoPedido[quadroAtualIndex]);
        atualizarContadorQuadros();
    }
});

chkEditarValorFinal.addEventListener('change', function () {
    if (this.checked) {
        valorFinalCalculadoGlobal = quadrosDoPedido.reduce((sum, quadro) => sum + (quadro.valorCalculado || 0), 0);
        inputValorFinalEditado.value = valorFinalCalculadoGlobal.toFixed(2);
        edicaoValorFinalContainer.classList.remove('d-none');
    } else {
        edicaoValorFinalContainer.classList.add('d-none');
    }
});

btnSalvarValorEditado.addEventListener('click', function () {
    const valorEditado = parseFloat(inputValorFinalEditado.value);
    if (isNaN(valorEditado) || valorEditado < 0) {
        showCustomAlert('Por favor, insira um valor final válido.');
        inputValorFinalEditado.value = valorFinalCalculadoGlobal.toFixed(2);
        return;
    }
    showCustomAlert(`Valor final para o PDF definido para R$ ${valorEditado.toFixed(2)}`);
});

// ------ LISTENER ÚNICO PARA O BOTÃO PRINCIPAL -------
btnFinalizarPedido.addEventListener('click', finalizarOuSalvarPedido);

// listener de inicialização da página
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const idParaEditar = urlParams.get('editPedidoId');
    carregarMolduras();
    if (idParaEditar) {
        modoEdicao = true;
        pedidoEditadoId = idParaEditar;
        carregarPedidoParaEdicao(idParaEditar);
    } else {
        modoEdicao = false;
        resetarFormularioCompleto(true);
        navegacaoQuadrosContainer.classList.add('d-none');
    }
   chkPaspatur.addEventListener('change', function () {

    paspaturOpcoes.classList.toggle('d-none', !this.checked);
    inputEspessura.classList.toggle('d-none', !this.checked);

    if (this.checked) {
        inputEspessura.focus();
    } else {
        inputEspessura.value = '';
    }
    marcarQuadroComoNaoCalculado();
});


    const inputsQueAfetamPreco = [
        inputLarguraQuadro, inputAlturaQuadro,
        chkFundo, chkSarrafo, chkVidro, chkSegundoVidro, chkPaspatur,
        chkLimpeza, inputEspessura, checkboxInicial, inputInicial
    ];

    inputsQueAfetamPreco.forEach(input => {
        input.addEventListener('input', marcarQuadroComoNaoCalculado);
    });

    btnAdicionarNovaMoldura.addEventListener('click', () => {
        adicionarLinhaMolduraDinamica();
        marcarQuadroComoNaoCalculado();
    });
});