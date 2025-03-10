// background.js
//Variables globales
const subjectFilter = "Undeliverable:"

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

               // Descargar el archivo adjunto como un objeto File
               let file = await browser.messages.getAttachmentFile(originalMsg.id, pdfAttachment.partName);

               // Obtener la identidad (cuenta) desde la cual se enviará el correo
               let accounts = await browser.accounts.list();
               let identityId;

                // Sacamos el correo origen del correo inicial
                let rawOriginalMail = fullOriginal.headers.from[0].split(" ").pop();

                let originalMail = rawOriginalMail.replace(/^<|>$/g, '');

                console.log("Cuentas", accounts);
                console.log(originalMail);

                for (let account of accounts) {

                   for (let identity of account.identities) {
                       if (identity.email.toLowerCase() === originalMail) {
                           identityId = identity.id;
                           break;
                       }
                   }
                   if (identityId) break;
                }

                if (!identityId) {
                   console.log("No se encontró una identidad que coincida con el autor del mensaje original.");
                   continue;
                }

                // Configurar los detalles del nuevo correo
                let composeDetails = {
                    to: [fullOriginal.headers.to[0]], // Enviar al destinatario original
                    subject: "Reenvío de factura",
                    body: "Estimado cliente,\n\nAdjunto nuevamente la factura solicitada.\n\nSaludos cordiales.",
                    attachments: [{
                        file: file,
                        name: pdfAttachment.name,
                    }],
                    identityId: identityId
                };

                console.log("Email a enviar", composeDetails);

                // Crear y enviar el correo
                let composeTab = await browser.compose.beginNew(composeDetails);

                console.log(composeTab);

                await browser.compose.sendMessage(composeTab.id, { mode: "sendNow" });
                console.log("Correo enviado con éxito.");

            }
        } catch (err) {
            console.error("Error:", err);
        }
    }
});