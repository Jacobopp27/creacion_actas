# Generador de Actas - Next.js

Aplicación Next.js 14 para generar documentos Word (.docx) desde JSON usando plantillas.

## 🚀 Instalación

```bash
npm install
```

## 📝 Configuración de la Plantilla

1. Crea tu plantilla Word en `/templates/acta_ac_template.docx`
2. Usa los siguientes placeholders en tu plantilla:

### Campos simples:
```
{{codigo_reunion}}
{{tipo_reunion}}
{{fecha_reunion}}
{{organismo}}
{{fecha_elaboracion}}
{{asistentes_texto}}
{{ausentes_texto}}
{{lectura_acta_anterior}}
{{temas_tratados_texto}}
{{proposiciones_y_varios}}
{{nombre_elabora}}
{{nombre_revisa}}
```

### Tablas con loops:

**Compromisos Anteriores:**
```
{#compromisos_anteriores}
{{no}} | {{compromiso}} | {{responsable}} | {{fecha_logro}} | {{estado}}
{/compromisos_anteriores}
```

**Compromisos Pactados:**
```
{#compromisos_pactados}
{{no}} | {{compromiso}} | {{responsable}} | {{fecha_logro}} | {{resultado}}
{/compromisos_pactados}
```

## 📋 Formato del JSON

```json
{
  "naming": {
    "filename": "AC19012026 Seguimiento Medellin.docx"
  },
  "contenido": {
    "codigo_reunion": "AC-001",
    "tipo_reunion": "Seguimiento",
    "fecha_reunion": "19/01/2026",
    "organismo": "Comité Ejecutivo",
    "fecha_elaboracion": "21/01/2026",
    "asistentes_texto": "Juan Pérez, María García, Carlos López",
    "ausentes_texto": "Ana Martínez (Justificada)",
    "lectura_acta_anterior": "Se aprueba el acta anterior sin modificaciones",
    "temas_tratados_texto": "1. Revisión de presupuesto\n2. Aprobación de proyectos\n3. Varios",
    "proposiciones_y_varios": "Se propone aumentar el presupuesto en un 10%",
    "nombre_elabora": "Juan Pérez",
    "nombre_revisa": "María García",
    "compromisos_anteriores": [
      {
        "no": 1,
        "compromiso": "Actualizar sistema",
        "responsable": "TI",
        "fecha_logro": "30/01/2026",
        "estado": "En progreso"
      }
    ],
    "compromisos_pactados": [
      {
        "no": 1,
        "compromiso": "Preparar informe financiero",
        "responsable": "Contabilidad",
        "fecha_logro": "15/02/2026",
        "resultado": "Pendiente"
      }
    ]
  }
}
```

**Nota:** Si `compromisos_anteriores` o `compromisos_pactados` están vacíos, se insertará automáticamente una fila con "NO APLICA".


## 🔧 Tecnologías

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **docxtemplater** - Generación de documentos
- **pizzip** - Manejo de archivos ZIP/DOCX

## ⚠️ Requisitos

- Node.js 18+
- La plantilla `acta_ac_template.docx` debe existir en `/templates/`

## 📦 Dependencias principales

```json
{
  "docxtemplater": "^3.55.6",
  "pizzip": "^3.1.7"
}
```

## 🐛 Solución de problemas

1. **Error: "No se encontró la plantilla"**
   - Verifica que `/templates/acta_ac_template.docx` existe
   - Asegúrate de que el archivo se incluye en el deploy

2. **JSON inválido**
   - Verifica que tu JSON tenga el formato correcto
   - Usa un validador JSON online

3. **Error al generar documento**
   - Revisa que todos los placeholders en la plantilla coincidan con el JSON
   - Verifica que los loops estén correctamente cerrados

## 📄 Licencia

MIT

