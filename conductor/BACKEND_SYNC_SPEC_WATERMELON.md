# Especificación de Sincronización (WatermelonDB Protocol)

## 1. Cambio de Paradigma: WatermelonDB vs. Custom Sync
Tras analizar tu codebase, he detectado que **no estás usando Drizzle**, sino **WatermelonDB**.

Esto es una **excelente noticia**. WatermelonDB ya incluye un motor de sincronización potente (`@nozbe/watermelondb/sync`) que maneja automáticamente:
- Qué registros han cambiado.
- Resolución de conflictos básica.
- Gestión de IDs y consistencia.

Por tanto, **no debes reinventar la rueda**. Tu backend solo debe cumplir con el "WatermelonDB Sync Protocol".

---

## 2. Protocolo de Comunicación (API Contract)

El cliente enviará y recibirá datos en un formato específico JSON.

### A. Endpoint: `GET /sync` (Pull)
El cliente pide cambios ocurridos desde `last_pulled_at`.

**Request:**
- `last_pulled_at`: Timestamp (o null si es la primera vez).
- `schema_version`: Versión del esquema local (útil para migraciones).
- `migration`: null (por ahora).

**Response:**
```json
{
  "changes": {
    "expenses": {
      "created": [], // Array de objetos Expense
      "updated": [], // Array de objetos Expense
      "deleted": []  // Array de IDs (Strings)
    },
    "categories": {
      "created": [],
      "updated": [],
      "deleted": []
    },
    // ... igual para budgets y rules
  },
  "timestamp": 1699999999 // Nuevo timestamp del servidor
}
```

### B. Endpoint: `POST /sync` (Push)
El cliente envía sus cambios locales.

**Request:**
```json
{
  "changes": {
    "expenses": {
      "created": [], // Objetos creados localmente
      "updated": [], // Objetos modificados localmente
      "deleted": []  // IDs borrados localmente
    },
    // ... otras tablas
  },
  "last_pulled_at": 1699999999 // Timestamp base para detectar conflictos
}
```

**Response:**
- `200 OK` si se aplicaron los cambios.
- Error si hubo conflicto irresoluble (raro en este modelo).

---

## 3. Plan de Implementación en la App (Cliente)

### Paso 1: Instalar Dependencias
Necesitas un cliente HTTP robusto si no lo tienes.
`bun add axios` (o usa `fetch` nativo).

### Paso 2: Crear el Servicio de Sincronización (`services/sync.ts`)
Este archivo encapsulará la lógica de WatermelonDB.

```typescript
import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from '@/database'; // Tu instancia de DB

export async function sync() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
      const response = await fetch(`https://api.tu-app.com/sync/pull?last_pulled_at=${lastPulledAt || 0}`);
      if (!response.ok) throw new Error(await response.text());
      
      const { changes, timestamp } = await response.json();
      return { changes, timestamp };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const response = await fetch(`https://api.tu-app.com/sync/push?last_pulled_at=${lastPulledAt}`, {
        method: 'POST',
        body: JSON.stringify(changes)
      });
      if (!response.ok) throw new Error(await response.text());
    },
    migrationsEnabledAtVersion: 1,
  });
}
```

### Paso 3: Integración UI
1.  Crear un hook `useSync()` que exponga el estado (`isSyncing`, `error`).
2.  Añadir un botón en "Perfil" o "Configuración" para forzar la sincronización manual.
3.  (Opcional) Sincronizar automáticamente en `app/_layout.tsx` al iniciar la app (usando `useEffect`).

---

## 4. Cambios en Base de Datos (Schema)
Tu esquema actual (`database/schema.ts`) **ya es compatible**:
- WatermelonDB usa IDs de tipo string por defecto (compatible con UUIDs).
- Tus tablas ya tienen `created_at` y `updated_at` gestionados por los decoradores `@date` y `@readonly`.
- El campo `_status` (interno de Watermelon) maneja si un registro está marcado como `created`, `updated` o `deleted` localmente.

**No necesitas migrar tu base de datos local.** El adaptador de WatermelonDB hace la magia.
