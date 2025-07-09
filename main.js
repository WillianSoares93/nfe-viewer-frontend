// main.js

document.addEventListener("DOMContentLoaded", () => {
    // Referências aos elementos HTML
    const fileInput = document.getElementById("fileInput");
    const uploadSection = document.getElementById("upload-section");
    const viewerSection = document.getElementById("viewer-section");
    const loaderOverlay = document.getElementById('loaderOverlay');
    const loaderText = document.getElementById('loaderText');
    const backToUploadBtn = document.getElementById("backToUploadBtn");

    // Elementos do modal de erro (estes são do seu site)
    const errorModal = document.getElementById('errorModal');
    const errorModalTitle = document.getElementById('errorModalTitle');
    const errorModalMessage = document.getElementById('errorModalMessage');
    const errorModalCloseBtn = document.getElementById('errorModalCloseBtn');

    let currentXmlContent = ''; // Variável para armazenar o conteúdo XML

    // URL base do seu servidor proxy
    // Certifique-se de que esta porta (3001) corresponde à porta em que seu server.js está rodando.
    const PROXY_BASE_URL = 'https://nfe-viewer-proxy.onrender.com';

    /**
     * Exibe o modal de erro com a mensagem fornecida.
     * @param {string} title - O título do erro.
     * @param {string} message - A mensagem de erro a ser exibida.
     */
    function showErrorMessage(title, message) {
        if (errorModalTitle) errorModalTitle.textContent = title;
        if (errorModalMessage) errorModalMessage.textContent = message;
        if (errorModal) errorModal.style.display = 'flex'; // Exibe o modal
    }

    // Event listener para fechar o modal de erro
    if (errorModalCloseBtn) {
        errorModalCloseBtn.addEventListener('click', () => {
            if (errorModal) errorModal.style.display = 'none'; // Oculta o modal
        });
    }

    /**
     * Exibe ou oculta o loader.
     * @param {boolean} show - True para exibir, False para ocultar.
     * @param {string} message - Mensagem opcional para o loader.
     */
    function toggleLoader(show, message = 'Carregando...') {
        if (loaderText) loaderText.textContent = message;
        if (loaderOverlay) loaderOverlay.style.display = show ? 'flex' : 'none';
    }

    /**
     * Lê o conteúdo de um arquivo como texto.
     * @param {File} file - O objeto File a ser lido.
     * @returns {Promise<string>} Uma promessa que resolve com o conteúdo do arquivo.
     */
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    /**
     * Formata um CNPJ com máscara.
     * @param {string} cnpj - O CNPJ a ser formatado.
     * @returns {string} O CNPJ formatado ou "N/A".
     */
    function formatCnpj(cnpj) {
        if (!cnpj) return "N/A";
        const cnpjClean = cnpj.replace(/\D/g, ''); // Remove caracteres não numéricos
        if (cnpjClean.length !== 14) return cnpj; // Retorna o original se não tiver 14 dígitos
        // Aplica a máscara de CNPJ
        return cnpjClean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }

    /**
     * Formata uma string de data do XML para DD/MM/YYYY.
     * O formato da data no XML é ISO (YYYY-MM-DDTHH:mm:ss...).
     * @param {string} dateString - A string de data do XML.
     * @returns {string} A data formatada ou "N/A".
     */
    function formatDate(dateString) {
        if (!dateString) return "N/A";
        const datePart = dateString.split("T")[0]; // Pega apenas a parte "YYYY-MM-DD"
        const [year, month, day] = datePart.split("-");
        return `${day}/${month}/${year}`; // Retorna "DD/MM/YYYY"
    }

    /**
     * Retorna a descrição de uma modalidade CST/CSOSN com base no código.
     * @param {string} cst - O código CST (Código de Situação Tributária) ou CSOSN (Código de Situação da Operação do Simples Nacional).
     * @returns {string} A descrição da modalidade.
     */
    function getModalidade(cst) {
        if (!cst) return "-";
        // Mapeamento de códigos CST/CSOSN para descrições
        const cstMap = {
            "00": "CST 00 - Tributada integralmente",
            "10": "CST 10 - Tributada com ST",
            "20": "CST 20 - Com redução da BC",
            "30": "CST 30 - Isenta com ST",
            "40": "CST 40 - Isenta",
            "41": "CST 41 - Não tributada",
            "50": "CST 50 - Suspensão",
            "51": "CST 51 - Diferimento",
            "60": "CST 60 - ICMS cobrado anteriormente",
            "70": "CST 70 - Redução + ST",
            "90": "CST 90 - Outras",
            "101": "CSOSN 101 - Simples c/ crédito",
            "102": "CSOSN 102 - Isenta",
            "103": "CSOSN 103 - Isenta p/ exportação",
            "201": "CSOSN 201 - ST + crédito",
            "500": "CSOSN 500 - ICMS anterior",
            "900": "CSOSN 900 - Outros"
        };
        return cstMap[cst] || `CST/CSOSN ${cst} - Desconhecido`;
    }

    /**
     * Processa o conteúdo XML e exibe as informações na seção do visualizador.
     * @param {string} xmlContent - O conteúdo XML da NF-e.
     */
    async function processAndDisplayXml(xmlContent) {
        toggleLoader(true, 'Processando XML...'); // Exibe o loader
        currentXmlContent = xmlContent; // Armazena o XML para uso posterior (ex: geração de DANFE)

        try {
            const parser = new DOMParser();
            const xml = parser.parseFromString(xmlContent, "application/xml");

            // Verifica se houve erros de parsing no XML
            if (xml.getElementsByTagName("parsererror").length > 0) {
                throw new Error("Erro ao interpretar o XML. Verifique se é um arquivo XML válido.");
            }

            // Seleciona os elementos principais do XML
            const emit = xml.querySelector("emit"); // Emitente
            const ide = xml.querySelector("ide"); // Identificação da NF-e

            // Extrai nome do emitente e número da nota
            const emitenteNome = emit?.querySelector("xNome")?.textContent || "";
            const numeroNota = ide?.querySelector("nNF")?.textContent || "SemNúmero";
            const chaveNFeNode = xml.querySelector("infNFe"); // Nó da informação da NF-e
            // Extrai a chave da NF-e (atributo 'Id' do nó 'infNFe', removendo "NFe" do início)
            const chaveNFe = chaveNFeNode ? chaveNFeNode.getAttribute("Id")?.replace(/^NFe/, '') : (numeroNota || "DANFE");

            // Lista de palavras genéricas a serem ignoradas para gerar um nome fantasia provável
            const palavrasIgnoradas = [
                "LTDA", "EIRELI", "ME", "EPP", "LTDA – ME", "LTDA – EPP", "S/A", "SA",
                "INDÚSTRIA", "INDUSTRIA", "INDÚSTRIAS", "INDUSTRIAS",
                "DISTRIBUIDORA", "DISTRIBUIDORAS",
                "COMERCIAL", "COMERCIAIS",
                "IMPORTAÇÃO", "IMPORTACAO", "IMPORTAÇÕES", "IMPORTACOES",
                "EXPORTAÇÃO", "EXPORTACAO", "EXPORTAÇÕES", "EXPORTACOES",
                "DO", "DA", "DE", "DEL", "DOS",
                "GRUPO", "GRUPOS",
                "BRASIL", "AMÉRICA", "AMERICA", "SUL", "NORDESTE", "CENTRO", "NORTE",
                "TINTA", "TINTAS",
                "PRODUTO", "PRODUTOS",
                "LIMPEZA", "LIMPEZAS",
                "MATERIAL", "MATERIAIS",
                "CONSTRUÇÃO", "CONSTRUCAO", "CONSTRUÇÕES", "CONSTRUCOES",
                "COMÉRCIO", "COMERCIO", "COMÉRCIOS", "COMERCIOS",
                "VAREJO", "VAREJOS",
                "ATACADISTA", "ATACADISTAS",
                "REPRESENTAÇÃO", "REPRESENTACAO", "REPRESENTAÇÕES", "REPRESENTACOES",
                "IMPORTADORA", "IMPORTADORAS",
                "EXPORTADORA", "EXPORTADORAS",
                "FERRAGEM", "FERRAGENS",
                "HIDRÁULICA", "HIDRAULICA", "HIDRÁULICAS", "HIDRAULICAS",
                "ELÉTRICA", "ELETRICA", "ELÉTRICAS", "ELETRICAS",
                "ACABAMENTO", "ACABAMENTOS",
                "REVESTIMENTO", "REVESTIMENTOS",
                "PISO", "PISOS",
                "CERÂMICA", "CERAMICA", "CERÂMICAS", "CERAMICAS",
                "CONEXÃO", "CONEXAO", "CONEXÕES", "CONEXOES",
                "TUBO", "TUBOS",
                "LOUÇA", "LOUCA", "LOUÇAS", "LOUCAS",
                "METAL", "METAIS",
                "ILUMINAÇÃO", "ILUMINACAO", "ILUMINAÇÕES", "ILUMINACOES",
                "FERRAMENTA", "FERRAMENTAS",
                "TELHA", "TELHAS",
                "ARGAMASSA", "ARGAMASSAS",
                "CIMENTO", "CIMENTOS",
                "MADEIRA", "MADEIRAS",
                "ESQUADRIA", "ESQUADRIAS",
                "BLOCO", "BLOCOS",
                "CONCRETO", "CONCRETOS",
                "SERRALHERIA", "SERRALHERIAS",
                "VIDRO", "VIDROS",
                "PVC",
                "GESSO", "GESSOS",
                "DRYWALL",
                "TELHADO", "TELHADOS",
                "PARAFUSO", "PARAFUSOS",
                "FIXADOR", "FIXADORES",
                "ESTRUTURA", "ESTRUTURAS",
                "SANEAMENTO", "SANEAMENTOS",
                "PINTURA", "PINTURAS",
                "REFORMA", "REFORMAS",
                "ENGENHARIA", "ENGENHARIAS",
                "EMPREENDimento", "EMPREENDIMENTOS",
                "OBRA", "OBRAS",
                "DEPÓSITO", "DEPOSITO", "DEPÓSITOS", "DEPOSITOS",
                "HOME CENTER", "HOME CENTERS",
                "LOGÍSTICA", "LOGISTICA", "LOGÍSTICAS", "LOGISTICAS",
                "MULTIMATERIAL", "MULTIMATERIAIS",
                "SUPRIMENTO", "SUPRIMENTOS",
                "CENTRO DE DISTRIBUIÇÃO", "CENTRO DE DISTRIBUIÇÃOA", "CENTROS DE DISTRIBUIÇÃO", "CENTROS DE DISTRIBUIÇÃO",
                "SHOWROOM", "SHOWROOMS",
                "ACESSÓRIO", "ACESSORIO", "ACESSÓRIOS", "ACESSORIOS",
                "EQUIPAMENTO", "EQUIPAMENTOS",
                "LOCAÇÃO", "LOCACAO", "LOCAÇÕES", "LOCACOES",
                "MANUTENÇÃO", "MANUTENCAO", "MANUTENÇÕES", "MANUTENCOES",
                "MONTAGEM", "MONTAGENS",
                "SERVIÇO", "SERVICO", "SERVIÇOS", "SERVICOS",
                "INSTALAÇÃO", "INSTALACAO", "INSTALAÇÕES", "INSTALACOES",
                "IMPERMEABILIZAÇÃO", "IMPERMEABILIZACAO", "IMPERMEABILIZAÇÕES", "IMPERMEABILIZACOES",
                "ISOLAMENTO", "ISOLAMENTOS",
                "TERRAPLENAGEM", "TERRAPLENAGENS",
                "ESCAVAÇÃO", "ESCAVACAO", "ESCAVAÇÕES", "ESCAVACOES",
                "ARTEFATO", "ARTEFATOS",
                "ASFALTO", "ASFALTOS",
                "MOVIMENTAÇÃO", "MOVIMENTACAO", "MOVIMENTAÇÕES", "MOVIMENTACOES",
                "MÁQUINA", "MAQUINA", "MÁQUINAS", "MAQUINAS",
                "ALVENARIA", "ALVENARIAS",
                "ENGENHARIA CIVIL",
                "URBANIZAÇÃO", "URBANIZACAO", "URBANIZAÇÕES", "URBANIZACOES",
                "PAISAGISMO",
                "RESIDENCIAL", "RESIDENCIAIS",
                "PREDIAL", "PREDIAIS",
                "INDUSTRIAL", "INDUSTRIAIS",
                "COMERCIALIZAÇÃO", "COMERCIALIZACAO", "COMERCIALIZAÇÕES", "COMERCIALIZACOES",
                "BRASILEIRA", "BRASILEIRAS",
                "INTERIOR", "INTERIORES",
                "CAPITAL", "CAPITAIS",
                "SERTÃO", "SERTAO", "SERTÕES", "SERTÕES",
                "SERRANA", "SERRANAS",
                "MATO-GROSSENSE", "CATARINENSE", "BAIANA", "PAULISTANA", "FLUMINENSE", "POTIGUAR", "CEARENSE", "AMAZONENSE", "MARANHENSE", "GOIANA",
                "DO PLANALTO", "DA CAPITAL", "DA FRONTEIRA", "DA ZONA LESTE", "DA ZONA SUL", "DA REGIÃO", "DA REGIAO", "DO SERTÃO", "DO SERTAO",
                "NOVA ERA", "PONTO CERTO", "SÃO JOSÉ", "SAO JOSE", "CONSTRULAR", "MUNDO DA CONSTRUÇÃO", "MUNDO DA CONSTRUCAO",
                "ALIANÇA", "ALIANCA", "SOLIDEZ", "QUALY", "ÚNICA", "UNICA", "ORIGINAL", "UNIVERSAL", "MIX", "DOMUS", "BASE", "SUPRA", "INOVA", "VITA", "DELTA",
                "FAMÍLIA", "FAMILIA", "FAMÍLIAS", "FAMILIAS",
                "NACIONAL", "NACIONAIS",
                "REDE", "REDES",
                "ATIVA", "ATIVAS",
                "SOLUÇÃO", "SOLUCAO", "SOLUÇÕES", "SOLUCOES",
                "CONFIANÇA", "CONFIANCA",
                "BOA OBRA", "BOAS OBRAS",
                "EXATO", "ÂNCORA", "ANCORA",
                "COMÉRCIO DE MATERIAIS DE CONSTRUÇÃO", "COMERCIO DE MATERIAIS DE CONSTRUCAO",
                "ENGENHARIA E CONSTRUÇÃO", "ENGENHARIA E CONSTRUCAO",
                "DISTRIBUIÇÃO E LOGÍSTICA", "DISTRIBUICAO E LOGISTICA",
                "COMÉRCIO E SERVIÇOS", "COMERCIO E SERVICOS",
                "LOCAÇÃO E MANUTENÇÃO", "LOCACAO E MANUTENCAO",
                "SOLUÇÕES EM CONSTRUÇÃO", "SOLUCOES EM CONSTRUCAO",
                "CONSTRUÇÃO E ACABAMENTO", "CONSTRUCAO E ACABAMENTO", "CIA.", "CIA", "COMPANHIA"
            ];

            const palavras = emitenteNome.toUpperCase().match(/\b[\wÀ-Ü]+(?:-[\wÀ-Ü]+)?\b/g) || [];
            const palavrasRelevantes = palavras.filter(p => !palavrasIgnoradas.includes(p));
            const nomeFantasiaProvavel = palavrasRelevantes[0] || "Nota";
            document.title = `${nomeFantasiaProvavel} NF ${numeroNota}`; // Define o título da página

            // Extrai e formata CNPJ e data de emissão
            const cnpj = emit?.querySelector("CNPJ")?.textContent || "N/A";
            const dataEmissao = ide?.querySelector("dhEmi")?.textContent;

            const cnpjFormatado = formatCnpj(cnpj);
            const dataFormatada = formatDate(dataEmissao);

            const headerDiv = document.getElementById("header");
            if (headerDiv) {
                // Preenche o cabeçalho da nota com as informações extraídas
                headerDiv.innerHTML = `
                <div class="card bg-light border rounded p-3 mb-3">
                    <div class="row">
                        <div class="col-md-6">
                            <h5 class="mb-2">Emitente</h5>
                            <p class="mb-1"><strong>Razão Social:</strong> ${emit?.querySelector("xNome")?.textContent || "N/A"}</p>
                            <p class="mb-1"><strong>CNPJ:</strong> ${cnpjFormatado}</p>
                            <p class="mb-0"><strong>Endereço:</strong>
                            ${emit?.querySelector("enderEmit xLgr")?.textContent || ""},
                            ${emit?.querySelector("enderEmit nro")?.textContent || ""}
                            ${emit?.querySelector("enderEmit xCpl")?.textContent ? ' - ' + emit.querySelector("enderEmit xCpl").textContent : ""}
                            ${emit?.querySelector("enderEmit xBairro")?.textContent ? ' - ' + emit.querySelector("enderEmit xBairro").textContent : ""} -
                            ${emit?.querySelector("enderEmit xMun")?.textContent || ""}/${emit?.querySelector("enderEmit UF")?.textContent || ""}
                            </p>
                        </div>
                        <div class="col-md-6">
                            <h5 class="mb-2">Nota Fiscal</h5>
                            <p class="mb-1"><strong>Número:</strong> ${ide?.querySelector("nNF")?.textContent || "N/A"}</p>
                            <p class="mb-1"><strong>Série:</strong> ${ide?.querySelector("serie")?.textContent || "N/A"}</p>
                            <p class="mb-0"><strong>Data:</strong> ${dataFormatada}</p>
                        </div>
                    </div>
                    <div class="text-end mt-3">
                        <button id="gerarDanfeBtn" class="btn btn-primary btn-sm">Gerar DANFE</button>
                    </div>
                </div>
                `;
            } else {
                console.error("Elemento 'header' não encontrado.");
            }

            const gerarDanfeBtn = document.getElementById("gerarDanfeBtn");
            if (gerarDanfeBtn) {
                // Revertendo para a abordagem do proxy
                gerarDanfeBtn.addEventListener("click", async function() {
                    if (!currentXmlContent) {
                        showErrorMessage("Erro na Geração do DANFE", "Conteúdo XML não carregado. Não é possível gerar DANFE.");
                        return;
                    }

                    toggleLoader(true, 'Enviando XML para API FSist...'); // Exibe loader

                    try {
                        const formData = new FormData();
                        // Cria um objeto File a partir do conteúdo XML
                        const xmlFile = new File([currentXmlContent], "nfe.xml", { type: "text/xml" });
                        formData.append("arquivo", xmlFile); // Adiciona o arquivo ao FormData

                        // *** Requisição para o seu servidor proxy ***
                        const proxyApiUrl = `${PROXY_BASE_URL}/proxy-fsist-gerarpdf`;

                        console.log(`Enviando XML para proxy: ${proxyApiUrl}`);
                        const responseProxy = await fetch(proxyApiUrl, {
                            method: "POST",
                            body: formData,
                        });

                        if (!responseProxy.ok) {
                            // Tenta ler a resposta como JSON para obter detalhes do erro do proxy
                            let errorData;
                            try {
                                errorData = await responseProxy.json();
                            } catch (e) {
                                // Se não for JSON, lê como texto
                                errorData = { error: await responseProxy.text() };
                            }
                            console.error(`Erro do proxy: ${responseProxy.status} - ${errorData.error || responseProxy.statusText}`);
                            throw new Error(errorData.error || `Erro ao se comunicar com o proxy: ${responseProxy.status} ${responseProxy.statusText}`);
                        }

                        const resultDataFsist = await responseProxy.json(); // A resposta do proxy já é o JSON da FSist

                        if (resultDataFsist.Resultado === "OK" && resultDataFsist.id && resultDataFsist.Arquivo) {
                            toggleLoader(true, 'Baixando arquivo ZIP...');
                            // *** Requisição para o seu servidor proxy para download ***
                            const zipDownloadUrl = `${PROXY_BASE_URL}/proxy-fsist-downloadzip?id=${resultDataFsist.id}&arq=${encodeURIComponent(resultDataFsist.Arquivo)}`;

                            const zipResponse = await fetch(zipDownloadUrl);

                            if (!zipResponse.ok) {
                                const errorText = await zipResponse.text();
                                throw new Error(`Erro ao baixar o arquivo ZIP via proxy: ${zipResponse.status} ${zipResponse.statusText}. Detalhes: ${errorText}`);
                            }
                            const zipBlob = await zipResponse.blob(); // Obtém o blob do ZIP

                            toggleLoader(true, 'Descompactando PDF...');
                            // Verifica se a biblioteca JSZip está carregada
                            if (typeof JSZip === "undefined") {
                                throw new Error("Biblioteca JSZip não carregada. Verifique as inclusões de script.");
                            }
                            const jszip = new JSZip();
                            const zip = await jszip.loadAsync(zipBlob); // Carrega o ZIP

                            let pdfFileEntry = null;

                            // Procura por um arquivo PDF dentro do ZIP
                            for (const filenameInZip in zip.files) {
                                if (filenameInZip.toLowerCase().endsWith(".pdf")) {
                                    pdfFileEntry = zip.files[filenameInZip];
                                    break;
                                }
                            }

                            if (pdfFileEntry) {
                                const pdfArrayBuffer = await pdfFileEntry.async("arraybuffer"); // Extrai o conteúdo do PDF
                                const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' }); // Cria um blob de PDF
                                const pdfUrl = URL.createObjectURL(pdfBlob); // Cria uma URL temporária para o PDF

                                // Abre o PDF em uma nova aba do navegador
                                window.open(pdfUrl, '_blank');

                                toggleLoader(true, 'DANFE pronta!');

                            } else {
                                throw new Error("PDF não encontrado no arquivo ZIP retornado pela API.");
                            }
                        } else {
                            throw new Error(`Erro retornado pela API FSist: ${resultDataFsist.Resultado || 'Resposta inesperada.'}`);
                        }

                    } catch (error) {
                        console.error("Erro ao gerar DANFE:", error);
                        showErrorMessage("Erro ao Gerar DANFE", error.message); // Exibe erro no modal
                    } finally {
                        // Oculta o loader após um pequeno atraso
                        setTimeout(() => {
                            toggleLoader(false);
                        }, 1500);
                    }
                });
            } else {
                console.error("Botão 'gerarDanfeBtn' não encontrado.");
            }

            // Seleciona os produtos/serviços do XML
            const produtos = xml.querySelectorAll("det");
            const listGroup = document.getElementById("productList");
            const detailBox = document.getElementById("productDetails");

            if (listGroup && detailBox) {
                // Limpa a lista de produtos anterior e os detalhes
                listGroup.innerHTML = '';
                detailBox.innerHTML = '<p class="text-center">Selecione um produto para ver os detalhes.</p>';

                // Itera sobre cada produto e adiciona à lista
                produtos.forEach((det, index) => {
                    const prod = det.querySelector("prod");
                    const imposto = det.querySelector("imposto");
                    const icms = imposto?.querySelector("ICMS")?.firstElementChild; // Primeiro filho de ICMS (CST ou CSOSN)
                    
                    // Extrai informações do produto
                    const descricao = prod?.querySelector("xProd")?.textContent || "Sem descrição";
                    const codigoProduto = prod?.querySelector("cProd")?.textContent || "N/A"; // Novo: Código do Produto
                    const codigoBarras = prod?.querySelector("cEAN")?.textContent || prod?.querySelector("cEANTrib")?.textContent || "N/A"; // Novo: Código de Barras
                    const qtd = prod?.querySelector("qCom")?.textContent || "0";
                    const valor = prod?.querySelector("vProd")?.textContent || "0.00";
                    const vUnCom = prod?.querySelector("vUnCom")?.textContent || "0.00";
                    const ncm = prod?.querySelector("NCM")?.textContent || "N/A";
                    const cfop = prod?.querySelector("CFOP")?.textContent || "N/A";
                    
                    // Extrai informações de ICMS
                    const origem = icms?.querySelector("orig")?.textContent || "-";
                    const cst = icms?.querySelector("CST")?.textContent || icms?.querySelector("CSOSN")?.textContent || "-";
                    const modalidade = getModalidade(cst);
                    const pICMS = icms?.querySelector("pICMS")?.textContent || "-";
                    const vICMS = icms?.querySelector("vICMS")?.textContent || "0.00";
                    const pRedBC = icms?.querySelector("pRedBC")?.textContent || "-";
                    const vBCICMS = icms?.querySelector("vBC")?.textContent || "0.00"; // Default para 0.00 para parseFloat
                    const modBCST = icms?.querySelector("modBCST")?.textContent || "-";
                    const pMVAST = icms?.querySelector("pMVAST")?.textContent || "-";
                    const vBCST = icms?.querySelector("vBCST")?.textContent || "0.00"; // Default para 0.00 para parseFloat
                    const pICMSST = icms?.querySelector("pICMSST")?.textContent || "-";
                    const vICMSST = icms?.querySelector("vICMSST")?.textContent || "0.00"; // Default para 0.00 para parseFloat

                    // Extrai informações de IPI
                    const ipiNode = imposto?.querySelector("IPI") || null;
                    const ipiTrib = ipiNode?.querySelector("IPITrib") || null;
                    const ipiCenq = ipiNode?.querySelector("cEnq")?.textContent || "-";
                    const ipiValor = ipiTrib?.querySelector("vIPI")?.textContent || "0.00"; // Default para 0.00 para parseFloat
                    const ipiPercent = ipiTrib?.querySelector("pIPI")?.textContent || "-";
                    const ipiBaseCalculo = ipiTrib?.querySelector("vBC")?.textContent || "0.00"; // Default para 0.00 para parseFloat

                    // Extrai informações de PIS
                    const pis = imposto?.querySelector("PIS");
                    const pisAliq = pis?.querySelector("pPIS")?.textContent || "-";
                    const vPIS = pis?.querySelector("vPIS")?.textContent || "0.00"; // Default para 0.00 para parseFloat
                    const vBCPIS = pis?.querySelector("vBC")?.textContent || "0.00"; // Default para 0.00 para parseFloat

                    // Extrai informações de COFINS
                    const cofins = imposto?.querySelector("COFINS");
                    const cofinsAliq = cofins?.querySelector("pCOFINS")?.textContent || "-";
                    const vCOFINS = cofins?.querySelector("vCOFINS")?.textContent || "0.00"; // Default para 0.00 para parseFloat
                    const vBCCOFINS = cofins?.querySelector("vBC")?.textContent || "0.00"; // Default para 0.00 para parseFloat

                    // HTML para exibir os detalhes do produto
                    const produtoInfo = `
                        <div class="card-body">
                            <h5 class="card-title">${descricao}</h5>
                            <p class="card-text"><strong>Código do Produto:</strong> ${codigoProduto}</p>
                            ${codigoBarras !== "N/A" ? `<p class="card-text"><strong>Código de Barras:</strong> ${codigoBarras}</p>` : ''}
                            <p class="card-text"><strong>Quantidade:</strong> ${qtd}</p>
                            <p><strong>Preço Unitário:</strong> R$ ${parseFloat(vUnCom).toFixed(2)}</p>
                            <p><strong>Valor Total:</strong> R$ ${parseFloat(valor).toFixed(2)}</p>
                            <hr>
                            <p><strong>NCM:</strong> ${ncm} | <strong>CFOP:</strong> ${cfop}</p>
                            <p><strong>Origem:</strong> ${origem}</p>
                            <hr>
                            <p><strong>Base de Cálculo ICMS:</strong> R$ ${parseFloat(vBCICMS).toFixed(2)}</p>
                            <p><strong>Base de Cálculo IPI:</strong> R$ ${parseFloat(ipiBaseCalculo).toFixed(2)}</p>
                            <p><strong>Base de Cálculo PIS:</strong> R$ ${parseFloat(vBCPIS).toFixed(2)}</p>
                            <p><strong>Base de Cálculo COFINS:</strong> R$ ${parseFloat(vBCCOFINS).toFixed(2)}</p>
                            <p><strong>Base de Cálculo ST:</strong> R$ ${parseFloat(vBCST).toFixed(2)} | <strong>Modalidade BC ST:</strong> ${modBCST}</p>
                            <hr>
                            <p><strong>${modalidade}</strong></p>
                            <p><strong>Redução BC ICMS:</strong> ${pRedBC !== "-" ? parseFloat(pRedBC).toFixed(2) + "%" : "-"}</p>
                            <p><strong>ICMS:</strong> R$ ${parseFloat(vICMS).toFixed(2)} (${pICMS !== "-" ? parseFloat(pICMS).toFixed(2) : "-"}%)</p>
                            <p><strong>IPI:</strong> R$ ${parseFloat(ipiValor).toFixed(2)} (${ipiPercent !== "-" ? parseFloat(ipiPercent).toFixed(2) : "-"}%) | <strong>Enq:</strong> ${ipiCenq}</p>
                            <p><strong>PIS:</strong> R$ ${parseFloat(vPIS).toFixed(2)} (${pisAliq !== "-" ? parseFloat(pisAliq).toFixed(2) : "-"}%)</p>
                            <p><strong>COFINS:</strong> R$ ${parseFloat(vCOFINS).toFixed(2)} (${cofinsAliq !== "-" ? parseFloat(cofinsAliq).toFixed(2) : "-"}%)</p>
                            <p><strong>MVA ST:</strong> ${pMVAST !== "-" ? parseFloat(pMVAST).toFixed(2) : "-"}%</p>
                            <p><strong>ICMS ST:</strong> R$ ${parseFloat(vICMSST).toFixed(2)} (${pICMSST !== "-" ? parseFloat(pICMSST).toFixed(2) : "-"}%)</p>
                        </div>
                    `;

                    // Cria um botão para cada produto na lista
                    const item = document.createElement("button");
                    item.className = "list-group-item list-group-item-action";
                    // Adiciona o código do produto na lista
                    item.textContent = `${descricao} (Cód: ${codigoProduto})`;
                    item.addEventListener("click", () => {
                        // Remove a classe 'active' de todos os itens e adiciona ao clicado
                        [...listGroup.children].forEach(btn => btn.classList.remove("active"));
                        item.classList.add("active");
                        detailBox.innerHTML = produtoInfo; // Exibe os detalhes do produto
                    });
                    listGroup.appendChild(item);
                });

                // Seleciona o primeiro produto da lista por padrão, se houver
                if (produtos.length > 0 && listGroup.children[0]) {
                    listGroup.children[0].click();
                }
            } else {
                console.error("Elementos 'productList' ou 'productDetails' não encontrados.");
            }

            // Oculta a seção de upload e exibe a seção do visualizador
            uploadSection.style.display = 'none';
            viewerSection.style.display = 'block';
            toggleLoader(false); // Oculta o loader
        } catch (err) {
            console.error("Erro ao processar o XML:", err);
            showErrorMessage("Erro ao Processar XML", err.message); // Exibe erro no modal
            toggleLoader(false); // Oculta o loader
            // Em caso de erro, volta para a tela de upload
            uploadSection.style.display = 'flex';
            viewerSection.style.display = 'none';
        }
    }

    // Event listener para o input de arquivo (quando um arquivo é selecionado)
    fileInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return; // Sai se nenhum arquivo for selecionado

        try {
            toggleLoader(true, 'Carregando arquivo...'); // Exibe loader
            const xmlContent = await readFileAsText(file); // Lê o arquivo
            await processAndDisplayXml(xmlContent); // Processa e exibe o XML
        } catch (error) {
            console.error("Erro ao carregar arquivo:", error);
            showErrorMessage("Erro ao Carregar Arquivo", error.message); // Exibe erro no modal
            toggleLoader(false); // Oculta o loader
            // Garante que a seção de upload esteja visível em caso de erro no carregamento inicial
            uploadSection.style.display = 'flex';
            viewerSection.style.display = 'none';
        } finally {
            fileInput.value = ""; // Reseta o input de arquivo para permitir selecionar o mesmo arquivo novamente
        }
    });

    // Event listener para o botão "Voltar para Carregar XML"
    if (backToUploadBtn) {
        backToUploadBtn.addEventListener("click", () => {
            viewerSection.style.display = 'none'; // Oculta o visualizador
            uploadSection.style.display = 'flex'; // Exibe a seção de upload
            document.title = "Visualizador de Nota Fiscal XML"; // Reseta o título da página
            // Limpa o conteúdo do visualizador
            document.getElementById("header").innerHTML = '';
            document.getElementById("productList").innerHTML = '';
            document.getElementById("productDetails").innerHTML = '<p class="text-center">Selecione um produto para ver os detalhes.</p>';
            currentXmlContent = ''; // Limpa o XML armazenado
        });
    }
});
