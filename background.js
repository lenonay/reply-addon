// background.js

// Función recursiva para buscar la carpeta de enviados
function findSentFolder(folder) {
    if (folder.type === "sent" || folder.name.toLowerCase().includes("sent") || folder.name.toLowerCase().includes("enviado")) {
        return folder;
    }
    if (folder.subFolders) {
        for (let sub of folder.subFolders) {
            let found = findSentFolder(sub);
            if (found) return found;
        }
    }
    return null;
}



browser.messages.onNewMailReceived.addListener(async (folder, messageIds) => {
    console.log("Nuevo mensaje detectado en carpeta:", folder.name);

    for (let msgId of messageIds) {
        try {
            // Obtener el mensaje completo a partir del ID
            let message = await browser.messages.get(msgId);
            console.log("Asunto del mensaje entrante:", message.subject);

            if (message.subject && message.subject.includes("Underivable:")) {
                console.log("Mensaje Underivable detectado:", message.subject);

                let fullMessage = await browser.messages.getFull(message.id);
                let inReplyToHeader = fullMessage.headers["in-reply-to"];

                if (!inReplyToHeader) {
                    console.log("Falta encabezado 'In-Reply-To'.");
                    continue;
                }

                // Extraer y limpiar el Message-ID
                let originalMessageId = Array.isArray(inReplyToHeader) ? inReplyToHeader[0] : inReplyToHeader;
                originalMessageId = originalMessageId.replace(/^<|>$/g, '');
                console.log("Message-ID original:", originalMessageId);

                // Buscar carpeta de enviados
                let accounts = await browser.accounts.list();
                let sentFolder = null;
                for (let account of accounts) {
                    sentFolder = findSentFolder(account.folders);
                    if (sentFolder) break;
                }

                if (!sentFolder) {
                    console.log("No se encontró la carpeta de enviados.");
                    continue;
                }

                // Buscar el mensaje original
                let result = await browser.messages.query({
                    folder: sentFolder,
                    headerMessageId: originalMessageId
                });

                if (result.messages.length === 0) {
                    console.log("Mensaje original no encontrado.");
                    continue;
                }

                let originalMsg = result.messages[0];
                console.log("Mensaje original encontrado:", originalMsg.id);

                // Obtener adjuntos del original
                let fullOriginal = await browser.messages.getFull(originalMsg.id);
                let attachments = fullOriginal.attachments.filter(att => 
                    att.contentType.toLowerCase() === "application/pdf"
                );

                if (attachments.length === 0) {
                    console.log("No hay PDF adjunto.");
                    continue;
                }

                let pdfAttachment = attachments[0];
                console.log("PDF encontrado:", pdfAttachment.name);

                // Obtener el archivo adjunto
                let file = await browser.messages.getFileAttachment(originalMsg.id, pdfAttachment.partName);

                // Configurar el nuevo correo
                let composeDetails = {
                    to: "gmr@virtucan.es",
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
            console.error("Error procesando mensaje:", err);
        }
    }
});