'use client';

import { useState } from 'react';
import { jsonrepair } from 'jsonrepair';

export default function Home() {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [normalizedJsonText, setNormalizedJsonText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [repairApplied, setRepairApplied] = useState(false);
  const [repairedJsonText, setRepairedJsonText] = useState<string | null>(null);
  const [showRepairedJson, setShowRepairedJson] = useState(false);
  const [copiedRepaired, setCopiedRepaired] = useState(false);
  const [truncationWarning, setTruncationWarning] = useState<string | null>(null);

  /**
   * normalizeJsonText
   * - Reemplaza comillas tipográficas por comillas rectas
   * - Reemplaza comillas simples tipográficas por comillas simples rectas
   * - Reemplaza guion largo/en-dash (–, —) por '-' solo dentro de keys (strings seguidos de `:`)
   * - No altera tildes ni la letra `ñ`
   * - No borra saltos de línea
   *
   * Ejemplos (tests en comentarios):
   * - “naming”  => "naming"
   * - '‘clave–con–guion’:' => '"clave-con-guion":' (guiones en keys se normalizan)
   * - ...\"taquillero\"...  => debe permanecer con escapes tal cual
   */
  const normalizeJsonText = (input: string): string => {
    if (!input) return input;

    // 1) Reemplazar comillas tipográficas dobles y simples por rectas
    let text = input.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

    // 2) Reemplazar guiones largos/en-dash dentro de keys (strings seguidos por :) por '-' 
    // Esto evita tocar guiones que formen parte del contenido textual donde no causan problemas.
    try {
      text = text.replace(/(["'])(.*?)\1(?=\s*:)/gs, (match, quote, inner) => {
        const replaced = inner.replace(/[\u2013\u2014]/g, '-');
        return `${quote}${replaced}${quote}`;
      });
    } catch (e) {
      // En entornos donde no se soporta la flag 's', fallback más simple
      text = text.replace(/(["'])(.*?)\1(?=\s*:)/g, (match: string, quote: string, inner: string) => {
        const replaced = inner.replace(/[\u2013\u2014]/g, '-');
        return `${quote}${replaced}${quote}`;
      });
    }

    return text;
  };

  /**
   * extractJsonFromText
   * - Extrae JSON de texto que puede contener prefijos/sufijos
   * - Busca el primer { y el último } para aislar el JSON
   * - Ignora texto externo, markdown fences, etc.
   */
  const extractJsonFromText = (input: string): string => {
    if (!input) return input;

    // Buscar el primer { y el último }
    const firstBrace = input.indexOf('{');
    const lastBrace = input.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      return input; // No hay JSON detectado, devolver original
    }

    return input.substring(firstBrace, lastBrace + 1);
  };

  /**
   * sanitizeJsonString
   * - Elimina BOM (Byte Order Mark)
   * - Elimina caracteres zero-width invisibles
   * - Normaliza saltos de línea a \n
   */
  const sanitizeJsonString = (input: string): string => {
    if (!input) return input;

    let text = input;

    // 1) Eliminar BOM (U+FEFF)
    text = text.replace(/^\uFEFF/, '');

    // 2) Eliminar caracteres zero-width invisibles
    text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

    // 3) Normalizar saltos de línea a \n
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    return text;
  };

  /**
   * parseJsonRobust
   * - Parsea JSON con tolerancia a errores comunes
   * - Intenta parseo en dos fases (para manejar double-stringified JSON)
   */
  const parseJsonRobust = (jsonString: string): any => {
    // Primera fase: parseo normal
    let parsed = JSON.parse(jsonString);

    // Segunda fase: si el resultado es un string que parece JSON, parsear otra vez
    if (typeof parsed === 'string' && parsed.trim().startsWith('{')) {
      parsed = JSON.parse(parsed);
    }

    return parsed;
  };

  /**
   * getErrorContext
   * - Extrae un snippet del JSON cerca de donde ocurrió el error
   * - Útil para debugging
   */
  const getErrorContext = (jsonString: string, error: SyntaxError): string => {
    const errorMessage = error.message;
    
    // Intentar extraer la posición del error
    const positionMatch = errorMessage.match(/position (\d+)/);
    if (positionMatch) {
      const position = parseInt(positionMatch[1], 10);
      const start = Math.max(0, position - 50);
      const end = Math.min(jsonString.length, position + 50);
      const snippet = jsonString.substring(start, end);
      return `\n\nContexto cerca del error:\n...${snippet}...`;
    }

    // Si no se puede extraer posición, mostrar las primeras líneas
    const lines = jsonString.split('\n').slice(0, 5);
    return `\n\nPrimeras líneas del JSON:\n${lines.join('\n')}...`;
  };

  /**
   * detectIncompleteJson
   * - Verifica si el JSON está truncado o incompleto
   */
  const detectIncompleteJson = (jsonString: string): string | null => {
    const openBraces = (jsonString.match(/{/g) || []).length;
    const closeBraces = (jsonString.match(/}/g) || []).length;
    const openBrackets = (jsonString.match(/\[/g) || []).length;
    const closeBrackets = (jsonString.match(/]/g) || []).length;

    if (openBraces > closeBraces) {
      return `JSON incompleto: faltan ${openBraces - closeBraces} llaves de cierre }`;
    }
    if (closeBraces > openBraces) {
      return `JSON mal formado: ${closeBraces - openBraces} llaves de cierre } de más`;
    }
    if (openBrackets > closeBrackets) {
      return `JSON incompleto: faltan ${openBrackets - closeBrackets} corchetes de cierre ]`;
    }
    if (closeBrackets > openBrackets) {
      return `JSON mal formado: ${closeBrackets - openBrackets} corchetes de cierre ] de más`;
    }

    return null;
  };

  /**
   * repairJsonIfNeeded
   * - Intenta reparar JSON malformado usando jsonrepair
   * - Soluciona: trailing commas, comillas simples, comentarios, llaves sin cerrar, valores sin comillas
   * - Retorna el string reparado y si hubo cambios
   * - Nunca lanza error: si la reparación falla, retorna el input original
   */
  const repairJsonIfNeeded = (input: string): { repaired: string; wasRepaired: boolean } => {
    try {
      const repaired = jsonrepair(input);
      const wasRepaired = repaired !== input;
      return { repaired, wasRepaired };
    } catch {
      return { repaired: input, wasRepaired: false };
    }
  };

  /**
   * detectTruncation
   * - Detecta señales de que el GPT truncó su respuesta (solo para AC)
   * - No bloquea la generación, solo advierte al usuario
   */
  const detectTruncation = (parsed: any): string | null => {
    const prefijo = parsed.naming?.filename?.substring(0, 2).toUpperCase();
    const isAC = prefijo === 'AC' || parsed.naming?.tipo_archivo === 'ACTA_REUNION';
    if (!isAC || !parsed.contenido) return null;

    const c = parsed.contenido;
    const warnings: string[] = [];

    if (!c.temas_tratados_texto || c.temas_tratados_texto.length < 100) {
      warnings.push('"temas_tratados_texto" está vacío o muy corto');
    }
    if (!c.orden_del_dia || c.orden_del_dia.length < 2) {
      warnings.push('"orden_del_dia" tiene menos de 2 ítems');
    }

    if (warnings.length === 0) return null;
    return `Posible respuesta truncada del GPT: ${warnings.join(' y ')}. El documento se generará, pero puede estar incompleto. Si la reunión fue larga, prueba pedir al GPT que continúe la respuesta, o divide la transcripción en partes.`;
  };

  const handleGenerate = async () => {
    setError('');
    setSuccess(false);
    setRepairApplied(false);
    setRepairedJsonText(null);
    setShowRepairedJson(false);
    setTruncationWarning(null);
    setLoading(true);

    try {
      // FASE 1: Extraer JSON de texto que puede contener prefijos/sufijos
      let extracted = extractJsonFromText(jsonInput);

      // FASE 2: Sanitizar el string (BOM, zero-width, etc.)
      let sanitized = sanitizeJsonString(extracted);

      // FASE 3: Normalizar comillas tipográficas y guiones
      const normalized = normalizeJsonText(sanitized);
      setNormalizedJsonText(normalized);

      // FASE 4: Reparar automáticamente JSON con errores de sintaxis comunes del GPT
      const { repaired, wasRepaired } = repairJsonIfNeeded(normalized);
      if (wasRepaired) {
        setRepairApplied(true);
        setRepairedJsonText(repaired);
      }
      const jsonToParse = repaired;

      // FASE 5: Intentar parsear el JSON con tolerancia a double-stringified
      let parsedJson: any;
      try {
        parsedJson = parseJsonRobust(jsonToParse);
      } catch (parseErr) {
        const errMsg = parseErr instanceof SyntaxError ? parseErr.message : 'Error desconocido';
        const context = parseErr instanceof SyntaxError ? getErrorContext(jsonToParse, parseErr) : '';
        setError(
          `JSON inválido incluso después de reparación automática. Error: ${errMsg}${context}\n\n` +
          `Si pegaste desde Word o iPhone, usa el botón "Copiar JSON normalizado" para ver el texto procesado.`
        );
        setLoading(false);
        return;
      }

      // FASE 6: Validar estructura (naming.filename SIEMPRE obligatorio)
      if (!parsedJson.naming?.filename) {
        setError('Error: El campo "naming.filename" es obligatorio.');
        setLoading(false);
        return;
      }

      // Detectar prefijo del archivo (primeras 2 letras del filename)
      const filename = parsedJson.naming.filename;
      const prefijo = filename.substring(0, 2).toUpperCase();

      // FASE 7: Validar contenido solo si es AC o ACTA_REUNION
      const requiresContent = prefijo === 'AC' || parsedJson.tipo_archivo === 'ACTA_REUNION';
      if (requiresContent && !parsedJson.contenido) {
        setError('Error: El campo "contenido" es obligatorio para actas de reunión (prefijo AC o tipo_archivo ACTA_REUNION).');
        setLoading(false);
        return;
      }

      // FASE 8: Detectar posible truncamiento del GPT (advertencia, no bloquea)
      const truncWarning = detectTruncation(parsedJson);
      if (truncWarning) {
        setTruncationWarning(truncWarning);
      }

      // Llamar al API
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedJson),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al generar el documento');
      }

      // Descargar el archivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Obtener el nombre del archivo del header Content-Disposition
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const downloadFilename = filenameMatch ? filenameMatch[1] : parsedJson.naming?.filename || 'documento.docx';
      
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);

    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('JSON inválido. Por favor verifica el formato.');
      } else {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setJsonInput('');
    setError('');
    setSuccess(false);
    setNormalizedJsonText(null);
    setCopied(false);
    setRepairApplied(false);
    setRepairedJsonText(null);
    setShowRepairedJson(false);
    setCopiedRepaired(false);
    setTruncationWarning(null);
  };

  const copyNormalizedToClipboard = async () => {
    if (!normalizedJsonText) return;
    try {
      await navigator.clipboard.writeText(normalizedJsonText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError('No se pudo copiar al portapapeles');
    }
  };

  const exampleJson = {
    naming: {
      filename: "AC19012026 Seguimiento Medellin.docx"
    },
    contenido: {
      // ... ejemplo de estructura
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-xl shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Generador de Actas</h1>
              <p className="text-sm text-gray-600 mt-1">Transforma tus datos JSON en documentos Word profesionales</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Instructions */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ¿Cómo usar?
              </h2>
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">1</span>
                  <span>Pega tu JSON en el área de texto</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">2</span>
                  <span>Verifica que el formato sea válido</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">3</span>
                  <span>Haz clic en "Generar Documento"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">4</span>
                  <span>Tu documento se descargará automáticamente</span>
                </li>
              </ol>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Características
              </h3>
              <ul className="space-y-2 text-sm opacity-90">
                <li>✓ Generación instantánea</li>
                <li>✓ Formato Word (.docx)</li>
                <li>✓ Reparación automática de JSON</li>
                <li>✓ Normalización de comillas tipográficas</li>
                <li>✓ Detección de respuesta truncada</li>
                <li>✓ Plantillas personalizables</li>
              </ul>
            </div>
          </div>

          {/* Right Column - JSON Editor */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <label htmlFor="jsonInput" className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Editor JSON
                  </label>
                  {jsonInput && (
                    <button
                      onClick={handleClear}
                      className="text-xs text-gray-600 hover:text-gray-900 font-medium px-3 py-1.5 rounded-lg hover:bg-white transition-colors"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
              
              <div className="p-6">
                <textarea
                  id="jsonInput"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  className="w-full h-[500px] px-4 py-3 border-2 border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-gray-50 hover:bg-white transition-colors resize-none"
                  placeholder={JSON.stringify(exampleJson, null, 2)}
                />
              </div>

              {/* Status Messages */}
              <div className="px-6 pb-6 space-y-3">

                {/* Banner: JSON reparado automáticamente */}
                {repairApplied && (
                  <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded-lg">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm text-amber-800 font-medium">
                          Se detectó y reparó automáticamente JSON con formato incorrecto. El documento se generó con el JSON corregido.
                        </p>
                        <button
                          onClick={() => setShowRepairedJson(prev => !prev)}
                          className="mt-2 text-xs text-amber-700 underline hover:text-amber-900"
                        >
                          {showRepairedJson ? 'Ocultar JSON reparado' : 'Ver JSON reparado'}
                        </button>
                        {showRepairedJson && repairedJsonText && (
                          <div className="mt-3">
                            <textarea
                              readOnly
                              value={repairedJsonText}
                              className="w-full h-48 px-3 py-2 border border-amber-300 rounded-lg font-mono text-xs bg-white resize-none"
                            />
                            <button
                              onClick={async () => {
                                await navigator.clipboard.writeText(repairedJsonText);
                                setCopiedRepaired(true);
                                setTimeout(() => setCopiedRepaired(false), 2000);
                              }}
                              className="mt-2 inline-flex items-center gap-2 text-xs px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              {copiedRepaired ? '✓ Copiado' : 'Copiar JSON reparado'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Banner: Posible truncamiento del GPT */}
                {truncationWarning && (
                  <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded-lg">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <p className="text-sm text-orange-800">{truncationWarning}</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg animate-in slide-in-from-top">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm text-red-800 font-medium">{error}</p>
                        {normalizedJsonText && (
                          <div className="mt-3 flex items-center gap-3">
                            <button
                              onClick={copyNormalizedToClipboard}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-900 text-xs font-semibold rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copiar JSON normalizado
                            </button>
                            {copied && <span className="text-sm text-green-700 font-medium">✓ Copiado</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-lg animate-in slide-in-from-top">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-green-800 font-medium">¡Documento generado exitosamente!</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={loading || !jsonInput.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed font-semibold transition-all shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-[1.02] disabled:transform-none flex items-center justify-center gap-3 text-lg"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Generando documento...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      <span>Generar Documento</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-sm text-gray-500">
          <p>Generador de Actas · Next.js 14 + docxtemplater</p>
        </div>
      </div>
    </div>
  );
}
