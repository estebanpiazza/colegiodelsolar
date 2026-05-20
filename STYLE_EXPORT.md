# Export de estilo - Colegio Del Solar

Este archivo resume las reglas visuales del proyecto para trasladarlas a otro sitio sin copiar toda la estructura HTML actual. Lo ideal es pasarle a Codex este documento y, si hace falta una base concreta, tambien `style-foundation.css`.

## Prompt listo para Codex

Usa la identidad visual del sitio Colegio Del Solar como referencia. Construye una interfaz institucional, luminosa, humana y academica, con una mezcla de tradicion e innovacion. Evita un look generico de SaaS, landing page tecnologica o plantilla escolar infantil.

Respeta estas reglas:

- Paleta principal: azul institucional `#10438a`, azul secundario `#1a5299`, amarillo acento `#fdcd24`, fondos blancos y superficies suaves `#f2f5f9`.
- Tipografia: `Manrope` para texto/interfaz y `Cormorant Garamond` para titulos expresivos.
- Titulos grandes, elegantes y serif; texto de cuerpo sobrio, legible y con mucho aire.
- Layouts amplios con contenedor maximo de `1220px`, secciones con padding vertical generoso y grillas limpias.
- Componentes con bordes suaves, radios grandes y sombras azules muy livianas.
- Botones tipo pill: primario azul, secundario blanco con borde azul tenue, ghost transparente y CTA suave amarillo/beige.
- Usar etiquetas pequenas en mayusculas con tracking amplio para eyebrows, chips y labels.
- Imagenes reales como senal fuerte de identidad: fotos grandes, recortadas con `object-fit: cover`, esquinas redondeadas y sombras suaves.
- Cards institucionales simples: fondo blanco, borde azul al 8-10%, sombra baja, padding `1.6rem` a `2rem`.
- En mobile, convertir grillas grandes a una columna; las colecciones de cards pueden pasar a carrusel horizontal con `scroll-snap`.
- Movimiento discreto: hover con `translateY(-2px)` o zoom de imagen `scale(1.04)`; respetar `prefers-reduced-motion`.
- El tono visual debe sentirse cercano, confiable, bilingue/internacional y cuidado.

## Archivos fuente de referencia

- `styles.css`: sistema visual completo del sitio principal.
- `novedades-tv.html`: variante para pantalla interna/TV con los mismos tokens adaptados a una UI densa.
- `index.html` e `index-en.html`: ejemplos reales de jerarquia, secciones, cards y llamadas a la accion.
- `Logo-Del-Solar (1).png` y `logos_footer.png`: marcas usadas en header/footer.
- `images/`: fotografias reales que sostienen el caracter institucional del sitio.

## Tokens base

```css
:root {
    --color-ink: #10438a;
    --color-ink-soft: #1a5299;
    --color-accent: #fdcd24;
    --color-accent-soft: #f1e4d1;
    --color-bg: #ffffff;
    --color-surface: #ffffff;
    --color-surface-soft: #f2f5f9;
    --color-line: #d9e0ea;
    --color-text: #505050;
    --color-muted: #5a6a7e;
    --color-success: #166534;
    --color-error: #b91c1c;
    --shadow-sm: 0 10px 30px rgba(0, 65, 140, 0.06);
    --shadow-md: 0 18px 40px rgba(0, 65, 140, 0.10);
    --shadow-lg: 0 28px 60px rgba(0, 65, 140, 0.14);
    --radius-sm: 1rem;
    --radius-md: 1.5rem;
    --radius-lg: 2rem;
    --container-width: 1220px;
    --header-height: 5.4rem;
    --transition: 0.3s ease;
}
```

## Tipografia

Importar desde Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Reglas:

- Body: `Manrope`, `line-height: 1.6`, color `--color-text`.
- Titulos principales: `Cormorant Garamond`, color `--color-ink`, line-height ajustado.
- H1 estilo hero: `clamp(3.4rem, 7vw, 6rem)`, line-height `0.9`, ancho corto de lectura.
- H2/seccion: `clamp(2.5rem, 4.5vw, 4.2rem)`, line-height `0.96`.
- Eyebrows: `0.78rem`, uppercase, `font-weight: 800`, `letter-spacing: 0.16em`, color acento.

## Composicion

- `.container`: `width: min(1220px, calc(100% - 2.5rem)); margin: 0 auto;`
- `.section`: `padding: 6rem 0;`
- Fondos alternados: blanco y `--color-surface-soft`.
- Grillas desktop frecuentes: 2 columnas para secciones narrativas, 3 a 5 columnas para cards.
- En `max-width: 980px`, pasar las grillas principales a 1 columna.
- En `max-width: 768px`, bajar secciones a `4rem 0`, reducir margen lateral y usar cards/carruseles horizontales cuando hay muchas piezas.

## Componentes visuales

### Botones

- Base: `inline-flex`, centro, `min-height: 3.4rem`, padding `0.95rem 1.5rem`, radio `999px`, peso `700`.
- Hover: `transform: translateY(-2px)`.
- Primario: fondo azul `--color-ink`, texto blanco, sombra suave.
- Secundario: fondo blanco casi opaco, borde azul tenue, texto azul.
- Ghost: fondo transparente, borde azul tenue.
- Nav CTA: fondo `--color-accent-soft`, texto azul.

### Cards

- Fondo `--color-surface`.
- Borde `1px solid rgba(0, 65, 140, 0.08)`.
- Radio `--radius-md` o `--radius-lg` si tienen imagen.
- Sombra `--shadow-sm`; usar `--shadow-md` o `--shadow-lg` solo en elementos destacados.
- Padding normal: `1.6rem` a `2rem`.
- Hover: elevar con `translateY(-4px)` y subir sombra solo si la card es clickeable.

### Imagenes

- Usar `object-fit: cover`, aspect ratios estables y recortes amplios.
- Cards de imagen: radio `--radius-lg`, sombra `--shadow-lg`.
- En hover de cards con media: imagen con `transform: scale(1.04)`.

### Chips y listas

- Chips: pills con `--color-accent-soft` o `--color-surface-soft`, texto azul, peso `700/800`.
- Listas de features: bullets pequenos circulares en amarillo acento.

### Formularios

- Labels azules, peso `800`.
- Inputs con borde azul tenue, radio `1rem`, padding cercano a `1rem`.
- Focus con borde azul mas visible y anillo `0 0 0 4px rgba(0, 65, 140, 0.08)`.

## No hacer

- No reemplazar la identidad por gradientes violetas/tecnologicos o por un look demasiado corporativo.
- No usar cards excesivamente flotantes ni sombras duras.
- No abusar de amarillo: funciona mejor como acento, chip, underline o detalle.
- No usar imagenes oscuras, stock generico o blur decorativo como senal principal.
- No apretar el contenido: esta identidad necesita aire, lectura clara y jerarquia amplia.

## Recomendacion practica

Para otro proyecto, pasar:

1. Este archivo `STYLE_EXPORT.md`.
2. `style-foundation.css` como base reutilizable.
3. `styles.css` solo como referencia completa si Codex necesita ver patrones especificos.
4. Algunas imagenes reales del nuevo proyecto para reemplazar las fotos del colegio, manteniendo el tratamiento visual.
