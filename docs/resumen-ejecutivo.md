# Resumen ejecutivo — SGGE (Sistema de Gestión Ganadera de Engorda)

**Fecha:** 3 de agosto de 2026

**SGGE** es una aplicación web para operar una granja de **engorda de ganado bovino**: inventario, corrales, alimentación, costos, salud, ventas, reportes y control gerencial. Está pensada para **operadores y gerentes** de finca, con contexto operativo de **Costa Rica** (facturas PDF, moneda ₡, emisores locales).

**Estado general:** el sistema **ya no es un prototipo con datos ficticios**. Funciona con **base de datos real (Supabase/PostgreSQL)** y APIs propias. El `README.md` del repositorio aún menciona datos mock; eso está **desactualizado**.

---

## Qué puede hacer hoy el sistema

| Área | Para el negocio | Estado |
|------|-----------------|--------|
| **Dashboard** | KPIs del ciclo de engorda, pesos, costos, alertas y ventas recientes | Operativo |
| **Animales** | Inventario, alta/edición, pesajes, ficha, actas, historial, baja con aprobación | Operativo |
| **Módulos / corrales** | Capacidad, ocupación, códigos reutilizables, detalle por corral | Operativo |
| **Alimentación** | Catálogo de insumos, compras, entregas/raciones, costos y KPIs | Operativo |
| **Costos** | Gastos manuales y desde facturas; análisis por período/categoría | Operativo |
| **Salud** | Tratamientos, alertas, medicamentos, importación PDF, exportación | Operativo (más maduro) |
| **Ventas (consulta)** | Listado, ingresos, gráficas | Operativo (lectura) |
| **Reportes** | Flujo financiero, rentabilidad, GDP, conversión alimenticia | Operativo |
| **Comprobantes PDF** | Subir factura → clasificar → confirmar → genera gasto, compra de ganado, ALIM o VET | Operativo (fortaleza del sistema) |
| **Mensajería / aprobaciones** | Gerente aprueba o rechaza bajas y solicitudes | Operativo |
| **Historial / auditoría** | Libro de actas del sistema y del animal | Operativo |
| **Login y aislamiento por granja** | Usuario solo ve su granja | Operativo (Ola 1) |

---

## Secciones que sí hacen falta o están incompletas

### 1. Administración de catálogos — resuelto

En **Administración** ya se pueden mantener desde la UI:

- Razas
- Categorías de animal (rangos de peso)
- Estados de animal
- Tipos de corral (requiere migración `20260803120000_tipos_corral.sql` para persistir altas/ediciones)
- Lotes (abrir / cerrar)

**Nota:** tipos de corral muestra el catálogo por defecto hasta aplicar la migración.

### 2. Gestión de ventas — resuelto

En `/gestion/ventas` ya funcionan **nueva venta / editar / eliminar** contra la base:

- Alta: selecciona animal activo/enfermo → marca vendido y crea `ventas` + `detalle_ventas`
- Edición: peso, ₡/kg, comprador y fecha
- Eliminación: revierte el animal a activo y ajusta ocupación del corral

También se puede registrar venta desde la ficha del animal.

### 3. Búsqueda global del encabezado — resuelto

El buscador del navbar consulta `/api/search` (animales por arete y módulos por código/nombre) y navega al detalle.

### 4. Catálogos de administración

Las pantallas de Administración permiten mantener categorías, estados, tipos de corral y lotes (además de razas).

### 5. Documentación y onboarding técnico

| Problema | Estado |
|----------|--------|
| README decía “datos mock” | **Resuelto** — README actualizado a Supabase real |
| Falta `.env.example` | **Resuelto** — plantilla en la raíz del repo |
| Schema base español no versionado en el repo | **Pendiente** (backlog) — dificulta reproducir/auditar BD |
| Solo el módulo **Salud** sigue la arquitectura modular formal | **Pendiente** (ingeniería) |

### 6. Rendimiento de navegación — resuelto (3 ago 2026)

La navegación entre secciones ya no “arranca en blanco” en cada visita:

- Caché cliente **stale-while-revalidate** en `useApiQuery` (`lib/hooks/api-cache.ts`)
- Hooks de dominio (animales, ventas, módulos, costos) reutilizan la misma caché e invalidan tras mutaciones
- Sesión (`/api/session`) con **single-flight**: Sidebar/Admin/Mensajería comparten un fetch
- Datos frescos en segundo plano tras ~45s (`staleTime`)

### 7. Lo que no es un producto “faltante”, pero conviene tener claro

- **Multi-granja / multi-tenant avanzado:** hoy el modelo es **una granja por usuario** (aislamiento correcto), no un SaaS multi-cliente listo para vender a muchas fincas sin trabajo adicional.
- **App móvil / offline:** no hay.
- **Notificaciones push / WhatsApp / email:** la “mensajería” es bandeja interna de aprobaciones, no chat ni correo.
- **Validación formal (Zod) y tipos generados de BD:** pendientes a nivel ingeniería; no bloquean el uso diario, sí la calidad a largo plazo.
- **Protección de rutas:** resuelto. El proxy protege las rutas de app y administración de forma incondicional, sin bandera de activación.
- **Migración `tipos_corral` en remoto:** aplicar `supabase/migrations/20260803120000_tipos_corral.sql` si aún no está en producción.

---

## Mapa de pantallas (menú principal)

**Operación:** Dashboard · Animales · Módulos · Alimentación · Costos · Salud · Ventas · Reportes

**Administración:** Administración · Gestión de Datos (hub) · Mensajería

**Dentro de Gestión de Datos:** animales, historial, módulos, salud, alimentación, costos, ventas, comprobantes, mensajería.

---

## Fortaleza diferencial del producto

El flujo de **comprobantes PDF → datos operativos** es el diferenciador:

1. Se sube la factura PDF
2. El sistema la clasifica (gasto, compra de ganado, venta, ignorar, pendiente)
3. Al confirmar, alimenta **costos**, **compras/animales**, **alimentación (ALIM)** o **salud (VET)**

Eso reduce captura manual y conecta finanzas con operación.

---

## Stack técnico (referencia)

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Gráficas | Recharts |
| Backend / datos | Supabase (Auth + PostgreSQL) |
| APIs | Route Handlers en `app/api/*` |
| PDF | `unpdf` + parsers propios (`lib/api/pdf/`) |
| Auth UI | Proxy Next.js 16 (`proxy.ts`) + aislamiento por `granja_id` |

---

## Veredicto para el cliente

| Pregunta | Respuesta |
|----------|-----------|
| ¿Hay un sistema usable para operar la engorda? | **Sí** — núcleo operativo listo |
| ¿Está completo al 100%? | **No** |
| ¿Qué falta con más impacto de negocio? | Documentación/schema versionado; endurecer auth por defecto |
| ¿Qué ya está fuerte? | Animales, corrales, alimentación, costos, salud, comprobantes PDF, aprobaciones gerenciales, reportes |
| ¿Riesgo principal? | Documentación/esquema desalineados con la realidad (dificulta soporte, auditoría y expansión) |

---

## Prioridades sugeridas

1. **Media:** Versionar el schema real de producción en el repo; confirmar migración `tipos_corral` en el remoto.
2. **Baja/ingeniería:** Modularizar el resto como Salud; Zod + tipos generados; auth enforce por defecto en todos los entornos.

> Completado: catálogos de Administración · CRUD de ventas en Gestión · búsqueda global del navbar · caché de navegación entre secciones · README + `.env.example`.

---

## Documentación relacionada en el repo

| Documento | Contenido |
|-----------|-----------|
| `README.md` | Arranque del proyecto (parcialmente desactualizado) |
| `docs/auth-ola1.md` | Auth Supabase + aislamiento de granja |
| `docs/salud.md` | Módulo Salud (técnico) |
| `docs/salud-ola0.md` | Contrato de tablas de Salud |
