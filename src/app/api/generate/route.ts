import { NextRequest, NextResponse } from 'next/server';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { readFileSync } from 'fs';
import { join } from 'path';

interface Compromiso {
  no: number | string;
  compromiso: string;
  responsable: string;
  fecha_logro: string;
  estado?: string;
  resultado?: string;
}

interface Contenido {
  codigo_reunion: string;
  tipo_reunion: string;
  fecha_reunion: string;
  organismo: string;
  fecha_elaboracion: string;
  asistentes_texto: string;
  ausentes_texto: string;
  orden_del_dia: string[];
  temas_tratados_texto: string;
  proposiciones_y_varios: string;
  nombre_elabora: string;
  nombre_revisa: string;
  compromisos_pactados: Compromiso[];
}

interface RequestBody {
  naming: {
    filename: string;
  };
  contenido: Contenido;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();

    // Validar estructura del JSON
    if (!body.naming?.filename || !body.contenido) {
      return NextResponse.json(
        { error: 'Estructura JSON inválida. Se requiere naming.filename y contenido.' },
        { status: 400 }
      );
    }

    // Leer la plantilla
    const templatePath = join(process.cwd(), 'templates', 'acta_ac_template.docx');
    
    console.info('\n📄 PLANTILLA DOCX:');
    console.info('Ruta:', templatePath);
    
    let content: Buffer;
    
    try {
      content = readFileSync(templatePath);
      console.info(`Tamaño: ${content.length} bytes (${(content.length / 1024).toFixed(2)} KB)`);
      console.info('✓ Cargada correctamente\n');
    } catch (error) {
      return NextResponse.json(
        { error: 'No se encontró la plantilla. Asegúrate de que existe /templates/acta_ac_template.docx' },
        { status: 500 }
      );
    }

    // Preparar datos - SOLO campos de la nueva estructura
    const data = {
      codigo_reunion: body.contenido.codigo_reunion || '',
      tipo_reunion: body.contenido.tipo_reunion || '',
      fecha_reunion: body.contenido.fecha_reunion || '',
      organismo: body.contenido.organismo || '',
      fecha_elaboracion: body.contenido.fecha_elaboracion || '',
      asistentes_texto: body.contenido.asistentes_texto || '',
      ausentes_texto: body.contenido.ausentes_texto || '',
      orden_del_dia: Array.isArray(body.contenido.orden_del_dia) 
        ? body.contenido.orden_del_dia.map((item, index) => 
            `${index + 1}. ${item}`
          )
        : [],
      temas_tratados_texto: body.contenido.temas_tratados_texto || '',
      proposiciones_y_varios: body.contenido.proposiciones_y_varios || '',
      compromisos_pactados: Array.isArray(body.contenido.compromisos_pactados) && body.contenido.compromisos_pactados.length > 0
        ? body.contenido.compromisos_pactados
        : [],
      nombre_elabora: body.contenido.nombre_elabora || '',
      nombre_revisa: body.contenido.nombre_revisa || ''
    };

    console.log('\n📋 DATOS:');
    console.log('Orden del día:', data.orden_del_dia);
    console.log('Compromisos pactados:', data.compromisos_pactados.length, 'items\n');

    // Cargar el documento con PizZip
    const zip = new PizZip(content);

    // Crear instancia de docxtemplater
    let doc;
    try {
      doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '[[',
          end: ']]'
        },
        parser: (tag: string) => ({
          get: (scope: any, context: any) => {
            if (tag === '.') {
              return scope;
            }
            return scope[tag];
          }
        })
      });
    } catch (error: any) {
      // Si hay errores de tags, dar información simple y clara
      if (error.properties && error.properties.errors) {
        const tagErrors = error.properties.errors.map((e: any) => {
          const tag = e.properties.xtag || '';
          const explanation = e.properties.explanation || '';
          return `- Tag "${tag}": ${explanation}`;
        }).slice(0, 5); // Solo mostrar los primeros 5 errores
        
        console.error('\n❌ ERROR EN LA PLANTILLA:');
        console.error('═'.repeat(60));
        tagErrors.forEach((err: string) => console.error(err));
        console.error('═'.repeat(60));
        console.error('\n💡 SOLUCIÓN:');
        console.error('1. En Google Docs, separa los tags {/...} en su propia fila');
        console.error('2. No mezcles {{tags}} con {#loops} en la misma celda');
        console.error('3. Descarga de nuevo como .docx y reemplaza el archivo\n');
        
        return NextResponse.json(
          { 
            error: 'La plantilla tiene tags mal formados',
            details: tagErrors.join('\n') + '\n\nRevisa la terminal para más información.'
          },
          { status: 500 }
        );
      }
      throw error;
    }

    // Reemplazar los datos
    doc.render(data);

    // Generar el documento
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // Sanitizar el nombre del archivo
    const sanitizedFilename = body.naming.filename
      .replace(/[^a-zA-Z0-9\s._-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Convertir Buffer a Uint8Array para compatibilidad con Vercel
    const uint8Array = new Uint8Array(buffer);

    // Retornar el archivo
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
      },
    });

  } catch (error) {
    console.error('\n❌ ERROR AL GENERAR DOCUMENTO:');
    console.error('═'.repeat(60));
    console.error(error instanceof Error ? error.message : 'Error desconocido');
    console.error('═'.repeat(60) + '\n');
    
    return NextResponse.json(
      { 
        error: 'Error al generar el documento',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
