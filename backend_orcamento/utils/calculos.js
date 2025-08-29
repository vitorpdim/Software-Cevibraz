// RF01 - Arredondamento automático para múltiplos de 5 cm (sempre para cima)
function arredondarParaCinco(medida) {
    return Math.ceil(medida / 5) * 5;
}

// Converte cm para metro
function cmParaMetro(valorCm) {
    return valorCm / 100;
}

// RF01 - Metro linear: (altura + altura + largura + largura)
function calcularMetroLinear(alturaCm, larguraCm) {
    const alturaArredondada = arredondarParaCinco(alturaCm);
    const larguraArredondada = arredondarParaCinco(larguraCm);
    return (alturaArredondada + alturaArredondada + larguraArredondada + larguraArredondada) / 100;
}

// RF01 - Metro quadrado: (altura × largura)
function calcularMetroQuadrado(alturaCm, larguraCm) {
    const alturaArredondada = arredondarParaCinco(alturaCm);
    const larguraArredondada = arredondarParaCinco(larguraCm);
    return (alturaArredondada * larguraArredondada) / 10000;
}

// RF01 - Paspatur: (altura + 2 × espessura) × (largura + 2 × espessura), com mínimo de 2 cm
function calcularAreaPaspatur(alturaCm, larguraCm, espessuraPaspaturCm) {
    const espessuraReal = Math.max(espessuraPaspaturCm, 2);
    const alturaComPaspaturCm = alturaCm + (2 * espessuraReal);
    const larguraComPaspaturCm = larguraCm + (2 * espessuraReal);
    return calcularMetroQuadrado(alturaComPaspaturCm, larguraComPaspaturCm);
}


async function calcularPrecoQuadro(altura_cm, largura_cm, moldurasSelecionadas, materiaisSelecionados, espessuraPaspaturCm, limpezaSelecionada, db) {
    let valorTotal = 0;
    const detalhes = [];

    const getMaterialPrice = async (nome) => {
        const [rows] = await db.execute('SELECT valor_base FROM Materiais WHERE nome = ?', [nome]);
        return rows.length > 0 ? parseFloat(rows[0].valor_base) : 0;
    };

    const alturaArredondadaQuadro = arredondarParaCinco(altura_cm);
    const larguraArredondadaQuadro = arredondarParaCinco(largura_cm);

    const temPaspatur = materiaisSelecionados.includes('Paspatur') && espessuraPaspaturCm > 0;

    // Dimensões arredondadas 
    const alturaInterna_m = cmParaMetro(alturaArredondadaQuadro);
    const larguraInterna_m = cmParaMetro(larguraArredondadaQuadro);
    const perimetroInterno_m = (alturaInterna_m + larguraInterna_m) * 2;

    // Pra altura e largura externa, que podem ser afetadas pelo paspatur
    const alturaExterna_cm_base = temPaspatur ? alturaArredondadaQuadro + (2 * Math.max(espessuraPaspaturCm, 2)) : alturaArredondadaQuadro;
    const larguraExterna_cm_base = temPaspatur ? larguraArredondadaQuadro + (2 * Math.max(espessuraPaspaturCm, 2)) : larguraArredondadaQuadro;
    
    // Convertendo pra metros só uma vez dps de considerar o paspatur
    const alturaExterna_m = cmParaMetro(alturaExterna_cm_base);
    const larguraExterna_m = cmParaMetro(larguraExterna_cm_base);
    const perimetroExterna_m = (alturaExterna_m + larguraExterna_m) * 2;
    const areaExterna_m2 = alturaExterna_m * larguraExterna_m; // area final p vidro, fundo, paspatur e limpeza

    for (const materialNome of materiaisSelecionados) {
        const materialPrice = await getMaterialPrice(materialNome);
        if (materialPrice > 0) {
            let valorMaterial = 0;
            if (materialNome.toLowerCase().includes('vidro') || materialNome.toLowerCase().includes('fundo')) {
                valorMaterial = areaExterna_m2 * materialPrice; 
            } else if (materialNome.toLowerCase().includes('sarrafo')) {
                valorMaterial = perimetroInterno_m * materialPrice; 
            } else if (materialNome.toLowerCase().includes('paspatur')) {
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
                const valorMoldura = perimetroExterna_m * molduraPrice; 
                valorTotal += valorMoldura;
                detalhes.push(`Moldura (${molduraNome}): R$ ${valorMoldura.toFixed(2)}`);
            }
        }
    }

    if (limpezaSelecionada) {
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
