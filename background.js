// background.js

// Función recursiva para buscar la carpeta de enviados en la estructura de carpetas
function findSentFolder(folder) {
    // Se asume que la carpeta de enviados tendrá "sent" o "enviado" en su nombre
    if (folder.name.toLowerCase().includes("sent") || folder.name.toLowerCase().includes("enviado")) {
      return folder;
    }
    if (folder.subFolders && folder.subFolders.length > 0) {
      for (let sub of folder.subFolders) {
        let found = findSentFolder(sub);
        if (found) return found;
      }
    }
    return null;
  }
  
  // Listener para nuevos mensajes
  browser.messages.onNewMailReceived.addListener(async (folder, messages) => {
    for (let message of messages) {
      try {
        // Verificar que el asunto comience con "Underivable:"
        if (message.subject && message.subject.startsWith("Underivable:")) {
          console.log("Nuevo mensaje detectado con asunto Underivable:", message.subject);
  
          // Obtener los detalles completos del mensaje para acceder a los encabezados
          let fullMessage = await browser.messages.getFull(message.id);
  
          // Extraer el encabezado "in-reply-to"
          let inReplyToHeader = fullMessage.headers["in-reply-to"];
          if (!inReplyToHeader) {
            console.log("No se encontró el encabezado 'In-Reply-To' en el mensaje.");
            continue;
          }
  
          // Si el encabezado es un arreglo, se toma el primer elemento
          let originalMessageId = Array.isArray(inReplyToHeader) ? inReplyToHeader[0] : inReplyToHeader;
          console.log("ID del mensaje original:", originalMessageId);
  
          // Buscar la carpeta de enviados recorriendo todas las cuentas configuradas
          let accounts = await browser.accounts.list();
          let sentFolder = null;
          for (let account of accounts) {
            sentFolder = findSentFolder(account.folders);
            if (sentFolder) break;
          }
  
          if (!sentFolder) {
            console.log("No se pudo encontrar la carpeta de enviados ('Sent' o 'Enviados').");
            continue;
          }
          console.log("Carpeta de enviados encontrada:", sentFolder.name);
  
          // Consultar en la carpeta de enviados el mensaje original mediante el headerMessageId
          let query = {
            folder: sentFolder,
            headerMessageId: originalMessageId
          };
          let result = await browser.messages.query(query);
  
          if (!result.messages || result.messages.length === 0) {
            console.log("No se encontró el mensaje original en la carpeta de enviados.");
            continue;
          }
  
          let originalMsg = result.messages[0];
          console.log("Mensaje original encontrado, ID:", originalMsg.id);
  
          // Obtener detalles completos del mensaje original para acceder a los adjuntos
          let fullOriginal = await browser.messages.getFull(originalMsg.id);
          let attachments = fullOriginal.attachments.filter(att => att.contentType === "application/pdf");
  
          if (attachments.length === 0) {
            console.log("No se encontró ningún archivo PDF en el mensaje original.");
            continue;
          }
  
          let pdfAttachment = attachments[0];
          console.log("Archivo PDF encontrado:", pdfAttachment.name);
  
          // Preparar los detalles para componer el nuevo mensaje
          let composeDetails = {
            to: "gmr@virtucan.es",
            subject: "Reenvío de PDF",
            body: "Adjunto el PDF solicitado.",
            attachments: [
              {
                // Se asume que pdfAttachment.url es una URL válida para el adjunto
                url: pdfAttachment.url,
                name: pdfAttachment.name,
                contentType: pdfAttachment.contentType
              }
            ]
          };
  
          // Iniciar la composición del nuevo mensaje
          let composeTab = await browser.compose.beginNew(composeDetails);
          // Opcional: enviar el mensaje automáticamente (descomentar la siguiente línea si se desea)
          // await browser.compose.sendMessage(composeTab.id, { mode: "sendNow" });
          
          console.log("Se ha creado un nuevo mensaje con el PDF adjunto.");
        }
      } catch (err) {
        console.error("Error al procesar el mensaje:", err);
      }
    }
  });
  