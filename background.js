//Variables globales de configuración
const subjectFilter = "Undeliverable:";
const bodyFilter= "Your message contains invalid characters (bare line feed characters)"
const newSubject = "Hotel Bahia del Duque - Factura / Invoce";
const newBody = "Dear guest,<br><br>Many thanks for your trust towards The Tais Bahia Del Duque. Attached you will find your invoice. We look forward to seeing you again <br>Kind regards, <br><br>(Please, do not reply to this mail)"


browser.messages.onNewMailReceived.addListener(async (folder, data) => {
    // Iterar sobre los mensajes dentro de data.messages
    for (let message of data.messages) {
        try {
            console.log("Procesando mensaje con asunto:", message.subject);
            
            // Si no encuentra el asunto no pasa el filtro, salimos e ignoramos el correo
            if (!message.subject || !message.subject.includes(subjectFilter)) {
                console.log("Omitiendo mensaje...");
                continue;
            }

            // Obtener el mensaje completo y su contenido
            let fullMessage = await browser.messages.getFull(message.id);

            console.log(fullMessage);

            // Recuperamos el contenido del cuerpo del email
            let replyBody = fullMessage.parts[0].parts[0].parts[0].body;

            // Filtramos por el mensaje de error de caracteres inválidos
            if (!replyBody.includes(bodyFilter)) {
                console.log("Omitiendo mensaje...");
                continue;
            }

            // Si no hay encabezado de respuesta salimos
            let inReplyToHeader = fullMessage.headers["in-reply-to"];

            if (!inReplyToHeader) {
                console.log("Falta encabezado 'In-Reply-To'.");
                continue;
            }

            // Extraer y limpiar el Message-ID
            let originalMessageId = Array.isArray(inReplyToHeader) ? inReplyToHeader[0] : inReplyToHeader;
            originalMessageId = originalMessageId.replace(/^<|>$/g, '');

            // Buscar el mensaje original
            let result = await browser.messages.query({
                headerMessageId: originalMessageId
            });

            // Si no esta el original salimos
            if (result.messages.length === 0) {
                console.log("Mensaje original no encontrado.");
                continue;
            }

            let originalMsg = result.messages[0];

            // Obtenemos todos los datos del mensaje original
            let fullOriginal = await browser.messages.getFull(originalMsg.id);

            // Sacamos los adjuntos que sean pdf
            let parts_array = fullOriginal.parts[0]

            let attachments = parts_array.parts.filter(att => 
                att.contentType.toLowerCase() === "application/pdf"
            );

            // Si no hay adjunto se omite
            if (attachments.length === 0) {
                console.log("No hay PDF adjunto, omitiendo...");
                continue;
                // Se puede hacer que si no se encuentra el archivo que se revise de forma manual
            }

            let pdfAttachment = attachments[0];

            // Descargar el archivo adjunto como un objeto File
            let file = await browser.messages.getAttachmentFile(originalMsg.id, pdfAttachment.partName);

            // Obtener la identidad (cuenta) desde la cual se enviará el correo
            let accounts = await browser.accounts.list();
            let identityId;

            // Sacamos el correo origen del correo inicial
            let rawOriginalMail = fullOriginal.headers.from[0].split(" ").pop();

            let originalMail = rawOriginalMail.replace(/^<|>$/g, '');

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
                console.log("No se encontró una identidad que coincida con el autor del mensaje original, omitiendo...");
                continue;
            }

            // Configurar los detalles del nuevo correo
            let composeDetails = {
                to: [fullOriginal.headers.to[0]], // Enviar al destinatario original
                subject: newSubject,
                body: newBody,
                attachments: [{
                    file: file,
                    name: pdfAttachment.name,
                }],
                identityId: identityId
            };

            // Crear y enviar el correo
            let composeTab = await browser.compose.beginNew(composeDetails);

            await browser.compose.sendMessage(composeTab.id, { mode: "sendNow" });
            console.log("Correo enviado con éxito.");

        } catch (err) {
            console.error("Error:", err);
        }
    }
});