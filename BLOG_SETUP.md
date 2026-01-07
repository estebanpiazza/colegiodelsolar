# 📝 Configuración del Blog con Google Sheets

## Paso 1: Preparar tu Google Sheet

1. Crea una nueva Google Sheet o usa una existente
2. La primera fila debe tener estos encabezados exactos:

```
Titulo | Fecha | Imagen | Extracto | Link
```

### Ejemplo de datos:

| Titulo | Fecha | Imagen | Extracto | Link |
|--------|-------|--------|----------|------|
| Inicio de clases 2026 | 6 Enero 2026 | https://ejemplo.com/imagen.jpg | Los esperamos para comenzar un nuevo ciclo lectivo lleno de aprendizajes... | https://www.colegiodelsolar.edu.ar/blog/inicio-2026 |
| Jornada de puertas abiertas | 15 Diciembre 2025 | https://ejemplo.com/imagen2.jpg | Conocé nuestras instalaciones y propuesta educativa en esta jornada especial... | https://www.colegiodelsolar.edu.ar/blog/puertas-abiertas |

## Paso 2: Publicar la hoja como CSV

1. En tu Google Sheet, ve a: **Archivo > Compartir > Publicar en la web**
2. En la primera lista desplegable, selecciona la hoja que quieres publicar
3. En la segunda lista, selecciona **CSV** (valores separados por coma)
4. Haz clic en **Publicar**
5. Copia la URL que te da

## Paso 3: Obtener el ID de la hoja

De la URL que copiaste, necesitas solo el ID. Por ejemplo:

```
https://docs.google.com/spreadsheets/d/1abc123XYZ456def789/export?format=csv
```

El ID es: `1abc123XYZ456def789`

## Paso 4: Configurar en tu sitio web

Abre el archivo `script.js` y busca esta línea al principio del código de blog:

```javascript
const GSHEET_ID = ''; // Ingresá aquí el ID de tu Google Sheet publicado como CSV
```

Reemplázala con tu ID:

```javascript
const GSHEET_ID = '1abc123XYZ456def789';
```

## 📋 Formato de los campos

- **Titulo**: Texto del título del post (máximo 2 líneas visuales)
- **Fecha**: Fecha en cualquier formato (ej: "6 Enero 2026", "06/01/2026")
- **Imagen**: URL completa de la imagen (opcional - si está vacío muestra placeholder)
- **Extracto**: Resumen breve del post (máximo 3 líneas visuales)
- **Link**: URL completa donde leer el artículo completo

## 🎨 Características

- ✅ Carga automática desde Google Sheets
- ✅ Grid responsive (3 columnas en desktop, 1 en móvil)
- ✅ Loading spinner mientras carga
- ✅ Manejo de errores
- ✅ Placeholder si no hay imagen
- ✅ Actualización en tiempo real (cada vez que alguien recarga la página)

## 🔄 Actualizar contenido

Simplemente editá tu Google Sheet y los cambios se verán reflejados automáticamente cuando los visitantes recarguen la página. No necesitás hacer nada más!

## ⚠️ Notas importantes

- La Google Sheet debe estar publicada en la web (no solo compartida)
- El formato debe ser CSV
- Si usás comas dentro del texto, el sistema las maneja correctamente
- Las imágenes deben ser URLs públicas y accesibles

## 🐛 Solución de problemas

**No se ven los posts:**
- Verificá que el ID esté correcto en `script.js`
- Asegurate que la hoja esté publicada como CSV
- Comprobá que los encabezados sean exactos (Titulo, Fecha, Imagen, Extracto, Link)

**Las imágenes no se ven:**
- Verificá que las URLs sean completas (https://...)
- Asegurate que las imágenes sean públicas y accesibles

**Aparece error de CORS:**
- Esto es normal en algunos casos. Google Sheets públicos generalmente funcionan sin problemas.
