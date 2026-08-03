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

### 1. Administración de catálogos (explícitamente incompleta)

En **Administración** solo funciona **Razas**. Marcadas como “próximamente”:

- Categorías de animal
- Estados de animal
- Tipos de corral
- Lotes

**Impacto:** no se pueden administrar estos catálogos desde la UI; hoy dependen de datos ya cargados en base.

### 2. Gestión de ventas (UI incompleta)

En `/gestion/ventas` los botones de **nueva venta / editar / eliminar** **no guardan en la base** (solo cierran el diálogo).

Sí se puede registrar venta al marcar un animal como **vendido** (ficha del animal) y existe API de soporte.

**Impacto:** la pantalla de “Gestión de Ventas” no es un CRUD confiable para el cliente final.

### 3. Búsqueda global del encabezado

El buscador “Buscar animal, módulo…” del navbar **no está conectado** a ninguna búsqueda real.

### 4. Catálogos de administración vs datos reales

Aunque categorías/estados/lotes existen en base de datos (la app los usa), **no hay pantallas** para mantenerlos.

### 5. Documentación y onboarding técnico

| Problema | Por qué importa al cliente |
|----------|----------------------------|
| README dice “datos mock” | Genera expectativa equivocada del producto |
| Schema base español no está versionado en el repo | Dificulta reproducir el entorno o auditar la BD |
| Falta `.env.example` | Más fricción al desplegar o capacitar |
| Solo el módulo **Salud** sigue la arquitectura modular formal | El resto funciona, pero es más costoso de mantener/escalar |

### 6. Lo que no es un producto “faltante”, pero conviene tener claro

- **Multi-granja / multi-tenant avanzado:** hoy el modelo es **una granja por usuario** (aislamiento correcto), no un SaaS multi-cliente listo para vender a muchas fincas sin trabajo adicional.
- **App móvil / offline:** no hay.
- **Notificaciones push / WhatsApp / email:** la “mensajería” es bandeja interna de aprobaciones, no chat ni correo.
- **Validación formal (Zod) y tipos generados de BD:** pendientes a nivel ingeniería; no bloquean el uso diario, sí la calidad a largo plazo.
- **Protección de rutas:** requiere activar `AUTH_PROXY_ENFORCE=true` en el entorno.

---

## Mapa de pantallas (menú principal)

**Operación:** Dashboard · Animales · Módulos · Alimentación · Costos · Salud · Ventas · Reportes

**Administración:** Administración (parcial) · Gestión de Datos (hub) · Mensajería

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
| ¿Qué falta con más impacto de negocio? | Catálogos de Administración; CRUD real de Ventas en Gestión; búsqueda global |
| ¿Qué ya está fuerte? | Animales, corrales, alimentación, costos, salud, comprobantes PDF, aprobaciones gerenciales, reportes |
| ¿Riesgo principal? | Documentación/esquema desalineados con la realidad (dificulta soporte, auditoría y expansión) |

---

## Prioridades sugeridas

1. **Alta:** Completar CRUD de ventas en Gestión (o quitar botones que no hacen nada).
2. **Alta:** Pantallas de Administración para categorías, estados, tipos de corral y lotes.
3. **Media:** Conectar búsqueda del navbar.
4. **Media:** Actualizar README y versionar el schema real de producción.
5. **Baja/ingeniería:** Modularizar el resto como Salud; Zod + tipos generados; endurecer auth por defecto en todos los entornos.

---

## Documentación relacionada en el repo

| Documento | Contenido |
|-----------|-----------|
| `README.md` | Arranque del proyecto (parcialmente desactualizado) |
| `docs/auth-ola1.md` | Auth Supabase + aislamiento de granja |
| `docs/salud.md` | Módulo Salud (técnico) |
| `docs/salud-ola0.md` | Contrato de tablas de Salud |
