// backlog.js (COMPLETO E ATUALIZADO)

let allPedidos = []; // Armazena todos os pedidos buscados do backend
let currentOpenDropdown = null;
let currentPedidoIdForStatusChange = null;
let currentPedidoStatus = null;

// URL base da sua API. Se estiver testando remotamente, troque 'localhost' pelo IP.
const API_URL = 'http://localhost:3000/api';

// --- Funções de Comunicação com a API ---

async function fetchPedidos() {
    try {
        const response = await fetch(`${API_URL}/pedidos`);
        if (!response.ok) {
            throw new Error(`Erro HTTP! status: ${response.status}`);
        }
        allPedidos = await response.json();
        renderPedidos(allPedidos);
    } catch (error) {
        console.error("Erro ao buscar pedidos:", error);
        const errorMessage = '<tr><td colspan="6">Erro ao carregar pedidos. Verifique se o servidor está rodando.</td></tr>';
        document.getElementById('pedidos-a-fazer').innerHTML = errorMessage;
        document.getElementById('pedidos-ja-feito').innerHTML = errorMessage;
        document.getElementById('pedidos-entregue').innerHTML = errorMessage;
    }
}

async function changePedidoStatus(pedidoId, newStatus) {
    try {
        const response = await fetch(`${API_URL}/pedidos/${pedidoId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const responseText = await response.text(); // Lê como texto primeiro
        if (!response.ok) {
            try {
                const errorResult = JSON.parse(responseText);
                throw new Error(errorResult.message || 'Erro ao atualizar status.');
            } catch (e) {
                throw new Error(`Erro ao atualizar status. Servidor respondeu: ${responseText}`);
            }
        }
        
        // Atualiza a lista local e re-renderiza para refletir a mudança
        const pedidoToUpdate = allPedidos.find(p => p.id === pedidoId);
        if (pedidoToUpdate) {
            pedidoToUpdate.status = newStatus;
        }
        renderPedidos(allPedidos);
        
        if (document.getElementById('statusChangeModal').classList.contains('show')) {
            closeStatusModal();
        }
        alert('Status do pedido atualizado com sucesso!');
    } catch (error) {
        console.error(`Erro ao alterar status do pedido ${pedidoId} para ${newStatus}:`, error);
        alert(`Falha ao atualizar status: ${error.message}`);
    }
}

async function deletePedido(id) {
    const numeroPedido = document.querySelector(`.action-dots[data-pedido-id="${id}"]`).dataset.pedidoNum;
    if (!confirm(`Tem certeza que deseja excluir o pedido ${numeroPedido}?`)) {
        return;
    }
    try {
        const response = await fetch(`${API_URL}/pedidos/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.message || 'Erro ao excluir pedido.');
        }
        
        allPedidos = allPedidos.filter(p => p.id !== id);
        renderPedidos(allPedidos);
        alert('Pedido excluído com sucesso!');
    } catch (error) {
        console.error(`Erro ao excluir pedido ${id}:`, error);
        alert(`Falha ao excluir pedido: ${error.message}`);
    }
    closeDropdowns();
}

// --- Funções de Renderização e UI ---

function renderPedidos(pedidos) {
    const tbodyAFazer = document.getElementById('pedidos-a-fazer');
    const tbodyJaFeito = document.getElementById('pedidos-ja-feito');
    const tbodyEntregue = document.getElementById('pedidos-entregue');

    tbodyAFazer.innerHTML = '';
    tbodyJaFeito.innerHTML = '';
    tbodyEntregue.innerHTML = '';

    // Ordena os pedidos por número (menor para o maior)
    pedidos.sort((a, b) => parseInt(a.numero_pedido) - parseInt(b.numero_pedido));

    pedidos.forEach(pedido => {
        const pdfPedidoLink = pedido.pdf_filename 
            ? `<a href="${API_URL}/pedidos/${pedido.id}/pdf" target="_blank" class="btn btn-sm btn-outline-primary">Pedido ${pedido.numero_pedido}</a>` 
            : 'PDF Indisponível';
        
        const pdfOsLink = pedido.pdf_os_filename 
            ? `<a href="${API_URL}/pedidos/${pedido.id}/os/pdf" target="_blank" class="btn btn-sm btn-outline-secondary">OS ${pedido.numero_pedido}</a>`
            : 'OS Indisponível';
        
        // Lógica para criar o botão de avançar status
        let proximoStatus = '';
        let podeAvancar = false;
        if (pedido.status === 'A Fazer') {
            proximoStatus = 'Já Feito';
            podeAvancar = true;
        } else if (pedido.status === 'Já Feito') {
            proximoStatus = 'Entregue';
            podeAvancar = true;
        }

        const btnAvancarHtml = podeAvancar 
            ? `<button class="btn btn-sm btn-success btn-avancar-status" 
                        data-pedido-id="${pedido.id}" 
                        data-next-status="${proximoStatus}"
                        title="Mover para '${proximoStatus}'">
                    &rarr;
               </button>`
            : `<span class="text-muted">-</span>`;

        const rowHtml = `
            <tr>
                <td>${pedido.cliente_nome || 'N/A'}</td>
                <td>${pedido.numero_pedido}</td>
                <td>${pdfPedidoLink}</td>
                <td>${pdfOsLink}</td>
                <td>${btnAvancarHtml}</td>
                <td class="action-cell">
                    <span class="action-dots" data-pedido-id="${pedido.id}" data-pedido-status="${pedido.status}" data-pedido-num="${pedido.numero_pedido}" onclick="toggleDropdown(this)">&#8942;</span>
                    <div class="dropdown-menu" id="dropdown-${pedido.id}">
                        <button onclick="openStatusModal(${pedido.id}, '${pedido.status}', '${pedido.numero_pedido}')">Mudar Status</button>
                        <button onclick="editPedido(${pedido.id})">Editar</button>
                        <button onclick="deletePedido(${pedido.id})">Excluir</button>
                    </div>
                </td>
            </tr>
        `;

        if (pedido.status === 'A Fazer') {
            tbodyAFazer.innerHTML += rowHtml;
        } else if (pedido.status === 'Já Feito') {
            tbodyJaFeito.innerHTML += rowHtml;
        } else if (pedido.status === 'Entregue') {
            tbodyEntregue.innerHTML += rowHtml;
        }
    });

    // Adiciona os event listeners para os novos botões
    addEventListenersAvançarStatus();
}

function addEventListenersAvançarStatus() {
    document.querySelectorAll('.btn-avancar-status').forEach(button => {
        // Para evitar listeners duplicados, removemos antes de adicionar
        button.replaceWith(button.cloneNode(true));
    });
    // Adiciona o listener aos novos botões clonados
    document.querySelectorAll('.btn-avancar-status').forEach(button => {
        button.addEventListener('click', handleAvancarStatusClick);
    });
}

function handleAvancarStatusClick(event) {
    const button = event.currentTarget;
    const pedidoId = button.dataset.pedidoId;
    const nextStatus = button.dataset.nextStatus;
    const numeroPedido = button.closest('tr').querySelector('.action-dots').dataset.pedidoNum;

    if (nextStatus) {
        if (confirm(`Mover pedido ${numeroPedido} para "${nextStatus}"?`)) {
            changePedidoStatus(parseInt(pedidoId), nextStatus);
        }
    }
}

function toggleDropdown(element) {
    const dropdown = element.nextElementSibling;
    if (currentOpenDropdown && currentOpenDropdown !== dropdown) {
        currentOpenDropdown.classList.remove('show');
    }
    dropdown.classList.toggle('show');
    currentOpenDropdown = dropdown.classList.contains('show') ? dropdown : null;
}

document.addEventListener('click', function (event) {
    if (currentOpenDropdown && !event.target.closest('.action-cell')) {
        currentOpenDropdown.classList.remove('show');
        currentOpenDropdown = null;
    }
});

function openStatusModal(pedidoId, status, numeroPedido) {
    closeDropdowns();
    currentPedidoIdForStatusChange = pedidoId;
    currentPedidoStatus = status;
    document.getElementById('modalPedidoNum').textContent = numeroPedido;

    const statusOptionsContainer = document.getElementById('statusOptionsContainer');
    statusOptionsContainer.innerHTML = ''; 

    const statuses = ['A Fazer', 'Já Feito', 'Entregue'];
    statuses.forEach(s => {
        const optionDiv = document.createElement('div');
        optionDiv.classList.add('status-option');
        optionDiv.dataset.status = s;
        optionDiv.textContent = s;
        if (s === status) {
            optionDiv.classList.add('current-status');
        } else {
            optionDiv.onclick = () => changePedidoStatus(currentPedidoIdForStatusChange, s);
        }
        statusOptionsContainer.appendChild(optionDiv);
    });

    document.getElementById('statusChangeModal').classList.add('show');
}

function closeStatusModal() {
    document.getElementById('statusChangeModal').classList.remove('show');
    currentPedidoIdForStatusChange = null;
    currentPedidoStatus = null;
}

function editPedido(id) {
    console.log('Redirecionando para editar pedido:', id);
    // Redireciona para a página principal, passando o ID do pedido como parâmetro na URL
    window.location.href = `../index.html?editPedidoId=${id}`;
}

function closeDropdowns() {
    if (currentOpenDropdown) {
        currentOpenDropdown.classList.remove('show');
        currentOpenDropdown = null;
    }
}

document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(button.dataset.tab).classList.add('active');
    });
});

document.addEventListener('DOMContentLoaded', () => {
    fetchPedidos(); // Busca os pedidos do backend ao carregar
});