# «Lager organisieren» – concepto, decisión y funcionamiento

Documento de diseño del módulo de organización de toda la empresa. Fuentes de la investigación: [REFERENZ-APPS.md](REFERENZ-APPS.md).
Detalles técnicos (tablas, API, permisos): [ARCHITECTURE.md](ARCHITECTURE.md), sección «Erweiterung «Lager organisieren»».

## 1. Punto de partida (análisis de la app existente)

Ya existía y se reutiliza sin romper nada:

| Módulo | Estado antes | Qué se reutiliza |
|---|---|---|
| Máquinas (`machines`) | Activos individuales con QR permanente (M-…), préstamo/devolución con sesión, historial, daños | Pasan a ser el **Einzelinventar** (también IT, muebles de valor) |
| Artículos (`articles`) | Material con stock, mínimos y movimientos | Son los **Bestandsartikel** |
| Ubicaciones (`locations`) | Jerarquía con QR (L-…), sin códigos legibles | Árbol de ubicaciones; se añaden códigos cortos, tipos y fotos |
| Fotos/documentos (`attachments`) | Fotos por ficha en Storage privado | Se mantienen; las fotos de importación van a un pool propio (`photos`) |
| Inventario físico | Conteo global | Se añade alcance por espacio, objetos desconocidos y exportación |
| Usuarios/roles | Administrator / Lagerverantwortlicher / Mitarbeiter, invitaciones | Mismas reglas para el módulo nuevo |
| Registro (`audit_log`) | Todo cambio queda registrado | También importaciones y revisiones de IA |

Faltaba: categorías estructuradas, códigos legibles de ubicación, organización visual, importación masiva de fotos,
revisión de detecciones, sets, responsables, tareas de organización, búsqueda global y exportación Excel/PDF.

## 2. Comparación de las tres variantes

Escala 1 (malo) – 5 (muy bueno). Evaluación propia a partir de las apps de referencia y del uso real previsto
(~10 personas, oficina + taller + almacén + exterior, sin administrador de inventario a tiempo completo).

| Criterio | 1. Einfach (carpetas + fotos, estilo Sortly) | 2. Strukturiert (Snipe-IT / Odoo / Shelf) | 3. Intelligent-Hybrid (elegida) |
|---|---|---|---|
| Facilidad de comprensión | 5 | 3 | 4 |
| Rapidez de registro | 4 | 2 | 5 (las fotos proponen, una persona confirma) |
| Facilidad de búsqueda | 3 | 4 | 5 (texto + categorías + ubicación + etiquetas leídas) |
| Precisión de ubicaciones | 2 | 5 | 5 |
| Mantenimiento a 12 meses | 2 (las carpetas se degradan) | 4 | 4 |
| Flexibilidad para crecer | 2 | 5 | 5 |
| Nº de pasos típico | bajo | alto | bajo (con valores propuestos) |
| Utilidad en el móvil | 4 | 3 | 5 (QR, cámara, fotos grandes) |
| Fiabilidad de los datos | 2 | 5 | 5 (nada entra sin confirmación) |
| Complejidad técnica | baja | media | media-alta |

**Decisión:** variante 3 sobre la base estricta de la 2. La estructura (categorías, árbol de ubicaciones, tipos de registro)
es obligatoria; las fotos y la IA solo **proponen**. Nada se convierte en inventario sin que una persona lo confirme.
Combina los métodos A (categorías), B (ubicaciones), C (visual), E (QR), F (responsable) y G (zonas = espacios y bereiche);
el método D (frecuencia de uso) se aplica como recomendación en los planes de organización, no como campo obligatorio.

No se imponen niveles innecesarios: cada espacio tiene la profundidad que necesita (un armario puede tener `Schrank → Tablar`,
un almacén `Bereich → Regal → Fach → Box`).

## 3. Estructura

### Tipos de registro
- **Einzelinventar** – objeto con identidad propia y QR (taladro, monitor, impresora, máquina, tablet). Puede tener responsable.
- **Bestandsartikel** – material por cantidad (tornillos, cables, papel, guantes) con unidad, stock, mínimo y ubicación.
- **Set** – Einzelinventar marcado como set con lista de componentes (maletín, taladro con baterías y cargador, kit de medición).
  Los componentes pueden ser otros activos, artículos o piezas libres. Al prestar/devolver se muestra la lista para comprobar.
- **Einrichtung** – estantería, armario, caja… detectada en una foto: al confirmarla se crea como **ubicación**.

### Categorías (de-CH, editables en «Kategorien»)
Maschinen & Geräte · Werkzeuge · Bau- & Montagematerial · IT & Elektronik · Bürobedarf · Büromöbel · Reinigung & Unterhalt ·
Elektro & Installation · Ersatzteile & Zubehör · Arbeitssicherheit · Küche & Aufenthalt, cada una con subcategorías
(p. ej. *IT & Elektronik › Kabel & Adapter*). Ajustes hechos tras analizar las fotos: «Bau- & Baustellengeräte» y
«Haushalts- & Klimageräte» en máquinas, «Bürogeräte» (plastificadoras, destructora, encuadernadora) en Bürobedarf,
«Arbeitssicherheit» (EPI) y «Küche & Aufenthalt». Se evitan categorías casi idénticas (p. ej. una sola «Dicht- & Klebstoffe»).

### Códigos de ubicación
- Código interno **permanente** `L-0001` (va en el QR; nunca cambia aunque se renombre o mueva la ubicación).
- **Código corto** por nivel, editable: HL Hauptlager · WS Werkstatt · BU Büro · IT IT-Raum · AR Archiv · MR Materialraum ·
  TR Technikraum · RR Reinigungsraum · FZ Fahrzeug · CT Container · BE Bereich · RG Regal · SC Schrank · TB Tablar · FA Fach ·
  SL Schublade · BX Box · W Werkzeugwand · HA Halterung · AP Arbeitsplatz.
- El **código legible** se compone solo: `HL-RG01-FA02-BX03` (se muestra cuando todos los niveles tienen código corto).
- Los códigos cortos son únicos por nivel; la app propone el siguiente libre (RG01, RG02 …).

## 4. Organización visual
Cada espacio o ubicación puede tener una **foto de vista general** con **áreas marcadas** (rectángulos o puntos) enlazadas a
sus sub-ubicaciones: Hauptlager → foto → toca «Regal A01» → foto del estante → toca «Fach 02» → contenido → artículo.
Las áreas las dibuja una persona (arrastrando sobre la foto); no se inventan posiciones. Las detecciones de la IA aparecen como
puntos aproximados en las fotos originales. Navegación alternativa siempre disponible: árbol, lista, tarjetas y búsqueda.

## 5. IA: qué hace realmente (limitaciones)
- La app **no tiene un servicio de IA propio** ni clave de API. No se simula ningún análisis.
- El análisis de fotos lo hace **Claude (Anthropic) en una sesión de Claude Code**, foto por foto, a partir de los archivos
  originales. El resultado es un archivo JSON (`lgr-photo-analysis/1`) que se importa en «Fotos importieren».
  Cada foto se identifica por el **SHA-256 del archivo original**: importar dos veces no duplica nada.
- Niveles de confianza: *Sicher erkannt*, *Wahrscheinlich erkannt*, *Unbekannt*. Marcas/modelos solo si se leen; nunca se adivina
  un número de modelo. Las fotos que no se pueden analizar quedan marcadas con error, no se omiten.
- **Produktrecherche**: para marcas y modelos leídos se busca la página oficial del fabricante (preferentemente suiza),
  manual y datos técnicos. **Las imágenes oficiales no se descargan** (no hay permiso de reutilización); se guarda el enlace
  («Produktbild: nur Link») y se usan las fotos propias («Originalfoto»).
- «Mit KI organisieren» guía el proceso con datos reales y genera un **plan de organización derivado de los datos**
  (tareas). «Was soll ich hier verbessern?» muestra las recomendaciones de la foto con su hallazgo como explicación, más
  comprobaciones de los datos. Todo lleva la fuente indicada.
- Opcional en el futuro: conectar un servicio de IA (p. ej. API de Anthropic mediante una Edge Function de Supabase con clave
  propia y coste por uso) para analizar directamente desde la app. Hoy no está conectado.

## 6. Flujo completo
1. **Fotos hochladen** – «Fotos importieren»: varias fotos, carpetas, ZIP o cámara; progreso; duplicados detectados.
2. **KI-Analyse** – marcar para análisis; Claude analiza cada foto; se importa el JSON.
3. **Objekte erkennen** – varias detecciones por foto, textos leídos, cantidades visibles, mismo objeto en varias fotos enlazado.
4. **Produktrecherche** – enlace oficial, manual, datos técnicos y uso (se copian a las notas al confirmar).
5. **Kategorien** – propuestas con la categoría del árbol.
6. **Lagerorte planen** – estantes/armarios/cajas detectados = ubicaciones propuestas.
7. **Visuelle Organisation** – foto con áreas y sub-ubicaciones.
8. **Organisation prüfen** – «KI-Erkennung prüfen»: Bestätigen, Bearbeiten, Zusammenführen, Lagerort ändern, Später prüfen.
   Confirmación múltiple solo para lo seguro; las cantidades inciertas nunca se guardan como confirmadas.
9. **Inventar übernehmen** – al confirmar se crean activos, artículos o ubicaciones con código propio.
10. **QR-Etiketten** – etiquetas por lotes para activos y ubicaciones (Brother QL-800).
11. **Physisch organisieren** – tareas del plan con casillas, asignables.
12. **Standort bestätigen** – mover a la ubicación final; inventario físico por espacio.
13. **Organisation abschliessen** – el espacio queda «Organisiert» (solo si no quedan revisiones ni tareas abiertas).

Estados de un espacio (calculados, nunca estimados): Nicht erfasst → Fotos vorhanden → In Analyse → Zu prüfen →
In Organisation → Organisiert. Progreso = (objetos confirmados + tareas hechas) / (los mismos + abiertos).

## 7. Seguridad y datos
- Migración aditiva: solo tablas y columnas nuevas; probada con la base anterior con datos (`tests/org.test.mjs`).
- Permisos: todos los empleados activos leen; importar, revisar, planificar y editar estructura = Lagerverantwortliche y
  Administratoren; borrar categorías = Administratoren y solo si no se usan. Las detecciones solo cambian mediante funciones
  del servidor; fotos con objetos confirmados no se pueden borrar.
- Registro de auditoría para importaciones, revisiones, tareas, áreas, categorías y cierre de espacios.
- Las fotos se guardan en el bucket privado; los textos leídos se limpian de teléfonos, e-mails y contraseñas antes de importar.

## 8. Pruebas de usabilidad (pasos medidos en la app)

Un «paso» = un toque/clic o una entrada de texto. La lupa de búsqueda está en la barra superior de **todas** las páginas,
el escáner QR también. Probado en modo demo con datos reales del análisis (escritorio y móvil 375 px).

| # | Escenario | Camino más corto | Pasos |
|---|---|---|---|
| 1 | Encontrar un cable HDMI | Lupa → «hdmi» → resultado con caja, cantidad y ubicación (también hallazgos de fotos aún sin revisar, p. ej. caja «Monitor HDMI») | 2 |
| 2 | Encontrar papel para impresora | Lupa → «papier» → cantidades y ubicación | 2 |
| 3 | Localizar una herramienta Bosch | Lupa → «bosch» (filtro «Einzelinventar» opcional) → estado, ubicación, responsable | 2–3 |
| 4 | Quién usó una máquina por última vez | Escanear QR → la ficha muestra usuario actual y último usuario | 1 |
| 5 | Retirar una máquina con QR | Escanear → «Maschine ausleihen» → Confirmar (fecha/hora automáticas; con set: lista de componentes) | 3 |
| 6 | Devolver una máquina | Escanear → «Zurückgeben» → (daños opcional) → Confirmar | 3 |
| 7 | Inventariar una oficina con fotos | Lager organisieren → espacio → Fotos importieren → elegir fotos/ZIP → Importar → *(análisis por Claude)* → KI-Ergebnis importieren → Prüfen → «Alle sicheren bestätigen» → revisar el resto | ~9 + 1–3 por objeto dudoso |
| 8 | Identificar una impresora | Lupa → «drucker» u «OKI» → marca, modelo, enlace al fabricante, uso | 2 |
| 9 | Organizar un armario | Abrir el armario (QR o espacio) → «Was soll ich hier verbessern?» → «Als Aufgabe übernehmen» → Plan: marcar tareas → cerrar | 5 |
| 10 | Crear una caja nueva | Abrir estante → Unterorte → «Unterort anlegen» → tipo Box (código BX.. propuesto) + nombre → Guardar (+ QR) | 4–5 |
| 11 | Mover un objeto | Artículo: «Umlagern» → destino → Confirmar · Máquina: Editar → ubicación → Guardar | 3–4 |
| 12 | Escanear el QR de una estantería | Escanear → ubicación con foto, contenido y entradas/salidas | 1 |
| 13 | Identificar un objeto sin saber su nombre | Espacio → Fotos → tocar la foto → tocar el punto del objeto (nombre, marca, textos leídos); o buscar por un texto de la etiqueta/marca; o en la inventario «Unbekanntes Objekt erfassen» con foto | 3–4 |
| 14 | Ver todas las fotos de una habitación | Lager organisieren → tarjeta del espacio → pestaña «Fotos» | 3 |
| 15 | Localizar por categoría o ubicación | Kategorien → tocar categoría (abre la búsqueda filtrada) · o espacio → «Inhalt» · o filtros de la búsqueda | 2–3 |

Reducciones aplicadas: búsqueda y QR siempre a un toque; propuestas pre-rellenadas (categoría, ubicación, código corto)
al confirmar; confirmación múltiple para lo seguro; los objetos repetidos en varias fotos se revisan una sola vez;
Enter en la búsqueda abre el primer resultado; un código (M-…, L-…) tecleado en la búsqueda abre la ficha directamente.
