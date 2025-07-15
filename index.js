// index.js (Revisado para Comunicação com Extensão)

document.addEventListener('DOMContentLoaded', function () {
    const textXML = document.getElementById('textXML');
    const butGerar = document.getElementById('butGerar');
    const butUpload = document.getElementById('butUpload');
    const arquivoInput = document.getElementById('arquivo');

    // Elementos ocultos para comunicação com o background script
    const stringsFSistXml = document.getElementById('stringsFSistXml');
    const stringsFSistLink = document.getElementById('stringsFSistLink');
    const stringsFSistError = document.getElementById('stringsFSistError');
    const stringsFSistHtml = document.getElementById('stringsFSistHtml');
    const stringsFSistDados = document.getElementById('stringsFSistDados');
    const stringsFSistClick = document.getElementById('stringsFSistClick');
    const stringsFSistChave = document.getElementById('stringsFSistChave');
    const stringsFSistUrl = document.getElementById('stringsFSistUrl');

    // Elementos do modal de mensagem (seu código original)
    const msg1 = document.getElementById('msg1');
    const msg1texto = document.getElementById('msg1texto');
    const msg1Fade = document.getElementById('msg1Fade');
    const butMsg1 = document.getElementById('butMsg1');
    const msg2 = document.getElementById('msg2'); // Modal "Aguarde..."

    // --- Funções de Modal (do seu código original) ---
    function Aguarde() {
        if (msg2) msg2.classList.add('show');
    }

    function AguardeClose() {
        if (msg2) msg2.classList.remove('show');
    }

    function MsgInf(msg, onclose) {                
        if (msg1texto) msg1texto.innerText = msg;        
        if (msg1Fade) {
            msg1Fade.style.opacity = 0;
            msg1Fade.style.display = 'block';        
        }
        if (msg1) {
            msg1.style.opacity = 0;
            if (msg1.firstElementChild) msg1.firstElementChild.style.transform = 'translateY(-200px)';
            msg1.style.display = 'block';        
        }
        
        setTimeout(() => {
            if (msg1Fade) msg1Fade.style.opacity = 0.5;
            if (msg1) {
                msg1.style.opacity = 1;
                if (msg1.firstElementChild) msg1.firstElementChild.style.transform = 'translateY(0px)';
            }
        }, 1);
        
        if (msg1) msg1.classList.add('show');
        if (msg1) msg1.style.display = 'block';

        if (butMsg1) {
            butMsg1.onclick = function () {
                if (msg1) msg1.style.opacity = 0;
                if (msg1Fade) msg1Fade.style.opacity = 0;
                if (msg1 && msg1.firstElementChild) msg1.firstElementChild.style.transform = 'translateY(-200px)';            
                if (msg1) msg1.style.display = 'none';
                if (msg1Fade) msg1Fade.style.display = 'none';
                if (onclose != null){
                    onclose();
                }
            };
        }
    }

    // --- Funções Auxiliares (do seu código original) ---
    function getChave(xml) {
        if (xml.indexOf(' Id="NFe') > -1) {
            return StrEntreStr(' Id="NFe', '"', xml);
        }
        else if (xml.indexOf(' Id="CTe') > -1) {
            return StrEntreStr(' Id="CTe', '"', xml);
        }
        return '';
    }

    function StrEntreStr(str1, str2, str) {
        var ini = str.indexOf(str1);
        if (ini > -1) {
            ini += str1.length;
            var fim = str.indexOf(str2, ini);
            if (fim > -1) {
                var res = str.substring(ini, fim); // Usar substring
                return res;
            }
        }
        return '';
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

    // Botão "Enviar Arquivo XML" (butUpload)
    if (butUpload) {
        butUpload.addEventListener('click', function () {
            arquivoInput.click();            
        });
    }

    // Input de arquivo (quando um arquivo é selecionado)
    if (arquivoInput) {
        arquivoInput.addEventListener('change', function (event) {
            var files = event.target.files; 
            f = files[0];
            var reader = new FileReader();            
            reader.onload = (function (theFile) {
                return function (e) {
                    if (textXML) textXML.value = e.target.result;
                    if (butGerar) butGerar.click(); // Simula o clique no botão Gerar
                };
            })(f);            
            reader.readAsText(f);
        });
    }

    // Botão "Gerar DANFe ou DACTe" (butGerar)
    if (butGerar) {
        butGerar.addEventListener('click', function () {
            if (textXML && textXML.value.trim() === '') {
                MsgInf('É necessário informar o xml', function () {
                    textXML.focus();
                });
            } else {
                const xmlContent = textXML ? textXML.value : '';
                const chave = getChave(xmlContent);

                if (chave && chave.length === 44) {
                    Aguarde(); // Mostra o modal "Aguarde..."
                    
                    // Define os valores nos inputs ocultos para o background script
                    if (stringsFSistChave) stringsFSistChave.value = chave;
                    if (stringsFSistUrl) stringsFSistUrl.value = 'https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo'; // URL da SEFAZ
                    
                    // Simula o clique no elemento oculto para disparar a mensagem para o background script
                    if (stringsFSistClick) stringsFSistClick.click();

                } else {
                    MsgInf('Arquivo XML inválido ou chave de acesso não encontrada/inválida.', function () {
                        if (textXML) textXML.focus();
                    });
                }
            }
        });        
    }

    // --- Listeners para mensagens do Background Script ---
    // Este `index.js` deve estar listando mensagens do `background.js`
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {        
          if (request.message === "set_xml") {
            AguardeClose(); // Fecha o modal "Aguarde..."
            const xmlContent = utf8base64(request.content);
            console.log("XML recebido da extensão:", xmlContent);
            // Agora que você tem o XML, você pode processá-lo e exibir os botões.
            // Aqui você chamaria a função que processa o XML e exibe o DANFE/Download.
            // Por exemplo, você pode chamar a função `processAndDisplayXml` do seu `main.js`
            // Certifique-se de que `processAndDisplayXml` esteja acessível globalmente ou passe o XML.
            
            // Exemplo de como você poderia passar o XML para o main.js
            // Se main.js estiver no escopo global ou tiver uma função para isso:
            if (typeof processAndDisplayXml === 'function') {
                processAndDisplayXml(xmlContent);
            } else {
                console.error("Função processAndDisplayXml não encontrada. Certifique-se de que main.js está carregado corretamente e a função é globalmente acessível.");
                // Você pode armazenar o XML em um campo oculto e ter um listener no main.js
                if (stringsFSistXml) {
                    stringsFSistXml.value = request.content; // Armazena o XML codificado
                    // Dispara um evento personalizado que o main.js pode ouvir
                    const event = new Event('xmlReceivedFromExtension');
                    stringsFSistXml.dispatchEvent(event);
                }
            }
            sendResponse({status: "success"});
          }
          else if (request.message === "set_link") {
            // Se você precisar do link para algo, ele estará aqui.
            // Por enquanto, o XML é o principal foco.
            console.log("Link recebido da extensão:", atob(request.content));
            if (stringsFSistLink) stringsFSistLink.value = request.content;
            sendResponse({status: "success"});
          }
          else if (request.message === "show_error") {
            AguardeClose(); // Fecha o modal "Aguarde..."
            const errorMessage = request.content;
            console.error("Erro recebido da extensão:", errorMessage);
            MsgInf("Erro na consulta: " + errorMessage); // Exibe o erro no modal
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

    // Adiciona listener para o evento personalizado disparado pelo stringsFSistXml
    if (stringsFSistXml) {
        stringsFSistXml.addEventListener('xmlReceivedFromExtension', async () => {
            const xmlContent = utf8base64(stringsFSistXml.value);
            console.log("XML received via custom event:", xmlContent);
            // Chama a função de processamento do main.js
            if (typeof processAndDisplayXml === 'function') {
                await processAndDisplayXml(xmlContent);
            } else {
                console.error("processAndDisplayXml function not found in main.js.");
            }
        });
    }

});

// Função para iniciar (chamada no final do script, como no seu original)
// iniciar(); // Não é mais necessário chamar aqui, pois o DOMContentLoaded já está sendo usado.
