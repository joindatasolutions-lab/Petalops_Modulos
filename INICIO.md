# Cómo iniciar el frontend (Petalops)

Guía paso a paso para levantar el proyecto en local. Es una app **React + Vite**.

## Requisitos previos

- Node.js instalado (recomendado v18 o superior). En esta máquina ya está: `node -v` → v24.14.0
- npm instalado (ya está: `npm -v` → 11.9.0)

## Paso a paso

### 1. Ubicarte en la carpeta del proyecto

```powershell
cd "c:\Users\CAA4746\Documents\JOIN\Arquitectura\Petalops_Modulos-main\Petalops_Modulos-main"
```

### 2. Instalar dependencias

```powershell
npm install
```

> Nota: en esta máquina ya existe una carpeta `node_modules`, es decir que ya se instaló antes. Si no hiciste cambios en `package.json`, puedes saltarte este paso.

### 3. Levantar el entorno de desarrollo

```powershell
npm run dev
```

Esto inicia Vite en modo desarrollo. Por defecto corre en:

```
http://localhost:5173
```

(La consola te mostrará la URL exacta al levantar).

### 4. Abrir en el navegador

Entra a la URL que te mostró la terminal (normalmente [http://localhost:5173](http://localhost:5173)).

## Configuración del backend (API)

El frontend no trae un backend local incluido. Por defecto, en modo desarrollo se conecta automáticamente a la API en la nube (Cloud Run), así que **no necesitas configurar nada para empezar a probar**.

Si quieres apuntar a un backend corriendo en tu máquina (por ejemplo `joinflower-api` en `http://127.0.0.1:8001`), Vite ya tiene un proxy configurado en [vite.config.js](vite.config.js) para `/api`. Para usarlo:

1. Crea un archivo `.env` en la raíz del proyecto con:
   ```
   VITE_API_BASE_URL=/api
   ```
2. Asegúrate de que tu backend local esté corriendo en `http://127.0.0.1:8001`.
3. Reinicia `npm run dev`.

## Configuración de tenant (empresa/sucursal)

Si necesitas cambiar el tenant (empresa/sucursal) para probar otra floristería, edita:

```
src/config/tenantConfig.js
```

Ahí puedes ajustar `empresaId` y `sucursalId`.

## Otros comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta el servidor de desarrollo (con recarga en caliente) |
| `npm run build` | Genera el build de producción en `dist/` |
| `npm run preview` | Sirve localmente el build de producción ya generado |
| `npm test` | Corre los tests con Vitest |

## Resumen rápido (copiar y pegar)

```powershell
cd "c:\Users\CAA4746\Documents\JOIN\Arquitectura\Petalops_Modulos-main\Petalops_Modulos-main"
npm install
npm run dev
```

Luego abre [http://localhost:5173](http://localhost:5173) en el navegador.
