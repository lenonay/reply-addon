// background.js
//Variables globales
// const cuenta = "diegolagerms@gmail.com";
const cuenta = "noreply@grupocio.onmicrosoft.com";
const destino = "gmr@virtucan.es";

browser.messages.onNewMailReceived.addListener(async (folder, data) => {
    console.log("Nuevo mensaje detectado en carpeta:", folder.name);
    console.log("Datos recibidos:", data);

    // Iterar sobre los mensajes dentro de data.messages
    for (let message of data.messages) {
        try {
            console.log("Procesando mensaje con asunto:", message.subject);
            
            if (message.subject && message.subject.includes("Underivable:")) {
                console.log("Mensaje Underivable detectado:", message.subject);
                
                console.log("Pre recuperar el mensaje completo");
                // Obtener el mensaje completo (necesario para headers)
                let fullMessage = await browser.messages.getFull(message.id);

                console.log("Mensaje completo", fullMessage);


                let inReplyToHeader = fullMessage.headers["in-reply-to"];
                console.log("In-Reply-To:", inReplyToHeader);

                if (!inReplyToHeader) {
                    console.log("Falta encabezado 'In-Reply-To'.");
                    continue;
                }

                // Extraer y limpiar el Message-ID
                let originalMessageId = Array.isArray(inReplyToHeader) ? inReplyToHeader[0] : inReplyToHeader;
                originalMessageId = originalMessageId.replace(/^<|>$/g, '');
                console.log("Message-ID original:", originalMessageId);

                console.log("Buscando el mensaje original...");
                // Buscar el mensaje original
                let result = await browser.messages.query({
                    headerMessageId: originalMessageId
                });

                if (result.messages.length === 0) {
                    console.log("Mensaje original no encontrado.");
                    continue;
                }

                let originalMsg = result.messages[0];
                console.log("Mensaje original encontrado con id:", originalMsg.id);

                // Obtener adjuntos del original
                let fullOriginal = await browser.messages.getFull(originalMsg.id);

                console.log("Contenido del mensaje original: ", fullOriginal);

                // Sacamos los adjuntos que sean pdf
                let parts_array = fullOriginal.parts[0]

                let attachments = parts_array.parts.filter(att => 
                    att.contentType.toLowerCase() === "application/pdf"
                );

                if (attachments.length === 0) {
                    console.log("No hay PDF adjunto.");
                    return;
                    // Se puede hacer que si no se encuentra el archivo que se revise de forma manual
                }

                let pdfAttachment = attachments[0];
                console.log("PDF encontrado:", pdfAttachment);


                let pdfFile = await browser.messages.getAttachmentFile(originalMsg.id, pdfAttachment.partName);


                // Configurar los detalles del nuevo correo
                let composeDetails = {
                    to: [destino],
                    subject: "Reenvío de PDF",
                    body: "Adjunto el PDF solicitado.",
                    attachments: [{
                        file: file,
                        name: pdfAttachment.name,
                        contentType: pdfAttachment.contentType
                    }]
                };

                // Crear y enviar el correo
                let composeTab = await browser.compose.beginNew(composeDetails);
                await browser.compose.sendMessage(composeTab.id, { mode: "sendNow" });
                console.log("Correo enviado con éxito.");

            }
        } catch (err) {
            console.error("Error:", err);
        }
    }
});