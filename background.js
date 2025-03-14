// Variables globales de configuración
const subjectFilter = "Undeliverable:";
const bodyFilterDev = "cola";
const bodyFilter =
  "Your message contains invalid characters (bare line feed characters)";
const newSubject = "Hotel Bahia del Duque - Factura / Invoce";
const newBody =
  "Dear guest,<br><br>Many thanks for your trust towards The Tais Bahia Del Duque. Attached you will find your invoice. We look forward to seeing you again <br>Kind regards, <br><br>(Please, do not reply to this mail)";

const confirmationBody =
  "Se ha enviado correctamente el email fallido junto a su factura correspondiente.<br><br>Atentamente Departamento de IT Bahia del Duque";

// Direcciones de reenvio y buffer de log
let logBuffer = []; // Estructura [["texto", variable], ["texto", variable]]
const log = (register) => logBuffer.push(register);

const IT_mails = ["diegolagerms@gmail.com", "daniel.garcia@bahia-duque.com"];
// const IT_mails = ["diegolagerms@gmail.com"];

// Timeout Para crear Delay
const delay = 1000 * 30;

//////////// FUNCIONES
function SearchForBody(object, key, wanted_value) {
  let value;

  // Sacamos todas las claves y las iteramos
  Object.keys(object).some((k) => {
    // Si coincide con la que buscamos asignamos el valor y salimos.
    if (k === key && object[k] === wanted_value) {
      // Devolvemos el objecto completo
      value = object;
      return true;
    }

    // Si no coincide usando recursividad seguimos buscando.
    // Solo buscamos si existe la propiedad y es un objeto
    if (object[k] && typeof object[k] === "object") {
      value = SearchForBody(object[k], key, wanted_value);
      // Devolvemos el valor si no es undefined
      return value !== undefined;
    }
  });

  // Retornamos el valor
  return value;
}

function findEmailBody(message) {
  const mailBody = SearchForBody(message, "contentType", "text/plain");

  // Si conseguimos encontrar el texto plano devolvemos el cuerpo sino, devolvemos null
  return mailBody ? mailBody.body : null;
}

async function GetDelayedInfo(originalMessageId) {
  // Inicializamos una variable donde almacenar el mensaje original con la factura.
  let original = null;

  // Creamos un timeout para crear un delay para que descargue el mensaje original
  original = await new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const result = await browser.messages.query({
          headerMessageId: originalMessageId,
        });
        resolve(result); // Resolvemos la promesa con el resultado
      } catch (error) {
        reject(error); // Si ocurre un error, lo rechazamos
      }
    }, delay);
  });

  // Devolvemos los datos.
  return original;
}

async function SendITMailConfirmation(composeDetails, clientMail) {
  // Cambiamos el la dirección de destino
  composeDetails.to = IT_mails;

  // Creamos un nuevo cuerpo
  composeDetails.body = confirmationBody;

  // Cambiamos el subject
  composeDetails.subject = "Confirmación reenvio - Factura " + clientMail;

  // Creamos el correo
  let composeTab = await browser.compose.beginNew(composeDetails);

  // Lo enviamos
  await browser.compose.sendMessage(composeTab.id, { mode: "sendNow" });

  // Creamos el console log
  console.log("Correo de confirmación enviado a", IT_mails);
}

function PrepareLogFile() {
  return new File(logBuffer, "error.log", { type: "text/plain" });
}

async function SendErrorReport() {
  // Creamos el correo electrónico con el log.
  const errorDetails = {
    to: IT_mails,
    subject: "Error - Sistema automático de Reenvíos de Opera",
    body: "Se detectado un error al momento de reenviar un correo fallido de Opera. <br> En el fichero adjunto se puede consultar el registro generado.",
    attachments: [
      {
        file: PrepareLogFile(),
        name: "error.log",
      },
    ],
  };

  // Creamos la pestaña
  const errorTab = browser.compose.beginNew(errorDetails);

  // Enviamos el correo de error.
  await browser.compose.sendMessage(errorTab.id, { mode: "sendNow" });
}

browser.messages.onNewMailReceived.addListener(async (folder, data) => {
  // Iterar sobre los mensajes dentro de data.messages
  for (let message of data.messages) {
    try {
      // Asignando el valor vacíamos el buffer anterior.
      logBuffer = ["Procesando mensaje con asunto:", message.subject];
      console.log("Procesando mensaje con asunto:", message.subject);

      // Si no encuentra el asunto no pasa el filtro, salimos e ignoramos el correo
      if (!message.subject || !message.subject.includes(subjectFilter)) {
        // Registramos
        log(["No comple el filtro de Asunto, omitiendo mensaje..."]);
        console.log("No cumple el filtro de Asunto, omitiendo mensaje...");

        // No vamos a enviar un aviso a IT porque no es necesario, no se considera error.
        continue;
      }

      // Obtener el mensaje completo y su contenido
      let fullMessage = await browser.messages.getFull(message.id);

      // Guardamos y mostramos el mensaje completo
      log([JSON.stringify(fullMessage)]);
      console.log(fullMessage);

      // Recuperamos el contenido del cuerpo del email
      let replyBody = findEmailBody(fullMessage);

      // Filtramos por el mensaje de error de caracteres inválidos
      if (
        !replyBody.includes(bodyFilter) &&
        !replyBody.includes(bodyFilterDev)
      ) {
        // No vamos a informar porque no se considera error.
        log(["No incluye el codigo de error, omitiendo mensaje..."]);
        console.log("No incluye el codigo de error, omitiendo mensaje...");
        continue;
      }

      // Si no hay encabezado de respuesta salimos
      let inReplyToHeader = fullMessage.headers["in-reply-to"];

      if (!inReplyToHeader) {
        // Si se esta respondiendo a un correo anterior, salimos sin informar.
        log(["Falta encabezado 'In-Reply-To'."]);
        console.log("Falta encabezado 'In-Reply-To'.");
        continue;
      }

      // Extraer y limpiar el Message-ID desde la cabecera In-reply-To
      let originalMessageId = Array.isArray(inReplyToHeader)
        ? inReplyToHeader[0]
        : inReplyToHeader;
      originalMessageId = originalMessageId.replace(/^<|>$/g, "");

      // Comenzar el timeout para buscar el mensaje original.
      log([`Empezando timeout de ${delay / 1000} segundos`]);
      console.log("Empezando timeout de", delay / 1000, "segundos");

      let originalMessage = await GetDelayedInfo(originalMessageId);

      // Registramos el correo original
      log(["Mensaje original: ", JSON.stringify(originalMessage)]);
      console.log("Mensaje original:", originalMessage);

      // Si no esta el original salimos
      if (!originalMessage || !originalMessage.messages.length === 0) {
        // Registramos el error.
        log("Mensaje original no encontrado, omitiendo...");
        console.log("Mensaje original no encontrado, omitiendo...");

        // Antes de salir del bucle, mandamos un informe de error.
        SendErrorReport();
        continue;
      }

      // Sacamos el mensaje original de la busqueda
      let originalMsg = originalMessage.messages[0];

      // Obtenemos todos los datos del mensaje original
      let fullOriginal = await browser.messages.getFull(originalMsg.id);

      // Sacamos los adjuntos que sean pdf
      let parts_array = fullOriginal.parts[0];

      let attachments = parts_array.parts.filter(
        (att) => att.contentType.toLowerCase() === "application/pdf"
      );

      // Si no hay adjunto se omite
      if (attachments.length === 0) {
        // Registramos que no tiene PDF adjuntos
        log("No hay PDF adjunto, omitiendo...");
        console.log("No hay PDF adjunto, omitiendo...");

        // Enviamos un reporte a IT
        SendErrorReport();
        continue;
      }

      let pdfAttachment = attachments[0];

      // Descargar el archivo adjunto como un objeto File
      let file = await browser.messages.getAttachmentFile(
        originalMsg.id,
        pdfAttachment.partName
      );

      // Obtener la identidad (cuenta) desde la cual se enviará el correo
      let accounts = await browser.accounts.list();
      let identityId;

      // Sacamos el correo origen del correo inicial
      let rawOriginalMail = fullOriginal.headers.from[0].split(" ").pop();

      let originalMail = rawOriginalMail.replace(/^<|>$/g, "");

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
        log(
          "No se encontró la cuenta correcta para enviar el email, omitiendo..."
        );
        console.log(
          "No se encontró la cuenta correcta para enviar el email, omitiendo..."
        );

        // Enviamos el reporte a IT
        SendErrorReport();
        continue;
      }

      // Configurar los detalles del nuevo correo
      let composeDetails = {
        to: [fullOriginal.headers.to[0]], // Enviar al destinatario original
        subject: newSubject,
        body: newBody,
        attachments: [
          {
            file: file,
            name: "Invoice",
          },
        ],
        identityId: identityId,
      };

      // Crear y enviar el correo
      let composeTab = await browser.compose.beginNew(composeDetails);

      await browser.compose.sendMessage(composeTab.id, { mode: "sendNow" });
      console.log("Correo enviado con éxito.");

      // Enviamos el correo de confirmación
      await SendITMailConfirmation(composeDetails, fullOriginal.headers.to[0]);
    } catch (err) {
      console.error("Error:", err);
    }
  }
});
