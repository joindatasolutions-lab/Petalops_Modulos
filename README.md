# Petalops (Pedidos Admin)

Proyecto independiente para gestión administrativa de pedidos.

## Ejecutar

Abre `index.html` con Live Server (o cualquier servidor estático).

## Configuración

Edita `app/core/config.js`:

- `apiBaseUrl`
- `empresaId`
- `sucursalId`

## Arquitectura modular

- `app/core/`: config, estado global, store
- `app/infrastructure/`: cliente HTTP API
- `app/domain/orders-admin/`: módulo de pedidos (tabla, drawer, acciones)
- `app/shared/`: utilidades DOM y formato
