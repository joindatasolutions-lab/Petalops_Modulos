# Petalops (Pedidos Admin) - React

Proyecto de gestión administrativa de pedidos migrado a React + Vite.

## Ejecutar

1. Instala dependencias:

	`npm install`

2. Levanta el entorno de desarrollo:

	`npm run dev`

3. Construye para producción:

	`npm run build`

4. Previsualiza build local:

	`npm run preview`

## Configuración de tenant

Edita `src/config/tenantConfig.js`:

- `apiBaseUrl`
- `empresaId`
- `sucursalId`

Esta configuración permite adaptar el panel para distintas floristerías (multi-tenant) cambiando el contexto del negocio.

## Arquitectura actual

- `src/domain/orders-admin/`: pantalla principal de pedidos y detalle
- `src/infrastructure/`: cliente HTTP API
- `src/shared/`: hooks y utilidades comunes
- `src/config/`: configuración de tenant

## Estado

El repositorio queda enfocado 100% en React + Vite.
