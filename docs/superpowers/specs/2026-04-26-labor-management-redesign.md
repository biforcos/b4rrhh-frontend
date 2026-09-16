# Rediseño: Gestión Laboral del Empleado

**Fecha:** 2026-04-26  
**Estado:** Aprobado — pendiente de plan de implementación  
**Scope:** Frontend únicamente. Cero cambios de backend, API ni stores.

---

## 1. Motivación

La interfaz de gestión laboral (tabs Laborales y Organizativos) y el journey del empleado presentan dos problemas:

1. **Visual pobre**: los componentes carecen de jerarquía visual, tipografía débil y densidad de información baja. No transmiten profesionalidad para un HRMS.
2. **UX de edición confusa**: el patrón `temporal-section` expone un vocabulario de _acciones_ (Reemplazar desde fecha / Corregir / Cerrar) que no corresponde al modelo mental del dato subyacente, que es simplemente **fecha_inicio — fecha_fin — valor(es)**. Esto hace que iterar sobre los datos sea costoso.

El journey ya tiene una estructura de datos correcta (presencias como capítulos, eventos dentro) pero el tratamiento visual es genérico.

---

## 2. Scope

### Incluido
| Área | Qué cambia |
|------|-----------|
| Tab **Laborales** — Presencia | Rediseño visual como card compacta (sigue siendo solo lectura) |
| Tab **Laborales** — Contrato | Sustituye `temporal-section` por tabla de períodos + modal |
| Tab **Laborales** — Jornada | Ídem |
| Tab **Laborales** — Convenio y categoría | Ídem |
| Tab **Organizativos** — Centro de trabajo | Ídem |
| Tab **Organizativos** — Centro de coste | Tabla de distribuciones por período + modal (adaptado) |
| **Journey timeline** | Rediseño visual completo a Estilo C (cards con cabecera de color) |

### Excluido
- Tab **Personales** (contactos, direcciones, identificadores) — trabajo separado
- Flujos de lifecycle (alta, baja, reingreso) — se mantienen tal cual
- Backend, API, OpenAPI, stores, gateways, mappers — sin cambios

---

## 3. Decisiones de diseño

### 3.1 Patrón: tabla de períodos

Todos los conceptos temporales (contrato, jornada, clasificación, centro de trabajo) se presentan como una tabla limpia:

```
┌─────────────────────┬──────────────────┬──────────┬─────────────┬─────┐
│ Período             │ [campos del dato]│ Estado   │             │     │
├─────────────────────┼──────────────────┼──────────┼─────────────┼─────┤
│ 01/04/2024 — vigor  │ Indefinido ord.  │ ● Vigente│             │ ✏   │
│ 01/01/2022 — 31/03… │ Temporal         │ Cerrado  │             │ ✏ 🗑│
└─────────────────────┴──────────────────┴──────────┴─────────────┴─────┘
```

**Reglas de comportamiento:**
- La fila del período vigente (sin fecha fin) se resalta ligeramente y solo tiene acción de editar.
- Las filas históricas tienen editar + eliminar.
- El botón "+ Nuevo período" vive en la cabecera de la sección.
- No existe vocabulario de "acciones" (reemplazar / corregir / cerrar). El usuario edita fechas y valores directamente.

### 3.2 Edición vía modal

Al hacer clic en ✏ o "+ Nuevo período" se abre un modal centrado:

- **Cabecera**: título descriptivo ("Editar período — Contrato") + subtítulo con el período actual.
- **Cuerpo**: campos del concepto (fecha inicio, fecha fin, valores específicos).
- **Footer**: "Cancelar" + "Guardar cambios".
- **Errores de validación**: se muestran inline en el modal (no en el message rail global).
- **Errores de backend**: siguen en el message rail global (toast).
- **Estado de guardado**: el botón "Guardar" muestra spinner durante la llamada.

**Semántica de "Nuevo período":** cuando existe un período vigente (sin fecha fin), crear un nuevo período implica cerrar el vigente. El frontend envía la fecha de inicio del nuevo período; el backend calcula y aplica el cierre del anterior (mismo comportamiento que el actual "reemplazar desde fecha"). No es responsabilidad del frontend gestionar el solapamiento.

**Editar un período vigente:** la fecha fin del período activo es de solo lectura en el modal de edición estándar (`en vigor`). Para cerrar explícitamente un período sin abrir uno nuevo (ej: cerrar jornada parcial sin nueva jornada), existe un botón secundario "Cerrar período" en el modal que despliega únicamente el campo de fecha fin.

**Eliminar un período histórico:** el botón 🗑 muestra un diálogo de confirmación antes de eliminar.

### 3.3 Presencia — card compacta (solo lectura)

La presencia activa se muestra en una card horizontal compacta en la parte superior de la pestaña Laborales. Muestra: empresa, motivo de alta, fecha, número de presencia y badge de estado. Sin formulario de edición (las altas/bajas siguen siendo flujos dedicados).

### 3.4 Journey — Estilo C (cards con cabecera de color)

Cada presencia es una card con:
- **Cabecera activa**: gradiente azul-índigo con nombre de empresa, período y badge blanco "Activo".
- **Cabecera cerrada**: fondo gris neutro, texto gris oscuro, badge "Cerrado".
- **Cuerpo**: lista de eventos con icono de categoría (círculo de color) + label + fecha + detalle opcional.
- **Categorías de icono**: Alta/Reingreso (verde), Baja (rojo), Contrato (violeta), Jornada (azul cielo), Clasificación (índigo).

La estructura de datos no cambia (presencias agrupadas, eventos por fecha). Solo cambia el template y SCSS.

---

## 4. Tokens de diseño

```scss
// Backgrounds
--page-bg:    #f1f5f9;
--card-bg:    #ffffff;
--table-head: #fafafa;
--row-active: #fafffe;   // fila período vigente

// Borders
--border:     1px solid #e5e7eb;
--radius-card: 10px;
--radius-btn:  7px;

// Accent
--accent:     #6366f1;   // botones CTA, border-active
--accent-bg:  #eff6ff;

// Status
--status-active-bg:   #dcfce7;
--status-active-text: #166534;
--status-closed-bg:   #f3f4f6;
--status-closed-text: #9ca3af;

// Journey headers
--journey-active-from: #1d4ed8;
--journey-active-to:   #4f46e5;
--journey-closed-bg:   #f3f4f6;
```

---

## 5. Cambios por componente

### 5.1 Nuevos componentes compartidos

| Componente | Ruta | Propósito |
|-----------|------|-----------|
| `period-table` | `shared/period-table/` | Tabla genérica de períodos. Recibe columnas, filas y callbacks. |
| `period-modal` | `shared/period-modal/` | Shell del modal de edición. Recibe título, cuerpo (ng-content) y callbacks de submit/cancel. |

### 5.2 Componentes a rediseñar (solo template + SCSS)

| Componente actual | Cambio |
|------------------|--------|
| `employee-presence-block` | → card horizontal compacta |
| `employee-contract-section` | → usa `period-table` + `period-modal` |
| `employee-working-time-section` | → usa `period-table` + `period-modal` |
| `employee-labor-classification-section` | → usa `period-table` + `period-modal` |
| `employee-work-center-section` | → usa `period-table` + `period-modal` |
| `employee-cost-center-section` | → tabla de distribuciones por período + `period-modal` |
| `employee-journey-timeline` | → rediseño visual completo (Estilo C) |

### 5.3 Componentes a retirar

| Componente | Motivo |
|-----------|--------|
| `temporal-section` | Sustituido por `period-table` + `period-modal`. Eliminar cuando todas las secciones migren. |
| Placeholder "futuras funcionalidades" en Organizativos | Quitar el bloque visible. El hueco quedará limpio. |

### 5.4 Stores / gateways / mappers

**Sin cambios.** Toda la lógica de negocio, las llamadas HTTP y la transformación de datos permanecen intactos. Los nuevos componentes consumen los mismos stores que los actuales.

---

## 6. Comportamiento de la tabla de períodos por concepto

### Contrato
| Columna | Fuente |
|---------|--------|
| Período | `startDate` — `endDate` (o "en vigor") |
| Tipo | `contractTypeName` |
| Subtipo | `contractSubtypeName` (badge si existe; vacío si no aplica) |
| Estado | `isActive` |

### Jornada
| Columna | Fuente |
|---------|--------|
| Período | `startDate` — `endDate` |
| Porcentaje | `workingTimePercentage` |
| Horas/semana | `weeklyHours` (+ `dailyHours` como subtexto) |
| Estado | `isActive` |

### Convenio y categoría
| Columna | Fuente |
|---------|--------|
| Período | `startDate` — `endDate` |
| Convenio | `agreementName` |
| Categoría | `agreementCategoryName` (+ código como subtexto) |
| Estado | `isActive` |

### Centro de trabajo
| Columna | Fuente |
|---------|--------|
| Período | `startDate` — `endDate` |
| Centro | `workCenterName` |
| Estado | `isActive` |

### Centro de coste
La distribución de coste tiene una estructura diferente (múltiples líneas por ventana temporal). Se presenta como tabla de ventanas:

| Columna | Fuente |
|---------|--------|
| Período | `startDate` — `endDate` |
| Centros | Lista compacta de `costCenterName (XX%)` |
| Total | `totalAllocationPercentage` (debe ser 100%) |
| Estado | derivado de fechas |

El modal de edición para coste muestra el editor de distribución existente (sin cambios en lógica).

---

## 7. Journey — Estructura de eventos por categoría

| Categoría | Color icono | Eventos |
|-----------|------------|---------|
| Alta / Reingreso | Verde `#dcfce7` | `HIRE`, `REHIRE` |
| Baja | Rojo `#fee2e2` | `TERMINATE` |
| Contrato | Violeta `#ede9fe` | cambios de contrato |
| Jornada | Azul cielo `#e0f2fe` | cambios de jornada |
| Clasificación | Índigo `#eef2ff` | cambios de convenio/categoría |
| Otros | Gris `#f3f4f6` | resto de eventos |

---

## 8. Fases de implementación sugeridas

| Fase | Contenido | Condición de "done" |
|------|-----------|---------------------|
| 1 | Shared: `period-table` + `period-modal` | Componentes renderizados con datos mock, tests unitarios |
| 2 | Tab Laborales: 3 secciones + presencia card | Paridad funcional con el estado actual, visual nuevo |
| 3 | Tab Organizativos: centro de trabajo + centro de coste | Ídem |
| 4 | Journey timeline | Rediseño visual completo |

Cada fase es independiente y deployable.

---

## 9. Referencias visuales

Los mockups de referencia están en:
```
docs/superpowers/mockups/2026-04-26-labor-management-redesign/
  labor-approach.html       — comparativa de los 3 enfoques de tabla
  journey-style.html        — comparativa de los 3 estilos de journey
  laborales-fullpage.html   — mockup completo aprobado de la pestaña Laborales
```
