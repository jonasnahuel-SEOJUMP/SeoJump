/**
 * Validación/sanitización de entradas del usuario y logging de errores.
 * Módulo puro extraído de actions.ts.
 */

import fs from 'fs';
import path from 'path';
import { captureAppError } from './sentry';

/**
 * Sanitiza y valida las entradas del usuario (keywords y URLs) antes de ser procesadas.
 */
export function sanitizeInput(
  text: string,
  type: 'keyword' | 'url'
): { isValid: boolean; sanitized: string; error?: string } {
  if (!text || !text.trim()) {
    return {
      isValid: false,
      sanitized: "",
      error: `La entrada del ${type === 'keyword' ? 'término de búsqueda' : 'sitio web'} está vacía o contiene solo espacios.`,
    };
  }

  const clean = text.trim();

  if (type === 'keyword') {
    // Permitir letras, números, espacios y acentos comunes
    const cleanKeyword = clean.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, "");
    if (cleanKeyword.length < 2) {
      return {
        isValid: false,
        sanitized: clean,
        error: "La palabra clave es demasiado corta. Debe tener al menos 2 caracteres válidos.",
      };
    }
    if (cleanKeyword.length > 80) {
      return {
        isValid: false,
        sanitized: clean,
        error: "La palabra clave es demasiado larga. Por favor usa un término de hasta 80 caracteres.",
      };
    }
    return { isValid: true, sanitized: cleanKeyword };
  } else {
    const cleanUrl = clean.toLowerCase();
    // Expresión regular para validar dominio o URL básico
    const domainRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z]{2,10})([/\w .-]*)*\/?$/;
    if (!domainRegex.test(cleanUrl)) {
      return {
        isValid: false,
        sanitized: clean,
        error: "La URL ingresada no es válida. Asegurate de usar un formato de dominio correcto (ej: miweb.com).",
      };
    }
    return { isValid: true, sanitized: cleanUrl };
  }
}

/**
 * Guarda un registro persistente del error en un archivo JSON local en el servidor.
 */
export function logErrorToFile(
  actionName: string,
  input: any,
  status: string | number,
  message: string
) {
  try {
    const logFilePath = path.join(process.cwd(), "error_log.json");
    const logEntry = {
      action: actionName,
      input,
      timestamp: new Date().toISOString(),
      status: String(status),
      message: message || "Error desconocido",
    };

    let logs: any[] = [];
    if (fs.existsSync(logFilePath)) {
      try {
        const fileContent = fs.readFileSync(logFilePath, "utf8");
        logs = JSON.parse(fileContent);
        if (!Array.isArray(logs)) {
          logs = [];
        }
      } catch (parseErr) {
        console.error("Error parsing existing error_log.json, resetting:", parseErr);
        logs = [];
      }
    }

    logs.push(logEntry);

    // Conservar solo los últimos 100 registros para evitar crecimiento infinito
    if (logs.length > 100) {
      logs = logs.slice(logs.length - 100);
    }

    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), "utf8");
    console.log(`[API Log] Error guardado exitosamente en error_log.json para acción ${actionName}`);

    captureAppError(new Error(message || "Error desconocido"), {
      action: actionName,
      input,
      status: String(status),
      source: "logErrorToFile",
    });
  } catch (fsErr) {
    console.error("No se pudo escribir en error_log.json:", fsErr);
    captureAppError(fsErr, { action: actionName, source: "logErrorToFile_write_failed" });
  }
}
