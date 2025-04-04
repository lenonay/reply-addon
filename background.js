// Variables globales de configuración
const mails = {
  sourceMail: "noreply@grupocio.onmicrosoft.com",
  IT_mails: ["jcarlos.perez@bahia-duque.com", "daniel.garcia@bahia-duque.com"],
  reception: ["diegolagerms@gmail.com"],
};

const mailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

const subjectFilter = "Undeliverable:";

const bodyFilters = {
  BDAT: "Your message contains invalid characters (bare line feed characters)",
  BDAT_dev: "cola_BDAT",
  DNS: "wasn't found at",
  DNS_var:
    "The Domain Name System (DNS) reported that the recipient's domain does not exist.",
  DNS_dev: "cola_DNS",
  SPF: "Security or policy settings at",
  SPF_dev: "cola_SPF",
};

const subjectTemplates = {
  BDAT: "Hotel Bahia del Duque - Factura / Invoice",
  DNS: "Error de Envío - Sistema automático de Reenvíos de Opera",
  SPF: "Error de Envío - Sistema automático de Reenvíos de Opera",
  NotFound: "Error de Envío - Sistema automático de Reenvíos de Opera",
  report: "Error Fatal - Sistema automático de Reenvíos de Opera",
  confirmation: "Confirmación reenvio - Factura ",
};

const bodyTemplates = {
  BDAT: `Estimado cliente,
  <br>Muchas gracias por haber confiado en The Tais Bahia Del Duque.
  <br>Adjunto encontrará su factura.
  <br>Esperamos volver a verles de nuevo.
  <br>Un cordial saludo,
  <br><br>(Este mensaje de correo electrónico ha sido enviado desde una herramienta automática, no responda a este mensaje)
  
  <br><br><br>
  Dear guest,
  <br>Many thanks for your trust towards The Tais Bahia Del Duque.
  <br>Attached you will find your invoice.
  <br>We look forward to seeing you again
  <br>Kind regards,
  <br><br>(Please, do not reply to this mail)`,

  DNS: (clientMail) => {
    return `Ha fallado el envío de la factura al cliente:  
    <b>${clientMail}</b>.<br>Por alguno de los siguientes motivos:
    <br><ul><li>La dirección de correo electrónico está mal escrita o incompleta.</li><li>La dirección de correo no existe.</li></ul>
    <br><b>SOLUCIÓN:</b>
    <br>Revise el email del cliente y reenvie la factura a traves de Outlook.
    <br><br>Atentamente.`;
  },
  SPF: (clientMail) => {
    return `Ha fallado el envío de la factura al cliente: 
    <b>${clientMail}</b>. Por el siguiente motivo:
    <br><ul><li>Las configuración de las políticas de seguridad de la cuenta del cliente impiden el envío a esa dirección desde Opera.</li></ul>
    <br><b>SOLUCIÓN:</b>
    <br>Debe reenviar la factura a través de Outlook.
    <br><br>Atentamente.`;
  },
  NotFound: (clientMail) => {
    return `Ha fallado el envío de la factura al cliente: 
    <b>${clientMail}</b>.
    <br><br>Se realizó el envío el ${GetExecutionTime()}
    <br><br><b>SOLUCIÓN:</b>
    <br>Debe reenviar la factura a través de Outlook.
    <br><br>Atentamente.`;
  },
  confirmation:
    "Se ha detectado un error durante el envío. Se ha corregido y enviado la factura al cliente.<br><br>Atentamente, el departamento de Informática",
};

// Buffer de logs
let logBuffer = []; // Estructura [["texto", variable], ["texto", variable]]
const log = (register) => logBuffer.push(register, "\n\n\n");

// Timeout Para crear Delay
const delay = 1000 * 65;

//////////// FUNCIONES
function SearchForPart(object, key, wanted_value) {
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
      value = SearchForPart(object[k], key, wanted_value);
      // Devolvemos el valor si no es undefined
      return value !== undefined;
    }
  });

  // Retornamos el valor
  return value;
}

function findEmailBody(message) {
  const mailBody = SearchForPart(message, "contentType", "text/plain");

  // Si conseguimos encontrar el texto plano devolvemos el cuerpo sino, devolvemos null
  return mailBody ? mailBody.body : null;
}

function findAttachment(message) {
  const attachments = SearchForPart(message, "contentType", "application/pdf");

  return attachments;
}

async function GetDelayedInfo(originalMessageId) {
  // Inicializamos una variable donde almacenar el mensaje original con la factura.
  let original = undefined;

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

  log(`temp: ${JSON.stringify(original)}`);
  console.log("temp:", original);

  // Devolvemos los datos.
  return typeof original === "object" ? original.messages[0] : null;
}

async function SendITMailConfirmation(composeDetails) {
  // Cambiamos el subject
  composeDetails.subject = subjectTemplates.confirmation + composeDetails.to;

  // Creamos un nuevo cuerpo
  composeDetails.body = bodyTemplates.confirmation;

  // Cambiamos el la dirección de destino
  composeDetails.to = mails.IT_mails;

  // Borramos la factura adjunta
  delete composeDetails.attachments;

  // Creamos el correo
  let composeTab = await browser.compose.beginNew(composeDetails);

  // Lo enviamos
  await browser.compose.sendMessage(composeTab.id, { mode: "sendNow" });

  // Creamos el console log
  console.log("Correo de confirmación enviado a", mails.IT_mails);
}

function PrepareLogFile() {
  return new File(logBuffer, "error.log", { type: "text/plain" });
}

function GetExecutionTime(){
  const currentDate = new Date();

  const executionTime = new Date(currentDate - delay);

  return executionTime.toLocaleString();
}

async function SendErrorReport() {
  // Creamos el correo electrónico con el log.
  const errorDetails = {
    to: mails.IT_mails,
    subject: subjectTemplates.report,
    body: "Se detectado un error al momento de reenviar un correo fallido de Opera. <br> En el fichero adjunto se puede consultar el registro generado.",
    attachments: [
      {
        file: PrepareLogFile(),
        name: "error-log.txt",
      },
    ],
  };

  // Creamos la pestaña
  const errorTab = await browser.compose.beginNew(errorDetails);

  // Enviamos el correo de error.
  await browser.compose.sendMessage(errorTab.id, { mode: "sendNow" });
}

function GetInReplyToID(message) {
  // Si no hay encabezado de respuesta salimos
  let inReplyToHeader = message.headers["in-reply-to"];

  if (!inReplyToHeader) {
    // Si se esta respondiendo a un correo anterior, salimos sin informar.
    log(["Falta encabezado 'In-Reply-To'."]);
    console.log("Falta encabezado 'In-Reply-To'.");
  }

  // Extraer y limpiar el Message-ID desde la cabecera In-reply-To
  let originalMessageId = Array.isArray(inReplyToHeader)
    ? inReplyToHeader[0]
    : inReplyToHeader;

  // Devolvemos el ID del mensaje
  return originalMessageId.replace(/^<|>$/g, "");
}

async function ExtractPDF(originalMessage, originalMessageID) {
  // Sacamos los elementos adjuntos
  const attachments = findAttachment(originalMessage);

  // Registramos en el buffer los archivos adjuntos
  log(["Adjuntos", attachments]);
  console.log("Adjuntos: ", attachments);

  // Si no hay adjunto se omite
  if (!attachments || attachments.length === 0) {
    // Registramos que no tiene PDF adjuntos
    log(["No hay PDF adjunto, omitiendo..."]);
    console.log("No hay PDF adjunto, omitiendo...");

    // Enviamos un reporte a IT
    SendErrorReport();
    return;
  }

  // Descargar el archivo adjunto como un objeto File y lo devolvemos
  return await browser.messages.getAttachmentFile(
    originalMessageID,
    attachments.partName
  );
  
}

async function GetAccountIdentity(fromHeader) {
  // Obtener la identidad (cuenta) desde la cual se enviará el correo.
  let accounts = await browser.accounts.list();
  let identityId;

  // Sacamos el correo origen del correo inicial.
  let rawOriginalMail = fromHeader[0].split(" ").pop();

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
    log([
      "No se encontró la cuenta correcta para enviar el email, omitiendo...",
    ]);
    console.log(
      "No se encontró la cuenta correcta para enviar el email, omitiendo..."
    );

    // Enviamos el reporte a IT.
    SendErrorReport();
    return;
  }

  // Devolvemos la identidad de la cuenta.
  return identityId;
}

async function NotifyReception(composeDetails) {
  // Borramos la factura adjunta
  delete composeDetails.attachments;

  // Cambiamos la direccion de envio uniendo las direcciones de correo de recepcion a las de IT
  composeDetails.to = mails.IT_mails.concat(mails.reception);

  // Enviamos el mensaje
  await SendMessage(composeDetails);
}

async function SendMessage(composeDetails) {
  // Crear y enviar el correo
  const composeTab = await browser.compose.beginNew(composeDetails);

  await browser.compose.sendMessage(composeTab.id, { mode: "sendNow" });
  console.log("Correo enviado con éxito.");
}

async function OriginalNotFound(message){
  // Recuperamos el cuerpo del correo
  const mailBody = findEmailBody(message);

  // Ejecutamos la regex para recuperar el email del cliente
  const clientMail = mailBody.match(mailRegex);

  if(!clientMail){
    // Si no hay salimos, no deberia de ocurrir nunca
    return
  }

  // Recuperamos la identidad de la cuenta de noreply
  const accountIdentity = await GetAccountIdentity(message.headers.to);

  const composeDetails = {
    to: mails.IT_mails.concat(mails.reception), // Enviamos a IT y a Recepción
    subject: subjectTemplates.NotFound,
    body: bodyTemplates.NotFound(clientMail),
    identityId: accountIdentity,
  }

  // Enviamos el mensaje
  SendMessage(composeDetails);
}

async function CreateMessage(messageFull) {
  const originalMessageID = GetInReplyToID(messageFull);

  const originalMessage = await GetDelayedInfo(originalMessageID);

  // Registramos el correo original
  log(["Mensaje original: ", JSON.stringify(originalMessage)]);
  console.log("Mensaje original:", originalMessage);

  // Si no esta el original salimos
  if (!originalMessage || originalMessage.length === 0) {
    // Registramos el error.
    log("Mensaje original no encontrado, procesando...");
    console.log("Mensaje original no encontrado, procesando...");

    // Procesamos el mensaje para informar de que no se encontró el original.
    OriginalNotFound(messageFull);

    // Salimos de la función ya que el nuevo flujo se encarga de todo.
    return;
  }

  // Obtenemos todos los datos del mensaje original
  const fullOriginal = await browser.messages.getFull(originalMessage.id);

  log(["Mensaje original completo:", fullOriginal]);
  console.log("Mensaje original completo: ", fullOriginal);

  // Buscamos y extramos los archivos pdf adjuntos
  const pdfFile = await ExtractPDF(fullOriginal, originalMessage.id);

  // Si no se encontró el pdf, salimos porque ya se mostro el error previamente.
  if (!pdfFile) return;

  // Buscamos el correo original desde donde se envío, es decir nuestra cuenta.
  const identityId = await GetAccountIdentity(fullOriginal.headers.from);

  // Configurar los detalles del nuevo correo y lo devolvemos.
  return {
    to: [fullOriginal.headers.to[0]], // Enviar al destinatario original
    subject: subjectTemplates.BDAT,
    body: bodyTemplates.BDAT,
    attachments: [
      {
        file: pdfFile,
        name: "Invoice.pdf",
      },
    ],
    identityId: identityId,
  };
}

async function ProcessBDAT(message) {
  // Recuperamos el ID del mensaje original
  const composeDetails = await CreateMessage(message);

  // Si no hay detalles de envio salimos porque entonces falló el proceso en algún punto
  if (!composeDetails) return;

  // Enviamos el mensaje al cliente
  await SendMessage(composeDetails);

  // Anulado para evitar el envío
  // Enviamos la confirmación de envio
  // await SendITMailConfirmation(composeDetails);
}

async function ProcessDNS(message) {
  // Creamos y cargamos el mail
  const composeDetails = await CreateMessage(message);

  // Verificamos que todo el proceso haya ido bien, sino reportamos a IT
  if (!composeDetails) return;

  // Recuperamos la dirección de correo del cliente para añadirla al cuerpo del email
  const clientMail = composeDetails.to[0];

  // Cambiamos el asunto al error de DNS
  composeDetails.subject = subjectTemplates.DNS;

  // Cambiamos el cuerpo incluyendo el mensaje
  composeDetails.body = bodyTemplates.DNS(clientMail);

  // Notificamos a recepción
  await NotifyReception(composeDetails);
}

async function ProcessSPF(message) {
  // Creamos y generamos el mail de entrega
  const composeDetails = await CreateMessage(message);

  // Verificamos que se haya generado el correo de forma correcta.
  if (!composeDetails) return;

  // Recuperamos la dirección de correo del cliente
  const clientMail = composeDetails.to[0];

  // Cambiamos el asunto
  composeDetails.subject = subjectTemplates.SPF;

  // Cambiamos el cuerpo del mensaje incluyendo el email del cliente
  composeDetails.body = bodyTemplates.SPF(clientMail);

  // Notificamos a recepción
  await NotifyReception(composeDetails);
}

browser.messages.onNewMailReceived.addListener(async (folder, data) => {
  // Iterar sobre los mensajes dentro de data.messages
  for (let message of data.messages) {
    try {
      // Permite mayor legibilidad en la consola
      console.log("-----------------------------");

      const fecha = new Date();

      // Asignando el valor vacíamos el buffer anterior. Y creamos un time stamp
      logBuffer = ["Timestamp", fecha.toLocaleString()];
      console.log("Timestamp", fecha.toLocaleString());

      // Comenzamos procesando el asunto del mensaje
      log(["Procesando mensaje con asunto:", message.subject]);
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
      log(["Mensaje recibido", JSON.stringify(fullMessage)]);
      console.log("Mensaje recibido", fullMessage);

      // Recuperamos el contenido del cuerpo del email
      let replyBody = findEmailBody(fullMessage);

      // Comenzar el timeout para generar tiempo antes de buscar el email original
      log([`Empezando timeout de ${delay / 1000} segundos`]);
      console.log("Empezando timeout de", delay / 1000, "segundos");

      switch (true) {
        // Fallos de BDAT (caracteres insuales no soportados)
        case replyBody.includes(bodyFilters.BDAT) ||
          replyBody.includes(bodyFilters.BDAT_dev):
          await ProcessBDAT(fullMessage);
          break;
        // Email no encontrado o inexistente
        case replyBody.includes(bodyFilters.DNS) ||
          replyBody.includes(bodyFilters.DNS_var) ||
          replyBody.includes(bodyFilters.DNS_dev):
          await ProcessDNS(fullMessage);
          break;
        // Fallos en la política de seguridad
        case replyBody.includes(bodyFilters.SPF) ||
          replyBody.includes(bodyFilters.SPF_dev):
          await ProcessSPF(fullMessage);
          break;
        default:
          // No vamos a informar porque no se considera error.
          log(["No incluye el codigo de error, omitiendo mensaje..."]);
          console.log("No incluye el codigo de error, omitiendo mensaje...");
          break;
      }
    } catch (err) {
      log(["Error catastrófico: ", err]);
      console.error("Error:", err);

      SendErrorReport();
    }
  }
});
