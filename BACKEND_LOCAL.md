# Apuntar el frontend al backend local (y volver a la nube)

Guía para repetir lo que dejamos configurado: frontend en `localhost:5173` hablando con el
backend FastAPI corriendo en tu máquina (`127.0.0.1:8001`), en vez del backend en la nube
(Cloud Run).

## Cómo está armado

- [vite.config.js](vite.config.js) ya tiene un proxy: todo lo que el frontend pida a `/api`
  se reenvía a `http://127.0.0.1:8001`.
- [src/config/tenantConfig.js](src/config/tenantConfig.js) decide la URL base de la API:
  - Si existe la variable `VITE_API_BASE_URL=/api` → usa el proxy → backend local.
  - Si no existe (o el `.env` no está) → usa el backend de Cloud Run por defecto.
- Vite solo lee el archivo `.env` **al arrancar**, no en caliente. Por eso cada vez que
  cambias el `.env` hay que reiniciar `npm run dev`.

## 1. Levantar el backend local

Backend: `C:\Users\CAA4746\Documents\JOIN\Arquitectura\nuevoPetalops\joinflower-api-main\joinflower-api-main`

```powershell
cd "C:\Users\CAA4746\Documents\JOIN\Arquitectura\nuevoPetalops\joinflower-api-main\joinflower-api-main"

$env:DATABASE_HOST     = "136.119.27.100"
$env:DATABASE_PORT     = "5432"
$env:DATABASE_NAME     = "joinflower-dev"
$env:DATABASE_USER     = "joindata"
$env:DATABASE_PASSWORD = "<contraseña actual de joindata>"

python -m app.main
```

Por defecto arranca en el puerto **8001** (coincide con el proxy de Vite, no hay que tocar
nada más). Verifica que quedó arriba y conectado a la base de datos:

```powershell
curl http://127.0.0.1:8001/health
curl http://127.0.0.1:8001/db-connection
```

> Nota: las credenciales se pasan como variables de entorno de la sesión de PowerShell, no
> se guardan en ningún archivo del repo del backend. Si cierras esa terminal, se pierden
> (tendrás que volver a exportarlas la próxima vez).

## 2. Apuntar el frontend al backend local

En la raíz de este proyecto, crea (o edita) el archivo `.env`:

```
VITE_API_BASE_URL=/api
```

Reinicia el servidor de desarrollo para que tome el cambio:

```powershell
cd "C:\Users\CAA4746\Documents\JOIN\Arquitectura\Petalops_Modulos-main\Petalops_Modulos-main"
npm run dev
```

Verifica que el proxy llega al backend local:

```powershell
curl http://localhost:5173/api/health
```

Si responde `{"status":"ok"}`, ya estás probando contra tu backend local en
[http://localhost:5173](http://localhost:5173).

## 3. Volver a apuntar a la nube (revertir)

1. Borra (o vacía) el archivo `.env` del frontend:

   ```powershell
   Remove-Item "C:\Users\CAA4746\Documents\JOIN\Arquitectura\Petalops_Modulos-main\Petalops_Modulos-main\.env"
   ```

2. Reinicia `npm run dev` para que Vite vuelva a leer la config sin `VITE_API_BASE_URL`
   (con eso `tenantConfig.js` cae de nuevo al backend de Cloud Run por defecto).

3. (Opcional) Detén el backend local: en la terminal donde corre `python -m app.main`,
   `Ctrl+C`.

No hace falta tocar `vite.config.js` ni `tenantConfig.js` en ningún paso — el proxy y el
fallback a Cloud Run ya están pensados para este ir-y-volver.
