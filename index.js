// index.js (Revisado e Finalizado para Página Principal)

document.addEventListener('DOMContentLoaded', function () {
    // Elementos da interface do usuário
    const fileInput = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const readXmlBtn = document.getElementById('readXmlBtn');
    const uploadSection = document.getElementById('upload-section');
    const viewerSection = document.getElementById('viewer-section');
    const backToUploadBtn = document.getElementById('backToUploadBtn');

    // Elementos do loader
    const loaderOverlay = document.getElementById('loaderOverlay');
    const loaderText = document.getElementById('loaderText');

    // Elementos do modal de erro
    const errorModal = document.getElementById('errorModal');
    const errorModalTitle = document.getElementById('errorModalTitle');
    const errorModalMessage = document.getElementById('errorModalMessage');
    const errorModalCloseBtn = document.getElementById('errorModalCloseBtn');

    // Elementos ocultos para comunicação com o background script (mantidos para o fluxo de extensão)
    const stringsFSistXml = document.getElementById('stringsFSistXml');
    const stringsFSistLink = document.getElementById('stringsFSistLink');
    const stringsFSistError = document.getElementById('stringsFSistError');
    const stringsFSistHtml = document.getElementById('stringsFSistHtml');
    const stringsFSistDados = document.getElementById('stringsFSistDados');
    const stringsFSistClick = document.getElementById('stringsFSistClick');
    const stringsFSistChave = document.getElementById('stringsFSistChave');
    const stringsFSistUrl = document.getElementById('stringsFSistUrl');

    // --- Funções de Modal e Loader ---
    function showLoader(message = 'Carregando...') {
        if (loaderText) loaderText.textContent = message;
        if (loaderOverlay) loaderOverlay.style.display = 'flex';
    }

    function hideLoader() {
        if (loaderOverlay) loaderOverlay.style.display = 'none';
    }

    function showErrorMessage(title, message) {
        if (errorModalTitle) errorModalTitle.textContent = title;
        if (errorModalMessage) errorModalMessage.innerHTML = message; // Usar innerHTML para permitir tags HTML
        if (errorModal) errorModal.style.display = 'flex';
    }

    function hideErrorMessage() {
        if (errorModal) errorModal.style.display = 'none';
    }

    // --- Funções Auxiliares ---
    function getChave(xml) {
        let chave = '';
        // Tenta encontrar a chave para NFe
        let matchNFe = xml.match(/Id="NFe(\d{44})"/);
        if (matchNFe && matchNFe[1]) {
            chave = matchNFe[1];
        } else {
            // Tenta encontrar a chave para CTe
            let matchCTe = xml.match(/Id="CTe(\d{44})"/);
            if (matchCTe && matchCTe[1]) {
                chave = matchCTe[1];
            }
        }
        return chave;
    }

    function base64utf8(str){
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            function toSolidBytes(match, p1) {
                return String.fromCharCode('0x' + p1);
        }));
    }
    function utf8base64(str){
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    }

    // --- Event Listeners para a interface do usuário ---

    // Lida com a seleção de arquivo
    if (fileInput) {
        fileInput.addEventListener('change', function (event) {
            const file = event.target.files[0];
            if (file) {
                if (fileNameDisplay) fileNameDisplay.textContent = file.name;
            } else {
                if (fileNameDisplay) fileNameDisplay.textContent = 'Clique aqui e Escolha Seus XMLs NFe ou CTe';
            }
        });
    }

    // Botão "Ler XML" (agora inicia o processo de extração da chave ou consulta via extensão)
    if (readXmlBtn) {
        readXmlBtn.addEventListener('click', function () {
            const file = fileInput.files[0];
            if (!file) {
                showErrorMessage('Erro', 'Por favor, selecione um arquivo XML primeiro.');
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                const xmlContent = e.target.result;
                const chave = getChave(xmlContent);

                if (chave && chave.length === 44) {
                    // Se uma chave for encontrada no XML, tenta consultar via extensão
                    showLoader('Abrindo consulta na SEFAZ...');
                    
                    // Define os valores nos inputs ocultos para o background script
                    if (stringsFSistChave) stringsFSistChave.value = chave;
                    // Usar a URL correta para a consulta da SEFAZ
                    if (stringsFSistUrl) stringsFSistUrl.value = 'https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo';
                    
                    // Envia a mensagem para o background script para abrir a aba da SEFAZ
                    if (stringsFSistClick && chrome.runtime && chrome.runtime.sendMessage) {
                        chrome.runtime.sendMessage(
                            {
                                tipo: 'AbrirConsulta', 
                                chave: stringsFSistChave.value,
                                url: stringsFSistUrl.value
                            },
                            function(response) {
                                if (chrome.runtime.lastError) {
                                    console.error("Erro ao enviar mensagem 'AbrirConsulta':", chrome.runtime.lastError.message);
                                    hideLoader();
                                    showErrorMessage('Erro na Extensão', 'Não foi possível iniciar a consulta. Verifique se a extensão está ativa e atualizada.');
                                } else {
                                    console.log("Mensagem 'AbrirConsulta' enviada com sucesso:", response);
                                    // O loader permanecerá ativo até o XML ser recebido ou um erro ocorrer.
                                }
                            }
                        );
                    } else {
                        hideLoader();
                        showErrorMessage('Erro', 'Funcionalidade da extensão não disponível. Certifique-se de que a extensão está instalada e ativa.');
                    }

                } else {
                    // Se não encontrar chave ou for inválida, processa o XML localmente
                    console.log("Chave não encontrada ou XML inválido. Processando localmente.");
                    hideLoader();
                    if (typeof processAndDisplayXml === 'function') {
                        processAndDisplayXml(xmlContent);
                    } else {
                        showErrorMessage('Erro Interno', 'Não foi possível processar o XML localmente. Função de visualização não encontrada.');
                    }
                }
            };
            reader.readAsText(file);
        });
    }

    // Botão "Voltar para Carregar XML"
    if (backToUploadBtn) {
        backToUploadBtn.addEventListener('click', function() {
            if (viewerSection) viewerSection.style.display = 'none';
            if (uploadSection) uploadSection.style.display = 'flex';
            // Limpa o input de arquivo e o nome do arquivo exibido
            if (fileInput) fileInput.value = '';
            if (fileNameDisplay) fileNameDisplay.textContent = 'Clique aqui e Escolha Seus XMLs NFe ou CTe';
        });
    }

    // --- Listeners para mensagens do Background Script ---
    if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(
            function(request, sender, sendResponse) {        
                if (request.message === "set_xml") {
                    hideLoader(); // Fecha o modal "Aguarde..."
                    const xmlContent = utf8base64(request.content);
                    console.log("XML recebido da extensão:", xmlContent);
                    
                    // Chama a função de processamento do main.js
                    if (typeof processAndDisplayXml === 'function') {
                        processAndDisplayXml(xmlContent);
                    } else {
                        console.error("Função processAndDisplayXml não encontrada. Certifique-se de que main.js está carregado corretamente e a função é globalmente acessível.");
                        showErrorMessage('Erro', 'Não foi possível exibir o XML. Função de visualização não encontrada.');
                    }
                    sendResponse({status: "success"});
                }
                else if (request.message === "set_link") {
                    // Este link pode ser usado para um botão de "Baixar XML" direto, se o XML não for baixado pelo background
                    console.log("Link recebido da extensão:", atob(request.content));
                    if (stringsFSistLink) stringsFSistLink.value = request.content;
                    sendResponse({status: "success"});
                }
                else if (request.message === "show_error") {
                    hideLoader(); // Fecha o modal "Aguarde..."
                    const errorMessage = request.content;
                    console.error("Erro recebido da extensão:", errorMessage);
                    showErrorMessage('Erro na Consulta', errorMessage); // Exibe o erro no modal
                    if (stringsFSistError) stringsFSistError.value = errorMessage;
                    sendResponse({status: "success"});
                }
                else if (request.message === "set_html") {
                    // Para depuração: HTML da página da SEFAZ
                    console.log("HTML da SEFAZ recebido para depuração.");
                    if (stringsFSistHtml) stringsFSistHtml.value = request.content;
                    sendResponse({status: "success"});
                }
                else if (request.message === "set_dados") {
                    // Para depuração: Dados do formulário da SEFAZ
                    console.log("Dados do formulário da SEFAZ recebidos para depuração.");
                    if (stringsFSistDados) stringsFSistDados.value = request.content;
                    sendResponse({status: "success"});
                }
            }
        );
    } else {
        console.warn("API chrome.runtime não disponível. A extensão pode não estar carregada ou em ambiente inválido.");
        // Pode desabilitar funcionalidades da extensão ou mostrar uma mensagem ao usuário
    }

    // Listener para fechar o modal de erro
    if (errorModalCloseBtn) {
        errorModalCloseBtn.addEventListener('click', hideErrorMessage);
    }
});

// Certifique-se de que a função processAndDisplayXml do main.js esteja acessível globalmente
// Isso pode ser feito no main.js assim: window.processAndDisplayXml = processAndDisplayXml;
// Ou você pode importar e exportar módulos se estiver usando um bundler.
// Para este exemplo, assumimos que main.js define processAndDisplayXml no escopo global.
