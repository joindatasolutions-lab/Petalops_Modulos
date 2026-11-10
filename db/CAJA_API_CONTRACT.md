# Caja: integración pendiente del servicio

El frontend incluye la nueva pantalla y consume el contrato descrito aquí.
Este repositorio no contiene el backend de contabilidad. La migración
`migrations/2026-10-23_caja_arqueo.sql` está preparada, no aplicada.
No se debe considerar disponible la persistencia del arqueo hasta implementar
y comprobar estos cambios en el servicio.

## Cierres existentes

`PUT /contabilidad/caja/cierre` añade `arqueo` (objeto denominación/cantidad)
y `totalContado`. Ejemplo:

```json
{
  "sucursalID": 1,
  "fecha": "2026-10-22",
  "base": 88200,
  "guardado": 0,
  "observacion": "",
  "arqueo": {"100000": 1, "50000": 1, "20000": 1, "5000": 1, "200": 6},
  "totalContado": 176200
}
```

El servicio obtiene empresa y usuario del JWT y valida el acceso a sucursal.
No confiar en empresaID/usuarioID ni en los totales enviados por el cliente.
En una transacción bloquear el cierre correspondiente, calcular ingresos
efectivamente recibidos en efectivo (incluida solo la porción en efectivo de
pagos mixtos), sumar gastos registrados y validar cantidades del arqueo.
Denominaciones admitidas: 100000, 50000, 20000, 10000, 5000, 2000,
1000, 500, 200, 100, 50. Cantidades enteras entre 0 y 1000000.

- Esperado = base inicial + ingresos en efectivo − gastos registrados.
- Contado = suma de denominación × cantidad.
- Diferencia = contado − esperado.
- Nueva base = contado − guardado. Rechazar guardado mayor al contado.

Persistir el arqueo, total contado, base, guardado, nueva base y observación.
GET de listado y día y respuesta del PUT deben devolver `arqueo` y
`totalContado` (también se admiten `arqueo_denominaciones` y `total_contado`).
Valores NULL en cierres históricos se conservan: no inferir un conteo.
El frontend consulta de nuevo el cierre tras guardarlo y advierte si el
servicio no devuelve el conteo enviado.

## Gastos

- `GET /contabilidad/caja/gastos?sucursalID=1&fecha=2026-10-22` devuelve
  `{"items":[{"id_caja_gasto":1,"concepto":"Transporte","monto":5000}]}`.
- `POST /contabilidad/caja/gastos` recibe `sucursalID`, `fecha`,
  `concepto` (1–160 caracteres) y `monto` positivo.

Validar fecha no futura, contexto autenticado y sucursal. Crear la apertura
del día si no existe, registrar el gasto y actualizar totales en una
transacción. Cada consulta debe filtrar empresa_id y sucursal_id.
No reemplazar gastos individuales con un importe agregado del formulario.
Tras guardar, el frontend recarga el total desde el endpoint diario.

## Pendiente del backend

La caja menor de esta pantalla representa el monto guardado en cada cierre.
El libro independiente de reposiciones y pagos del fondo de caja menor
requiere su modelo y endpoints; no se simula con datos locales.
Antes de desplegar, probar aislamiento entre empresas, acceso a sucursales,
pagos mixtos, doble envío de gastos, concurrencia de cierres y lectura del
arqueo después de recargar la página.
