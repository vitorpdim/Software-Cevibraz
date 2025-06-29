// RF01 - Arredondamento automático para múltiplos de 5 cm (sempre para cima)
function arredondarParaCinco(medida) {
    return Math.ceil(medida / 5) * 5;
}

// Converte cm para metro (para cálculos de metro linear/quadrado)
function cmParaMetro(valorCm) {
    return valorCm / 100;
}

// RF01 - Metro linear: (altura + altura + largura + largura)
function calcularMetroLinear(alturaCm, larguraCm) {
    // Note: This function itself calls arredondarParaCinco,
    // but the inputs alturaCm and larguraCm to this function
    // must already be the rounded values from the main quadro dimensions.
    const alturaArredondada = arredondarParaCinco(alturaCm); // This inner call might be redundant if alturaCm is already rounded.
    const larguraArredondada = arredondarParaCinco(larguraCm); // Same here.
    return (alturaArredondada + alturaArredondada + larguraArredondada + larguraArredondada) / 100;
}

// RF01 - Metro quadrado: (altura × largura)
function calcularMetroQuadrado(alturaCm, larguraCm) {
    // Note: Similar to calcularMetroLinear, inputs should ideally already be rounded.
    const alturaArredondada = arredondarParaCinco(alturaCm); // Redundant if already rounded.
    const larguraArredondada = arredondarParaCinco(larguraCm); // Redundant if already rounded.
    return (alturaArredondada * larguraArredondada) / 10000;
}

// RF01 - Paspatur: (altura + 2 × espessura) × (largura + 2 × espessura), com mínimo de 2 cm
function calcularAreaPaspatur(alturaCm, larguraCm, espessuraPaspaturCm) {
    const espessuraReal = Math.max(espessuraPaspaturCm, 2);
    const alturaComPaspaturCm = alturaCm + (2 * espessuraReal);
    const larguraComPaspaturCm = larguraCm + (2 * espessuraReal);
    // This calls calcularMetroQuadrado, so it will re-round.
    // It's better to pass already rounded dimensions to this function too.
    return calcularMetroQuadrado(alturaComPaspaturCm, larguraComPaspaturCm);
}


async function calcularPrecoQuadro(altura_cm, largura_cm, moldurasSelecionadas, materiaisSelecionados, espessuraPaspaturCm, limpezaSelecionada, db) {
    let valorTotal = 0;
    const detalhes = [];

    const getMaterialPrice = async (nome) => {
        const [rows] = await db.execute('SELECT valor_base FROM Materiais WHERE nome = ?', [nome]);
        return rows.length > 0 ? parseFloat(rows[0].valor_base) : 0;
    };

    // PRIMEIRO PASSO: Arredondar as dimensões originais do quadro
    const alturaArredondadaQuadro = arredondarParaCinco(altura_cm);
    const larguraArredondadaQuadro = arredondarParaCinco(largura_cm);

    const temPaspatur = materiaisSelecionados.includes('Paspatur') && espessuraPaspaturCm > 0;

    // Use as dimensões arredondadas para todos os cálculos subsequentes
    const alturaInterna_m = cmParaMetro(alturaArredondadaQuadro);
    const larguraInterna_m = cmParaMetro(larguraArredondadaQuadro);
    const perimetroInterno_m = (alturaInterna_m + larguraInterna_m) * 2;

    // Para a altura e largura externa, que podem ser afetadas pelo paspatur
    const alturaExterna_cm_base = temPaspatur ? alturaArredondadaQuadro + (2 * Math.max(espessuraPaspaturCm, 2)) : alturaArredondadaQuadro;
    const larguraExterna_cm_base = temPaspatur ? larguraArredondadaQuadro + (2 * Math.max(espessuraPaspaturCm, 2)) : larguraArredondadaQuadro;
    
    // Convertendo para metros apenas uma vez após considerar o paspatur
    const alturaExterna_m = cmParaMetro(alturaExterna_cm_base);
    const larguraExterna_m = cmParaMetro(larguraExterna_cm_base);
    const perimetroExterna_m = (alturaExterna_m + larguraExterna_m) * 2;
    const areaExterna_m2 = alturaExterna_m * larguraExterna_m; // Área final para vidro, fundo, paspatur e limpeza

    for (const materialNome of materiaisSelecionados) {
        const materialPrice = await getMaterialPrice(materialNome);
        if (materialPrice > 0) {
            let valorMaterial = 0;
            if (materialNome.toLowerCase().includes('vidro') || materialNome.toLowerCase().includes('fundo')) {
                // Usam a área externa arredondada
                valorMaterial = areaExterna_m2 * materialPrice; 
            } else if (materialNome.toLowerCase().includes('sarrafo')) {
                // Usa o perímetro interno arredondado
                valorMaterial = perimetroInterno_m * materialPrice; 
            } else if (materialNome.toLowerCase().includes('paspatur')) {
                // O paspatur também é por m² da área externa arredondada
                valorMaterial = areaExterna_m2 * materialPrice; 
            }

            if (valorMaterial > 0) {
                valorTotal += valorMaterial;
                detalhes.push(`${materialNome}: R$ ${valorMaterial.toFixed(2)}`);
            }
        }
    }

    if (moldurasSelecionadas && moldurasSelecionadas.length > 0) {
        for (const molduraNome of moldurasSelecionadas) {
            const [rows] = await db.execute('SELECT valor_metro_linear FROM Molduras WHERE nome = ? OR codigo = ?', [molduraNome, molduraNome]);
            if (rows.length > 0) {
                const molduraPrice = parseFloat(rows[0].valor_metro_linear);
                // A moldura usa o perímetro externo arredondado
                const valorMoldura = perimetroExterna_m * molduraPrice; 
                valorTotal += valorMoldura;
                detalhes.push(`Moldura (${molduraNome}): R$ ${valorMoldura.toFixed(2)}`);
            }
        }
    }

    if (limpezaSelecionada) {
        // A limpeza também é por m² da área externa arredondada
        const valorLimpeza = areaExterna_m2 * 150.00; 
        valorTotal += valorLimpeza;
        detalhes.push(`Limpeza: R$ ${valorLimpeza.toFixed(2)}`);
    }

    return { total: valorTotal, detalhes };
}

module.exports = {
    arredondarParaCinco,
    cmParaMetro,
    calcularMetroLinear, 
    calcularMetroQuadrado, 
    calcularAreaPaspatur, 
    calcularPrecoQuadro
};