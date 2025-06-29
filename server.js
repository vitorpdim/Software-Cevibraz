// -----------------------------------------------------------------------------
// SEÇÃO 1: IMPORTAÇÕES E CONFIGURAÇÃO INICIAL
// -----------------------------------------------------------------------------
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');

const { generateOrderPdf } = require('./utils/pdfGenerator'); // Apenas a função principal
const { generateOsPdf } = require('./utils/generateOsPdf');   // Apenas a função principal
const { calcularPrecoQuadro } = require('./utils/calculos');


const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// -----------------------------------------------------------------------------
// SEÇÃO 2: CONFIGURAÇÃO DO BANCO DE DADOS (COM POOL)
// -----------------------------------------------------------------------------
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // Sua senha
    database: 'orcamento_quadros_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// pool de Conexões
const pool = mysql.createPool(dbConfig);


// -----------------------------------------------------------------------------
// SEÇÃO 3: ROTAS DA API
// -----------------------------------------------------------------------------

// ---- ROTA PARA BUSCAR MOLDURAS ----
app.get('/api/molduras', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, codigo, nome, valor_metro_linear FROM Molduras');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar molduras:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar molduras.' });
    }
});

// ---- ROTA PARA BUSCAR MATERIAIS ----
app.get('/api/materiais', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, nome, tipo_calculo, valor_base FROM Materiais');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar materiais:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar materiais.' });
    }
});

// ---- ROTA PARA CALCULAR PREÇO DE UM QUADRO ----
app.post('/api/quadro/calcular', async (req, res) => {
    const { altura, largura, moldurasSelecionadas, materiaisSelecionados, espessuraPaspatur, limpezaSelecionada } = req.body;
    const alturaNum = parseFloat(altura);
    const larguraNum = parseFloat(largura);
    if (isNaN(alturaNum) || alturaNum <= 0 || isNaN(larguraNum) || larguraNum <= 0) {
        return res.status(400).json({ message: 'Altura e largura devem ser números positivos.' });
    }
    try {
        // Passa o 'pool' para a função. A função auxiliar deve ser capaz de lidar com isso.
        const resultado = await calcularPrecoQuadro(alturaNum, larguraNum, moldurasSelecionadas || [], materiaisSelecionados || [], parseFloat(espessuraPaspatur) || 0, limpezaSelecionada, pool);
        res.json(resultado);
    } catch (error) {
        console.error('Erro no cálculo do quadro:', error);
        res.status(500).json({ message: 'Erro ao calcular o preço do quadro.', error: error.message });
    }
});

// ---- ROTA PARA BUSCAR TODOS OS PEDIDOS (BACKLOG) ----
app.get('/api/pedidos', async (req, res) => {
    try {
        const [pedidos] = await pool.execute(`
            SELECT p.id, p.numero_pedido, p.atendente, p.data_criacao, p.status, p.valor_final, c.nome as cliente_nome, p.pdf_filename, p.pdf_os_filename 
            FROM Pedidos p LEFT JOIN Clientes c ON p.cliente_id = c.id ORDER BY p.id DESC`);
        res.json(pedidos);
    } catch (error) {
        console.error('Erro ao buscar pedidos para backlog:', error);
        res.status(500).json({ message: 'Erro ao buscar pedidos.' });
    }
});

// ---- ROTA PARA CRIAR UM NOVO PEDIDO ----
app.post('/api/pedidos', async (req, res) => {
    const { nomeAtendente, nomeCliente, telefoneCliente, observacoes, quadros, valor_final_calculado } = req.body;
    if (!quadros || !Array.isArray(quadros) || quadros.length === 0) return res.status(400).json({ message: 'Nenhum quadro válido fornecido.' });
    if (!nomeAtendente || !nomeCliente) return res.status(400).json({ message: 'Nome do atendente e cliente são obrigatórios.' });

    let conn = null;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        let clienteId;
        const [existingCliente] = await conn.execute('SELECT id, telefone FROM Clientes WHERE nome = ?', [nomeCliente]);
        if (existingCliente.length > 0) {
            clienteId = existingCliente[0].id;
            if (telefoneCliente && (!existingCliente[0].telefone || existingCliente[0].telefone !== telefoneCliente)) {
                await conn.execute('UPDATE Clientes SET telefone = ? WHERE id = ?', [telefoneCliente, clienteId]);
            }
        } else {
            const [newClienteResult] = await conn.execute('INSERT INTO Clientes (nome, telefone) VALUES (?, ?)', [nomeCliente, telefoneCliente]);
            clienteId = newClienteResult.insertId;
        }

        const [lastPedido] = await conn.execute('SELECT MAX(CAST(numero_pedido AS UNSIGNED)) as max_num FROM Pedidos');
        const proximoNumero = (lastPedido[0].max_num || 0) + 1;
        const numeroPedidoFormatado = String(proximoNumero).padStart(4, '0');

        const [pedidoResult] = await conn.execute(`INSERT INTO Pedidos (numero_pedido, cliente_id, atendente, observacoes, valor_final, status) VALUES (?, ?, ?, ?, ?, ?)`, [numeroPedidoFormatado, clienteId, nomeAtendente, observacoes, parseFloat(valor_final_calculado).toFixed(2), 'A Fazer']);
        const pedidoId = pedidoResult.insertId;

        const quadrosParaPdf = [];
        for (const quadroData of quadros) {
            const alturaQuadro = parseFloat(quadroData.altura), larguraQuadro = parseFloat(quadroData.largura);
            if (isNaN(alturaQuadro) || alturaQuadro <= 0 || isNaN(larguraQuadro) || larguraQuadro <= 0) throw new Error(`Dados de quadro inválidos no pedido.`);

            // Passa a conexão da transação ('conn') para a função de cálculo
            const resultadoCalculoQuadro = await calcularPrecoQuadro(alturaQuadro, larguraQuadro, quadroData.moldurasSelecionadas, quadroData.materiaisSelecionados, quadroData.espessuraPaspatur, quadroData.limpezaSelecionada, conn);

            const [quadroResultInsert] = await conn.execute(`INSERT INTO Quadros (pedido_id, altura_cm, largura_cm, medida_fornecida_cliente, limpeza_flag) VALUES (?, ?, ?, ?, ?)`, [pedidoId, alturaQuadro, larguraQuadro, quadroData.medidaFornecidaCliente, quadroData.limpezaSelecionada]);
            const quadroId = quadroResultInsert.insertId;

            const [moldurasSalvas, materiaisSalvos] = await Promise.all([
                Promise.all((quadroData.moldurasSelecionadas || []).map(async (nome) => {
                    const [dbRow] = await conn.execute('SELECT id, codigo, nome FROM Molduras WHERE nome = ? OR codigo = ?', [nome, nome]);
                    if (dbRow[0]) {
                        await conn.execute(`INSERT INTO Quadro_Molduras (quadro_id, moldura_id) VALUES (?, ?)`, [quadroId, dbRow[0].id]);
                        return { nome: dbRow[0].nome, codigo: dbRow[0].codigo };
                    }
                    return null;
                })),
                Promise.all((quadroData.materiaisSelecionados || []).map(async (nome) => {
                    const [dbRow] = await conn.execute('SELECT id, nome FROM Materiais WHERE nome = ?', [nome]);
                    if (dbRow[0]) {
                        const esp = nome.toLowerCase() === 'paspatur' ? parseFloat(quadroData.espessuraPaspatur) || 0 : null;
                        await conn.execute(`INSERT INTO Quadro_Materiais (quadro_id, material_id, espessura_paspatur_cm) VALUES (?, ?, ?)`, [quadroId, dbRow[0].id, esp]);
                        return { nome: dbRow[0].nome, espessura_paspatur_cm: esp };
                    }
                    return null;
                }))
            ]);
            quadrosParaPdf.push({ ...quadroData, id: quadroId, altura_cm: alturaQuadro, largura_cm: larguraQuadro, molduras: moldurasSalvas.filter(Boolean), materiais: materiaisSalvos.filter(Boolean), detalhesCalculo: resultadoCalculoQuadro });
        }

        const dadosPedidoCompleto = { id: pedidoId, numero_pedido: numeroPedidoFormatado, atendente: nomeAtendente, data_criacao: new Date(), cliente_nome: nomeCliente, cliente_telefone: telefoneCliente, observacoes: observacoes, valor_final: parseFloat(valor_final_calculado).toFixed(2) };
        const quadrosAgrupados = agruparQuadrosParaPDF(quadrosParaPdf);

        const pdfOsBuffer = await generateOsPdf(dadosPedidoCompleto, quadrosAgrupados);
        const pdfOsFilename = `os_${numeroPedidoFormatado}.pdf`;
        const pdfPedidoBuffer = await generateOrderPdf(dadosPedidoCompleto, quadrosAgrupados);
        const pdfPedidoFilename = `pedido_${numeroPedidoFormatado}.pdf`;

        // CORREÇÃO: Usar 'conn' que é a conexão da transação, não 'pool' ou 'connection'
        await conn.execute(`UPDATE Pedidos SET pdf_blob = ?, pdf_filename = ?, pdf_os_blob = ?, pdf_os_filename = ? WHERE id = ?`, [pdfPedidoBuffer, pdfPedidoFilename, pdfOsBuffer, pdfOsFilename, pedidoId]);

        await conn.commit();
        res.status(201).json({ message: 'Pedido e OS salvos com sucesso!', pedidoId: pedidoId, numeroPedido: numeroPedidoFormatado, valorTotal: parseFloat(valor_final_calculado).toFixed(2) });
    } catch (error) {
        if (conn) await conn.rollback();
        // Log aprimorado para diagnóstico remoto
        console.error('--- ERRO DETALHADO AO SALVAR PEDIDO ---');
        console.error('Data e Hora:', new Date().toISOString());
        console.error('Mensagem do Erro:', error.message);
        console.error('Stack Trace do Erro:', error.stack);
        console.error('------------------------------------');
        res.status(500).json({ message: 'Erro interno do servidor ao salvar pedido e OS.', error: error.message });
    } finally {
        if (conn) conn.release();
    }
});

// ---- ROTA PARA BUSCAR UM PEDIDO COMPLETO (EDIÇÃO) ----
app.get('/api/pedidos/:id', async (req, res) => {
    const pedidoId = req.params.id;
    let conn = null;
    try {
        conn = await pool.getConnection();
        const [pedidoRows] = await conn.execute(`SELECT p.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone FROM Pedidos p LEFT JOIN Clientes c ON p.cliente_id = c.id WHERE p.id = ?`, [pedidoId]);
        if (pedidoRows.length === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        const pedido = pedidoRows[0];
        const [quadrosRows] = await conn.execute('SELECT * FROM Quadros WHERE pedido_id = ? ORDER BY id ASC', [pedidoId]);

        // CORREÇÃO IMPORTANTE: Agora vamos calcular o valor de cada quadro e incluí-lo na resposta
        const quadrosCompletos = await Promise.all(quadrosRows.map(async (quadro) => {
            const [molduras] = await conn.execute('SELECT m.nome FROM Quadro_Molduras qm JOIN Molduras m ON qm.moldura_id = m.id WHERE qm.quadro_id = ?', [quadro.id]);
            const [materiais] = await conn.execute('SELECT mat.nome, qm.espessura_paspatur_cm FROM Quadro_Materiais qm JOIN Materiais mat ON qm.material_id = mat.id WHERE qm.quadro_id = ?', [quadro.id]);

            const moldurasNomes = molduras.map(m => m.nome);
            const materiaisNomes = materiais.map(m => m.nome);
            const paspatur = materiais.find(m => m.nome.toLowerCase() === 'paspatur');
            const espessuraPaspatur = paspatur ? paspatur.espessura_paspatur_cm : 0;

            // Recalcula o preço do quadro com os dados do banco
            const resultadoCalculo = await calcularPrecoQuadro(
                quadro.altura_cm,
                quadro.largura_cm,
                moldurasNomes,
                materiaisNomes,
                espessuraPaspatur,
                !!quadro.limpeza_flag,
                conn // Usa a conexão da transação
            );

            return {
                altura: quadro.altura_cm,
                largura: quadro.largura_cm,
                medidaFornecidaCliente: !!quadro.medida_fornecida_cliente,
                limpezaSelecionada: !!quadro.limpeza_flag,
                moldurasSelecionadas: moldurasNomes,
                materiaisSelecionados: materiaisNomes,
                espessuraPaspatur: espessuraPaspatur,
                valorCalculado: resultadoCalculo.total // AQUI ESTÁ A MÁGICA!
            };
        }));

        const respostaCompleta = {
            atendente: pedido.atendente,
            clienteNome: pedido.cliente_nome,
            clienteTelefone: pedido.cliente_telefone,
            observacoes: pedido.observacoes,
            quadros: quadrosCompletos // Agora os quadros vêm com seus valores calculados
        };

        res.json(respostaCompleta);

    } catch (error) {
        console.error(`Erro ao buscar detalhes do pedido ${pedidoId}:`, error);
        res.status(500).json({ message: 'Erro ao buscar detalhes do pedido.' });
    } finally {
        if (conn) conn.release();
    }
});

// ---- ROTA PARA ATUALIZAR UM PEDIDO EXISTENTE ----
app.put('/api/pedidos/:id', async (req, res) => {
    const pedidoId = req.params.id;
    const { observacoes, quadros, valor_final_calculado } = req.body;
    if (!quadros || !Array.isArray(quadros) || quadros.length === 0) return res.status(400).json({ message: 'O pedido precisa ter pelo menos um quadro válido.' });

    let conn = null;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();
        await conn.execute('DELETE FROM Quadros WHERE pedido_id = ?', [pedidoId]);

        const quadrosParaPdf = [];
        for (const quadroData of quadros) {
            const alturaQuadro = parseFloat(quadroData.altura), larguraQuadro = parseFloat(quadroData.largura);
            if (isNaN(alturaQuadro) || alturaQuadro <= 0 || isNaN(larguraQuadro) || larguraQuadro <= 0) throw new Error('Dados de quadro inválidos ao atualizar.');
            const resultadoCalculoQuadro = await calcularPrecoQuadro(alturaQuadro, larguraQuadro, quadroData.moldurasSelecionadas, quadroData.materiaisSelecionados, quadroData.espessuraPaspatur, quadroData.limpezaSelecionada, conn);
            const [quadroResult] = await conn.execute(`INSERT INTO Quadros (pedido_id, altura_cm, largura_cm, medida_fornecida_cliente, limpeza_flag) VALUES (?, ?, ?, ?, ?)`, [pedidoId, alturaQuadro, larguraQuadro, quadroData.medidaFornecidaCliente, quadroData.limpezaSelecionada]);
            const quadroId = quadroResult.insertId;
            const [moldurasSalvas, materiaisSalvos] = await Promise.all([
                Promise.all((quadroData.moldurasSelecionadas || []).map(async (nome) => {
                    const [dbRow] = await conn.execute('SELECT id, codigo, nome FROM Molduras WHERE nome = ? OR codigo = ?', [nome, nome]);
                    if (dbRow[0]) {
                        await conn.execute(`INSERT INTO Quadro_Molduras (quadro_id, moldura_id) VALUES (?, ?)`, [quadroId, dbRow[0].id]);
                        return { nome: dbRow[0].nome, codigo: dbRow[0].codigo };
                    }
                    return null;
                })),
                Promise.all((quadroData.materiaisSelecionados || []).map(async (nome) => {
                    const [dbRow] = await conn.execute('SELECT id, nome FROM Materiais WHERE nome = ?', [nome]);
                    if (dbRow[0]) {
                        const esp = nome.toLowerCase() === 'paspatur' ? parseFloat(quadroData.espessuraPaspatur) || 0 : null;
                        await conn.execute(`INSERT INTO Quadro_Materiais (quadro_id, material_id, espessura_paspatur_cm) VALUES (?, ?, ?)`, [quadroId, dbRow[0].id, esp]);
                        return { nome: dbRow[0].nome, espessura_paspatur_cm: esp };
                    }
                    return null;
                }))
            ]);
            quadrosParaPdf.push({ ...quadroData, id: quadroId, altura_cm: alturaQuadro, largura_cm: larguraQuadro, molduras: moldurasSalvas.filter(Boolean), materiais: materiaisSalvos.filter(Boolean), detalhesCalculo: resultadoCalculoQuadro });
        }

        await conn.execute('UPDATE Pedidos SET observacoes = ?, valor_final = ? WHERE id = ?', [observacoes, parseFloat(valor_final_calculado).toFixed(2), pedidoId]);

        const [pedidoRows] = await conn.execute(`SELECT p.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone FROM Pedidos p LEFT JOIN Clientes c ON p.cliente_id = c.id WHERE p.id = ?`, [pedidoId]);
        const dadosPedidoCompleto = { ...pedidoRows[0], valor_final: parseFloat(valor_final_calculado).toFixed(2) };
        const quadrosAgrupados = agruparQuadrosParaPDF(quadrosParaPdf);

        const pdfPedidoBuffer = await generateOrderPdf(dadosPedidoCompleto, quadrosAgrupados);
        const pdfPedidoFilename = `pedido_${dadosPedidoCompleto.numero_pedido}.pdf`;
        const pdfOsBuffer = await generateOsPdf(dadosPedidoCompleto, quadrosAgrupados);
        const pdfOsFilename = `os_${dadosPedidoCompleto.numero_pedido}.pdf`;
        await conn.execute(`UPDATE Pedidos SET pdf_blob = ?, pdf_filename = ?, pdf_os_blob = ?, pdf_os_filename = ? WHERE id = ?`, [pdfPedidoBuffer, pdfPedidoFilename, pdfOsBuffer, pdfOsFilename, pedidoId]);

        await conn.commit();
        res.json({ message: `Pedido ${dadosPedidoCompleto.numero_pedido} atualizado com sucesso!` });
    } catch (error) {
        if (conn) await conn.rollback();
        console.error(`Erro ao atualizar pedido ${pedidoId}:`, error);
        res.status(500).json({ message: 'Erro ao atualizar pedido.' });
    } finally {
        if (conn) conn.release();
    }
});

// ---- ROTA PARA DOWNLOAD DO PDF DO PEDIDO ----
app.get('/api/pedidos/:id/pdf', async (req, res) => {
    const pedidoId = req.params.id;
    const valorEditado = req.query.valor_editado;
    let conn = null;
    try {
        conn = await pool.getConnection();
        const [pedidoRows] = await conn.execute(`SELECT p.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone FROM Pedidos p LEFT JOIN Clientes c ON p.cliente_id = c.id WHERE p.id = ?`, [pedidoId]);
        if (pedidoRows.length === 0) return res.status(404).json({ message: 'Pedido não encontrado.' });

        const pedidoDoBanco = pedidoRows[0];
        const pdfBlob = pedidoDoBanco.pdf_blob;

        // Se o PDF já foi salvo e não há valor editado, apenas envia o blob do banco
        if (pdfBlob && !valorEditado) {
            const pdfFilename = pedidoDoBanco.pdf_filename || `pedido_${pedidoDoBanco.numero_pedido}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${pdfFilename}`);
            return res.send(pdfBlob);
        }

        // Se não tem blob ou se há um valor editado, gera o PDF sob demanda
        const dadosParaPdf = { ...pedidoDoBanco, valor_final: valorEditado ? parseFloat(valorEditado).toFixed(2) : parseFloat(pedidoDoBanco.valor_final).toFixed(2) };
        const [quadrosRows] = await conn.execute('SELECT id, altura_cm, largura_cm, medida_fornecida_cliente, limpeza_flag FROM Quadros WHERE pedido_id = ?', [pedidoId]);
        const quadrosComDetalhesParaPdf = await Promise.all(quadrosRows.map(async (q) => {
            const [moldurasDoQuadro] = await conn.execute(`SELECT m.nome, m.codigo FROM Quadro_Molduras qm JOIN Molduras m ON qm.moldura_id = m.id WHERE qm.quadro_id = ?`, [q.id]);
            const [materiaisDoQuadro] = await conn.execute(`SELECT mat.nome, qmt.espessura_paspatur_cm FROM Quadro_Materiais qmt JOIN Materiais mat ON qmt.material_id = mat.id WHERE qmt.quadro_id = ?`, [q.id]);
            const moldurasParaCalculo = moldurasDoQuadro.map(m => m.nome);
            const materiaisParaCalculo = materiaisDoQuadro.map(m => m.nome);
            const paspaturEsp = materiaisDoQuadro.find(m => m.nome.toLowerCase() === 'paspatur')?.espessura_paspatur_cm || 0;
            const calculoDet = await calcularPrecoQuadro(q.altura_cm, q.largura_cm, moldurasParaCalculo, materiaisParaCalculo, paspaturEsp, q.limpeza_flag, conn);
            return { ...q, molduras: moldurasDoQuadro, materiais: materiaisDoQuadro, detalhesCalculo: calculoDet };
        }));
        const quadrosAgrupados = agruparQuadrosParaPDF(quadrosComDetalhesParaPdf);
        const pdfBuffer = await generateOrderPdf(dadosParaPdf, quadrosAgrupados);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=pedido_${pedidoDoBanco.numero_pedido}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error(`Erro na rota GET /api/pedidos/${pedidoId}/pdf:`, error);
        res.status(500).json({ message: 'Erro ao gerar o PDF do pedido.' });
    } finally {
        if (conn) conn.release();
    }
});

// ---- ROTA PARA DOWNLOAD DO PDF DA OS ----
app.get('/api/pedidos/:id/os/pdf', async (req, res) => {
    const pedidoId = req.params.id;
    try {
        const [rows] = await pool.execute('SELECT pdf_os_blob, pdf_os_filename FROM Pedidos WHERE id = ?', [pedidoId]);
        if (rows.length === 0 || !rows[0].pdf_os_blob) return res.status(404).json({ message: 'PDF da OS não encontrado.' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${rows[0].pdf_os_filename || `os_${pedidoId}.pdf`}`);
        res.send(rows[0].pdf_os_blob);
    } catch (error) {
        console.error(`Erro ao buscar PDF da OS ${pedidoId}:`, error);
        res.status(500).json({ message: 'Erro ao buscar PDF da OS.' });
    }
});

// ---- ROTA PARA ATUALIZAR STATUS ----
app.put('/api/pedidos/:id/status', async (req, res) => {
    const pedidoId = req.params.id;
    const { status } = req.body;
    if (!status || !['A Fazer', 'Já Feito', 'Entregue'].includes(status)) return res.status(400).json({ message: 'Status inválido fornecido.' });

    try {
        const [result] = await pool.execute('UPDATE Pedidos SET status = ? WHERE id = ?', [status, pedidoId]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Pedido não encontrado.' });
        res.json({ message: `Status do pedido atualizado com sucesso.` });
    } catch (error) {
        console.error(`Erro ao atualizar status do pedido ${pedidoId}:`, error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// ---- ROTA PRA DELETAR PEDIDO ----
app.delete('/api/pedidos/:id', async (req, res) => {
    const pedidoId = req.params.id;
    try {
        const [result] = await pool.execute('DELETE FROM Pedidos WHERE id = ?', [pedidoId]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Pedido não encontrado.' });
        res.json({ message: `Pedido ${pedidoId} excluído com sucesso.` });
    } catch (error) {
        console.error(`Erro ao excluir pedido ${pedidoId}:`, error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// -----------------------------------------------------------------------------
// SEÇÃO 4: FUNÇÕES AUXILIARES
// -----------------------------------------------------------------------------
function agruparQuadrosParaPDF(quadrosComDetalhes) {
    const grupos = {};
    quadrosComDetalhes.forEach(quadro => {
        const moldurasOrdenadas = (quadro.molduras || []).map(m => m.nome || m.codigo).sort().join(',');
        const materiaisOrdenados = (quadro.materiais || []).map(m => `${m.nome}${m.nome.toLowerCase() === 'paspatur' && m.espessura_paspatur_cm ? `-${m.espessura_paspatur_cm}` : ''}`).sort().join(',');
        const chave = [quadro.altura_cm, quadro.largura_cm, moldurasOrdenadas, materiaisOrdenados, quadro.medida_fornecida_cliente, quadro.limpeza_flag].join('|');
        if (grupos[chave]) {
            grupos[chave].quantidade++;
        } else {
            grupos[chave] = { quantidade: 1, detalhes: quadro };
        }
    });
    return Object.values(grupos);
}

// -----------------------------------------------------------------------------
// SEÇÃO 5: INICIALIZAÇÃO DO SERVIDOR
// -----------------------------------------------------------------------------
app.listen(port, () => {
    console.log(`Servidor backend rodando em http://localhost:${port}`);
    console.log('Para encerrar o servidor, pressione Ctrl+C');
});