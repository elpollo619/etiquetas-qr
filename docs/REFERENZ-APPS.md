# Referenz: Inventar-/Lager-Apps für eine kleine Schweizer PYME

Contexto: ~10 personas (Büro, Werkstatt, Lager, Fahrzeuge). Nuestra app (PWA + Supabase) ya tiene máquinas con Ausleihe/Rückgabe por QR, Artikel con Bestand und Bewegungen, Standorte `L-…`, Inventuren, Rollen, Fotos/Dokumente, Audit-Log y etiquetas Brother QL-800. Excluido: CRM, Verkauf, Einkauf, Bestellungen, Fakturierung.

Leyenda: «(no verificado)» = la fuente oficial consultada no lo confirma; no significa que no exista. Fecha de consulta: 2026-11-06. Las páginas de marketing se leyeron vía resumen automático; las afirmaciones de IA se incluyen solo si la fuente las nombra.

## 1. Fichas por app

### Lager im Griff (= «Lagerdrift», Bonn)
- **Para quién:** talleres pequeños, almacenes y furgonetas de servicio hasta medianas; materiales, herramientas y llaves; >600 empresas; servidores en Alemania. Desde 289 €/año (1–3 usuarios). Es la referencia más cercana a nuestro caso.
- **Ubicaciones:** un único árbol Gebäude > Raum > Regal > Fach; vehículos como «unidades móviles»; stock por ubicación.
- **Fotos:** foto por material (galería / fotos de estantería: no verificado).
- **QR/etiquetas:** imprime etiquetas QR propias para materiales y ubicaciones (impresoras y lotes: no verificado).
- **Préstamo:** herramientas y llaves con responsable y fecha de devolución, recordatorio de vencidos, reserva para proyectos, historial por herramienta, avisos de defectos al responsable. Uso diario = escanear salida/entrada.
- **Sets:** «Stücklisten/Bundles» listados en la ficha; detalle no verificado.
- **Consumible vs. activo / mínimos:** alertas por e-mail y push bajo mínimo; sugerencias de compra.
- **Inventur:** conteo periódico en móvil por ubicación, PDF exportable, historial de cada movimiento.
- **Campos propios:** listados en la ficha; detalle no verificado.
- **IA:** la ficha menciona «AI» pero la fuente no la describe: no verificado.
- **Móvil/offline:** iOS/Android con soporte offline. «Setup en 5 minutos» (afirmación de marketing).
- **Bien en usabilidad:** modelo mental «escanear sale / escanear entra»; una sola jerarquía incluyendo vehículos.

### Sortly
- **Para quién:** equipos móviles (construcción, médico, almacén, eléctricos); >15.000 empresas.
- **Ubicaciones:** carpetas anidables por lugar/tipo; sin códigos legibles propios.
- **Fotos:** foto de alta resolución por ítem (núcleo del producto).
- **QR/etiquetas:** escáner de barcode/QR y etiquetas personalizadas; impresión por lotes no verificado.
- **Préstamo:** Check-in/Check-out con registro de quién/cuándo; reservas: no verificado.
- **Sets:** no mencionado.
- **Mínimos:** alertas de stock bajo y reportes; **Stock Counts** (flujo guiado por rol, Borrador a Completo, máx. 250 líneas por conteo, PDF) y **Pick Lists** en planes superiores.
- **Campos propios:** sí. **Bulk edit:** sí (barra de edición masiva desde carpeta o búsqueda avanzada).
- **IA:** no confirmada por ninguna fuente de Sortly.
- **Móvil/offline:** app que funciona offline.
- **Bien:** fricción mínima para empezar (foto + carpeta + cantidad).

### Shelf (shelf.nu, open source AGPL-3.0, Supabase/Remix)
- **Para quién:** equipos con equipo prestable (cámaras, IT, eventos); plan gratis para 1 persona, Team con reservas.
- **Ubicaciones:** jerarquía hasta **12 niveles**; imagen principal por ubicación; mover = cambiar «Parent location». Guía «Locations vs Categories vs Tags».
- **Fotos:** foto por activo; en auditorías se pueden añadir comentarios y fotos (p. ej. estantería vacía).
- **QR:** cada activo tiene QR en todos los planes; hojas de etiquetas (Avery), «Unclaimed Codes» para imprimir lotes y vincular después; Code128/DataMatrix como add-on.
- **Préstamo:** Bookings con línea de tiempo, sin doble reserva, PDF de pull list, invitaciones de calendario, check-in parcial, horario laboral; roles self-service y base (con aprobación).
- **Sets:** Kits reservables como unidad, check-in parcial.
- **Tracking:** tres métodos: activo individual, **Asset Model** (unidades idénticas con etiqueta propia) y **cantidad** (consumibles, unidades, alerta de mínimo). Árbol de decisión oficial; el método no se puede cambiar tras crear.
- **Auditorías:** alcance por ubicación/categoría/tag, asignable, escaneo = «Found», estados Found/Unexpected/Not scanned/Missing, «Needs attention», deshacer escaneo, fotos y nota final, PDF y e-mail; duplicar auditoría.
- **Campos propios:** sí, enlazables a categorías.
- **IA:** solo un tutorial de enriquecimiento por CSV con un asistente externo (Claude); no hay IA integrada confirmada.
- **Móvil:** Companion app iOS/Android; offline no verificado.
- **Bien:** el mejor modelo de auditoría y de «cómo elegir método de tracking».

### Snipe-IT (open source, TI)
- **Para quién:** inventario de IT; self-hosted.
- **Ubicaciones:** importador y API de locations; jerarquía padre/hijo (no verificado en la fuente consultada).
- **QR/etiquetas:** generación e impresión de etiquetas, guía de ajustes de impresoras, barcodes.
- **Préstamo:** check-out de accesorios/consumibles a usuarios, «User Inventory», aceptación con recordatorios. Reservas/requestable y kits: no verificado.
- **Tipos:** activos, accesorios, consumibles, componentes, licencias; importadores para todos.
- **Auditorías:** «Upcoming Audits» por e-mail y endpoint de auditoría por activo.
- **Campos propios:** sí (con cifrado opcional). **IA / móvil:** no verificado.
- **Bien:** separación clara de tipos de ítem. **Mal:** vocabulario y UI de TI, pesado para un taller.

### Cheqroom (solo búsquedas del centro de ayuda; la web dio 403)
- **Para quién:** equipo audiovisual/educación (reservas y préstamos).
- **Ubicaciones:** lista plana de locations (almacén/departamento/sala), seleccionables al reservar/retirar.
- **Préstamo:** reservas y check-outs con campos obligatorios configurables; kits (incl. kits bloqueados) reservables, informe de utilización de kits.
- **Campos propios:** sí (campo de tipo usuario desde jul. 2025, multiselección).
- **Auditoría:** inventario contra registros; «Scan Pile» con RFID. Plan Business con audits (precio de terceros, no verificado).
- **IA/offline/QR por lotes:** no verificado.
- **Bien:** flujo de reserva y retirada de kits.

### EZO AssetSonar
- **Para quién:** equipos de TI de empresas medianas (ITAM/ITSM, CMDB, parches). Sobredimensionado para 10 personas.
- **Confirmado:** app móvil para escanear, verificar custodia y auditar; check-in/out/transfer; auditorías físicas; seguimiento por usuario/departamento/ubicación; «Zoe» (copiloto IA para tickets de servicio, no para inventario).
- **No verificado:** QR/etiquetas, reservas, campos propios, bundles, consumibles.

### Odoo Inventory
- **Para quién:** almacén/producción con ERP; potente pero amplio.
- **Ubicaciones:** árbol padre/hijo con ruta completa (`WH/Stock/Zone A/Refrigerator 1`), tipos de ubicación, **código de barras por ubicación** (app Barcode).
- **Stock:** lotes/series, reglas min-max, conteo cíclico, valoración, trazabilidad, barcode/QR/GS1, funciona offline según la ficha. Kits por BoM no verificado en la fuente consultada.
- **IA / préstamo de herramientas:** no es su caso (no verificado); orientado a flujos de compra/venta, que están excluidos.
- **Bien:** la ruta de ubicación como nombre compuesto.

### inFlow Inventory
- **Para quién:** mayoristas, almacén, field service (HVAC, solar). Orientado a pedidos.
- **Confirmado:** ubicaciones y sububicaciones, transferencias, barcodes/QR generados, etiquetas personalizadas, puntos de reorden y alertas, conteos físicos, campos personalizados, apps iPhone/Android (offline no verificado), BOM/kitting en el módulo Manufacturing, **IA solo como asistente de informes**.
- **Mal para nosotros:** centrado en ventas/compras (excluido).

## 2. Hallazgos transversales
- **Ninguna app confirma reconocimiento por foto ni autocompletado IA para inventario.** La IA «real» confirmada es mínima (asistente de informes en inFlow, copiloto de tickets en AssetSonar). El diferencial «foto-first con IA» sería propio, no una función estándar del mercado.
- Lo que sí es estándar: jerarquía de ubicaciones, QR por activo y por ubicación, check-out/in con responsable, alertas de mínimo, conteo con escáner.
- Lo más sólido en cada área: auditorías (Shelf), préstamo y vehículos como ubicación (Lager im Griff), fotos y rapidez (Sortly), ruta completa de ubicación (Odoo), tipos de ítem (Snipe-IT, Shelf).

## 3. Comparación de tres enfoques

| Criterio | 1. Einfach (carpetas + fotos) | 2. Strukturiert | 3. Intelligent-Hybrid |
|---|---|---|---|
| Parecido a | Sortly | Shelf, Snipe-IT, Odoo | Ninguno completo (idea propia sobre bases de 2) |
| Alta inicial de ~2000 artículos | Rápida, pero caótica | Lenta, manual | Rápida y ordenada si la revisión humana es ágil |
| Calidad de datos a 12 meses | Baja (carpetas libres, duplicados) | Alta | Alta si todo pasa por confirmación |
| Riesgo | Deriva de estructura | Abandono por fricción | IA equivocada confirmada sin mirar; coste/privacidad de fotos |
| Encaje con lo que ya existe | Poco aprovecha Inventuren y Rollen | Encaja casi directo | Encaja si la IA solo propone |
| Esfuerzo de desarrollo | Bajo | Medio | Medio-alto (cola de revisión, duplicados) |

## 4. Recomendación

**Elegir el enfoque 3 en dos fases, con 2 como base obligatoria.**
1. Primero consolidar la estructura (categorías jerárquicas, código legible de ubicación, tipos de ítem, responsable, estados). Es lo que hace que cualquier foto o IA tenga dónde aterrizar y es lo que el mercado ya valida.
2. Después añadir captura foto-first por lotes y sugerencias de IA, siempre como **propuestas pendientes** con «confirmar / editar / fusionar / más tarde». La IA nunca escribe en datos oficiales.

Justificación: con ~10 personas no hay un administrador de inventario a tiempo completo; la fricción de alta decide si la app se usa. La estructura estricta sola (Shelf, Snipe-IT) se abandona; las carpetas libres solas (Sortly) se degradan. Como ninguna app confirma IA de inventario, conviene no depender de ella: el flujo debe funcionar igual con entrada manual.

## 5. Lista priorizada de funciones a adoptar (15)

1. **Tres tipos de ítem con árbol de decisión** (individual / modelo de unidades idénticas / cantidad) y método fijo tras crear. — Shelf
2. **Código de ubicación legible y jerárquico** (`HL-RG01-FA02-BX03`) con ruta completa mostrada y mover = cambiar padre; límite de profundidad. — Odoo, Shelf
3. **Vehículos como ubicaciones móviles** dentro del mismo árbol. — Lager im Griff
4. **Auditoría con alcance** (ubicación/categoría), asignada, escaneo = Found, Unexpected / Not scanned / Missing al cerrar, deshacer, foto de estantería, PDF y duplicar. — Shelf
5. **Responsable por activo** con aviso automático por defecto reportado y recordatorio de vencidos. — Lager im Griff, Snipe-IT
6. **Etiquetas impresas en lote antes de asignar** («Unclaimed Codes») y vinculación posterior; plantilla para Brother QL-800. — Shelf
7. **Foto principal por ubicación y por ítem** y galería; navegación visual sobre fotos de estantería. — Shelf, Sortly (hotspots: idea propia)
8. **Cola de revisión de detecciones** (confirmar / editar / fusionar / más tarde) con detección de duplicados en importación de fotos. — idea propia; el patrón «Needs attention» viene de Shelf
9. **Sets/kits con componentes**, check-out de todo el kit y devolución parcial. — Shelf, Cheqroom
10. **Categorías jerárquicas con campos propios enlazados a la categoría.** — Shelf, Snipe-IT
11. **Mínimos solo para ítems por cantidad**, con aviso (sin pedidos). — Shelf, Lager im Griff
12. **Edición masiva** desde carpeta/búsqueda y creación de auditoría/lista desde la selección. — Sortly, Shelf
13. **Búsqueda global con filtros** (ubicación, categoría, estado, responsable) y exportación CSV/PDF. — Sortly, Shelf, Lager im Griff
14. **Planes/tareas de organización por espacio** con estado y fecha límite (reutiliza el modelo de auditoría asignable). — Shelf (audit asignada), idea propia
15. **Modo offline en móvil** para conteo y salida/entrada en el taller. — Lager im Griff, Sortly

## 6. Cinco errores a evitar
1. **Carpetas libres sin reglas** (Sortly): la estructura se degrada y aparecen duplicados.
2. **Vocabulario y UI de TI o ERP** (Snipe-IT, AssetSonar, Odoo, inFlow): módulos de compras/ventas y licencias que nadie necesita y que complican cada pantalla.
3. **Método de tracking inmutable sin ayuda previa** (Shelf): si el usuario elige mal no puede corregir; mostrar el árbol de decisión y permitir conversión controlada.
4. **Funciones clave detrás de planes caros** (auditorías de Shelf y Stock Counts de Sortly en planes superiores; Cheqroom en su plan alto): en nuestra app auditoría y mínimos deben estar en el núcleo.
5. **Prometer IA sin fuente verificable**: ninguna app consultada confirma reconocimiento por foto; si se añade, debe ser siempre sugerencia revisable, con valor por defecto «más tarde», nunca confirmación automática.

## 7. Fuentes
- https://lagerdrift.pages.dev/en y https://lagerdrift.pages.dev/en/about (producto conocido como «Lager im Griff»; el dominio lagerimgriff.ch no resolvió)
- https://sellwerk.de/firmenprofil/lagerimgriff
- https://www.sortly.com/ , https://www.sortly.com/features/ , https://help.sortly.com/hc/en-us/articles/41121062802203-Stock-Counts , https://help.sortly.com/hc/en-us/articles/28105359156123-Pick-Lists
- https://www.shelf.nu/ , https://www.shelf.nu/knowledge-base , https://www.shelf.nu/knowledge-base/run-your-first-audit , https://www.shelf.nu/knowledge-base/how-to-choose-a-tracking-method , https://www.shelf.nu/knowledge-base/sublocations-organize-locations-into-hierarchies , https://github.com/Shelf-nu/shelf.nu , https://docs.shelf.nu/
- https://snipe-it.readme.io/docs , https://snipe-it.readme.io/llms.txt
- https://knowledge.cheqroom.com/helpcenter/cheqroom-essentials , https://help.cheqroom.com/articles/2352210-creating-a-check-out , https://www.cheqroom.com/1h-2025-enhancements/
- https://www.ezo.io/assetsonar/ , https://www.ezo.io/assetsonar/features/
- https://www.odoo.com/app/inventory , https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management/use_locations.html
- https://www.inflowinventory.com/features
