# INSTRUCCIONES PARA CREAR LA PLANTILLA

Para que la aplicación funcione correctamente, necesitas crear un archivo Word (.docx) con la siguiente estructura:

## 📁 Ubicación
`/templates/acta_ac_template.docx`

## 📝 Contenido de la plantilla

### 1. Campos de texto simples

Inserta estos placeholders donde corresponda en tu documento Word:

- `{{codigo_reunion}}` - Código de la reunión
- `{{tipo_reunion}}` - Tipo de reunión
- `{{fecha_reunion}}` - Fecha de la reunión
- `{{organismo}}` - Nombre del organismo
- `{{fecha_elaboracion}}` - Fecha de elaboración del acta
- `{{asistentes_texto}}` - Lista de asistentes
- `{{ausentes_texto}}` - Lista de ausentes
- `{{lectura_acta_anterior}}` - Texto sobre lectura del acta anterior
- `{{temas_tratados_texto}}` - Temas tratados en la reunión
- `{{proposiciones_y_varios}}` - Proposiciones y varios
- `{{nombre_elabora}}` - Nombre de quien elabora
- `{{nombre_revisa}}` - Nombre de quien revisa

### 2. Tabla de Compromisos Anteriores

Crea una tabla con las siguientes columnas y usa estos placeholders:

| No. | Compromiso | Responsable | Fecha de Logro | Estado |
|-----|------------|-------------|----------------|--------|
| {#compromisos_anteriores} |  |  |  |  |
| {{no}} | {{compromiso}} | {{responsable}} | {{fecha_logro}} | {{estado}} |
| {/compromisos_anteriores} |  |  |  |  |

**Importante:** Los tags `{#compromisos_anteriores}` y `{/compromisos_anteriores}` deben estar en celdas de la tabla, no en el texto normal.

### 3. Tabla de Compromisos Pactados

Crea otra tabla con las siguientes columnas:

| No. | Compromiso | Responsable | Fecha de Logro | Resultado |
|-----|------------|-------------|----------------|-----------|
| {#compromisos_pactados} |  |  |  |  |
| {{no}} | {{compromiso}} | {{responsable}} | {{fecha_logro}} | {{resultado}} |
| {/compromisos_pactados} |  |  |  |  |

## 💡 Consejos

1. **Formato**: Puedes aplicar cualquier formato (negrita, colores, tamaños de letra) a los placeholders. El formato se mantendrá en el documento generado.

2. **Posición**: Los placeholders pueden estar en cualquier parte del documento (encabezado, pie de página, cuerpo).

3. **Tablas**: Para las tablas con loops, asegúrate de que:
   - Los tags de apertura `{#...}` y cierre `{/...}` estén en filas separadas
   - Los placeholders `{{...}}` estén en la fila entre los tags de apertura y cierre
   - La tabla tenga los encabezados apropiados

4. **Diseño**: Diseña tu plantilla como quieres que se vea el documento final. La aplicación solo reemplazará los placeholders con los datos del JSON.

## 🎯 Ejemplo de estructura

```
ACTA DE REUNIÓN
Código: {{codigo_reunion}}
Tipo: {{tipo_reunion}}
Fecha: {{fecha_reunion}}

ORGANISMO: {{organismo}}

ASISTENTES:
{{asistentes_texto}}

AUSENTES:
{{ausentes_texto}}

LECTURA DEL ACTA ANTERIOR:
{{lectura_acta_anterior}}

TEMAS TRATADOS:
{{temas_tratados_texto}}

PROPOSICIONES Y VARIOS:
{{proposiciones_y_varios}}

COMPROMISOS ANTERIORES:
[Aquí va la tabla con el loop de compromisos_anteriores]

COMPROMISOS PACTADOS:
[Aquí va la tabla con el loop de compromisos_pactados]

Elabora: {{nombre_elabora}}
Revisa: {{nombre_revisa}}
Fecha de elaboración: {{fecha_elaboracion}}
```

## ⚠️ Nota importante

Sin esta plantilla, la aplicación no funcionará. Asegúrate de crear el archivo antes de hacer deploy en Vercel.
