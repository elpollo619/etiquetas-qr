# Puesta en marcha y mantenimiento

App: **https://elpollo619.github.io/etiquetas-qr/** · Base de datos: proyecto Supabase **`lager`** (región Zúrich).
Para probar sin tocar datos reales: **https://elpollo619.github.io/etiquetas-qr/?demo=1** (modo demostración, solo en ese navegador; `?demo=0` lo desactiva).

## Estado
- Proyecto `lager` creado, `supabase/schema.sql` ejecutado, Site URL y Redirect URL configurados.
- La app (`js/config.js`) usa la Project URL y la clave **publishable** (públicas por diseño). La clave `secret` /
  `service_role` y la contraseña de la base de datos no se usan en la app y no se deben compartir.
- «Confirm email» está **activado**: cada persona confirma su correo antes de entrar. Así nadie puede registrarse con
  el correo de otro. Recomendado dejarlo así.

## Primer administrador (una sola vez)
Nadie es administrador automáticamente (si no, el primero en registrarse – quien sea – lo sería). En Supabase →
**SQL Editor** ejecutar con tu correo:

```sql
insert into public.bootstrap_admins (email) values ('tu-correo@ejemplo.com') on conflict do nothing;
```

Después regístrate en la app con ese correo y confírmalo: la cuenta pasa a **Administrator** y la marca se borra sola.
Si ya te habías registrado antes, en su lugar:
`update public.profiles set role = 'admin', active = true where email = 'tu-correo@ejemplo.com';`

## Empleados
**Invitados (activación automática).** Los correos de la lista `public.invites` quedan activos con su rol en cuanto
la persona se registra y confirma su correo; cada uno elige su propia contraseña (nadie más la conoce). Ya están
invitados los 10 correos de `@reto-amonn.ch` (reto = Administrator, el resto = Mitarbeiter). Para invitar a más
personas (SQL Editor):

```sql
insert into public.invites (email, role) values ('nombre@reto-amonn.ch', 'mitarbeiter');   -- o 'lagerverantwortlicher' / 'admin'
```

También se puede usar Supabase → Authentication → Users → **Invite user**: la persona recibe un correo, abre el
enlace y la app le pide que elija su contraseña.

**Sin invitación:**
1. Abren la app (o escanean cualquier QR), pulsan **Konto erstellen**, confirman el correo.
2. Quedan «wartet auf Freigabe». En **Mitarbeiter** los apruebas y eliges el rol:
   - **Mitarbeiter**: retirar/devolver máquinas, retirar/añadir material, contar en inventarios.
   - **Lagerverantwortlicher**: además crea/edita artículos, máquinas y ubicaciones, cambia estados, traslada,
     corrige stock, abre/cierra inventarios, imprime etiquetas y ve el protocolo.
   - **Administrator**: además gestiona empleados, corrige préstamos (con motivo) y puede borrar.
3. En el móvil: abrir la web → menú del navegador → **Añadir a pantalla de inicio**.

## Etiquetas QR
- Cada etiqueta lleva solo un enlace permanente (`…/?c=M-0028`, `…/?c=INV-0001`, `…/?c=L-0003`), sin datos personales.
  Cambiar el nombre no rompe la etiqueta; reimprimir no cambia su identidad. Las etiquetas antiguas `?id=INV-…` siguen valiendo.
- **Etiketten** (o «Etikett drucken» en cada ficha): elegir el rollo de la Brother QL-800, imprimir o «Guardar como PDF».

## Actualizar la base de datos
Si cambia `supabase/schema.sql`: SQL Editor → New query → pegar todo → **Run** (aviso de «destructive operations» →
«Run query»). Es seguro repetirlo: no borra datos. La ampliación «Lager organisieren» (noviembre 2026) solo añade tablas
y columnas; está probada contra la versión anterior con datos (`tests/org.test.mjs`).

## Lager organisieren: fotos y análisis
1. **Lager organisieren** → crear los espacios (Büro, Werkstatt, Keller …) → **Fotos importieren** (fotos, carpeta, ZIP o cámara).
2. El análisis de imágenes **no** corre dentro de la app (no hay servicio de IA conectado). Lo hace Claude a partir de los
   archivos originales y entrega un archivo `…-Fotoanalyse.json`.
3. **Fotos importieren → KI-Ergebnis importieren**: elegir ese archivo. Se asigna por la huella SHA-256 de cada foto;
   repetir la importación no duplica nada. Fotos aún no importadas aparecen como «nicht zugeordnet».
4. **KI-Erkennung prüfen**: confirmar, corregir, fusionar o dejar para más tarde. Solo lo confirmado pasa al inventario.
Concepto completo: [ORGANIZACION.md](ORGANIZACION.md).

## Pruebas automáticas (para desarrolladores)
`cd tests && npm install && npm test` (base de datos con PGlite, incl. migración desde la versión anterior) ·
`node --test tests/api-demo.test.mjs tests/api-demo-org.test.mjs` (capa de datos del modo demo).

## Límites del plan gratuito de Supabase
500 MB de base de datos, 1 GB de archivos (las fotos se reducen a 1600 px), pocos correos por hora con el servidor de
correo incluido. Un proyecto sin uso durante 7 días se pausa (se reactiva en el panel). Copia de seguridad: exportar
las listas a Excel desde la app o desde el panel de Supabase.
