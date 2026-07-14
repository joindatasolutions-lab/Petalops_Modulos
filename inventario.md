PROPUESTA MODULO INVENTARIO


Llevarlo por mòdulos o pestañas dentro del módulo inventario:
NO mezcles:
flores
materiales
adicionales
en una sola tabla.
Porque:
Las flores vencen
Los materiales se consumen diferente
Los chocolates manejan lotes
Las bases tienen variantes
Separarlos por módulos.


MODULOS:

INVENTARIO DE FLORES
INVENTARIO DE BASES
MATERIALES
ADICIONALES CATALOGO
ARREGLOS
MOVIMIENTOS









MÓDULO 1: INVENTARIO DE FLORES: flores y follaje





Categoria: Flores
Subcategoría: Rosas, Girasoles, Hortensias, Claveles, follaje
Crear un item: codigo, categoria, subcategoria, color, descripción, proveedor, descripción, cantidad( und, paquetes)

Algunas funciones como:
Alertas de flores bajas STOCK
 Alertas de vencimiento
Registro de flores dañadas
Historial de compras 

MODULO 2: INVENTARIO DE BASES
Bases
categoría: Box, Madera, Vidrio, Cerámica
Crear un item: codigo, producto, categoria, subcategoria, tamaño, color,  descripción, proveedor, cantidad

Algunas funciones tener en cuenta:
Saber qué bases se venden más
Control de reposición (Stock) alarmas





OPCION 2 me gusta mas esta



MODULO 3: INVENTARIO DE MATERIALES: todo lo decorativo de los arreglos  e insumos opertativos




categorias: Cintas, Papeles, Celofán, Moños, Yute, Oasis, plastico, frascos.  INSUMOS OPERATIVOS:  Cinta transparente
Tijeras, Bolsas, etiquetas, Pegante, Grapadora, colibries tarjetas de mensajes

Esto ayuda a controlar gastos internos.  

crear item:  codigo, producto, categoria, subcategoria, tamaño, color,  descripción, proveedor, cantidad, unidad


Unidades: Rollo Unidad Paquete Pliego Caja  Bloque

ejemplo:
Cinta
Código: MT002
Producto: Cinta flora
Categoría: Cintas
Subcategoría o descripcion: flora
Tamaño: 5 cm o delgada 
Color: beis
Proveedor: Cintas y Más
Cantidad: 120
Unidad: rollo

Código: MT003
Producto: Oasis 
Categoría: Oasis
Subcategoría: Ladrillo
Tamaño: sencillo  o por cms
Color: Verde
Proveedor: Oasis Colombia
Cantidad: 60
Unidad: Unidad 

┌────────────────────────────────────┐
│ 🎀 Cinta Satinada Roja             │
├────────────────────────────────────┤
│ Código: MT002                      │
│ Categoría: Cintas                  │
│ Subcategoría: Satinada             │
│ Tamaño: 5 cm                       │
│ Color: Rojo                        │
│ Proveedor: Cintas y Más            │
│ Unidad: Metro                      │
│ Stock: 120 metros                  │
│ Stock mínimo: 30 metros            │
│ Estado: 🟢 Activo                  │
├────────────────────────────────────┤
│ [ Registrar Compra ]               │
│ [ Ajustar Inventario ]             │
│ [ Historial ]                      │
└────────────────────────────────────┘

MODULO 4: INVENTARIO ADICIONALES: Productos extras para vender. 

subcaterias: Chocolates, Vinos, Peluches, topper, 
item:
codigo, producto, categoria,  marca, descripcion, proveedor,fecha de vencimiento, costo unitario, costo de venta


Algunas funciones:  Costos, Ganancia























MODULO 6 : MOVIMIENTOS
LO IDEAL ES QUE exista un módulo independiente de "Movimientos de Inventario", pero que al mismo tiempo esté integrado con todos los módulos (Flores, Bases, Materiales y Adicionales). 

ES SOLO UN EJEMPLO



Entradas
Salidas
Ajustes
Pérdidas

Vista:
Fecha, Producto, Tipo Movimiento,Cantidad,Usuario

ACCIONES:
REGISTRAR ENTRADA
REGISTRAR SALIDA
REGISTRAR AJUSTE: por daños, perdidas
















MODULO : ARREGLOS: aqui estaran todos los arreglos florales con sus recetas   JUAN ALGO ASI ES LO QUE NECESITAMOS MANEJAR EN TEMPORADAS lo que andre ha pedido

Ejemplo:
Arreglo: BOX ROMANTIC 

Consume:
24 rosas
1 box larga
2 papel flora

adicional
1 ferrero

descuenta

flores
24 rosas
bases
1 box larga
materiales
1 papel flora
adicional
1 ferrreroÇ



Función principal:
 Crear y administrar los arreglos florales que vende la floristería.

Crear Arreglo
Permite crear un nuevo producto floral con nombre, descripción, precio e imagen.

Composición (Receta)
Define los materiales necesarios para fabricar un arreglo.
Ejemplo:
24 Rosas
1 Caja Corazón
2 Papeles Coreanos
1 Cinta
1 Ferrero

Precio de Venta
Valor que paga el cliente por el arreglo.
Costo de Producción (es una funcion opcional)
Costo total de todos los materiales utilizados para fabricar el arreglo.

 Utilidad
Ganancia obtenida por cada arreglo vendido.
Fórmula:
Precio de Venta - Costo de Producción

Capacidad de Fabricación  
Calcula automáticamente O MANUAL cuántos arreglos puedes fabricar con el inventario actual.

Componentes Limitantes
Muestra qué productos está limitando la fabricación.
Ejemplo:
 Solo puedes fabricar 20 arreglos porque solo tienes rosas para 20 unidades.


Disponibles
Cantidad real de arreglos que puedes vender en este momento.
 Reservados
Arreglos comprometidos en pedidos aún no entregados.
 Vendidos Hoy  YA ESTO LO HACE LAS METRICAS TAMBIEN
Cantidad de arreglos vendidos durante el día.


Simulador de Pedido IMPORTANTE
Permite verificar si puedes fabricar una cantidad específica antes de confirmar la venta.
Ejemplo:
 Cliente solicita 15 arreglos.
 El sistema valida si hay inventario suficiente.
Pedido Permitido
Confirma que existe inventario suficiente para producir el pedido solicitado.
Inventario Insuficiente
Advierte cuando no hay suficientes materiales para cumplir el pedido.
Impacto en Inventario
Muestra exactamente qué productos se descontarán al vender el arreglo.
Ejemplo:
Rosas: -24
Caja: -1
Papel: -2
Ferrero: -1

 Historial de Ventas :Registro de todas las ventas realizadas de ese arreglo.
Estados : 
 🟢 Estado Activo
El arreglo está disponible para la venta.
🔴 Estado Inactivo
El arreglo no aparece en el catálogo ni puede venderse.









Control de Cupos o Producción Disponible

Importante ver en detalle la funcion.

https://chatgpt.com/c/6a4d2ea0-bdb8-83e9-a497-ecec9637aa9f

El Control de Cupos o Producción Disponible es una función que controla cuántos arreglos florales pueden venderse, evitando sobreventas y garantizando que la floristería solo acepte pedidos que puede cumplir.
En la primera versión del sistema (MVP), esta función trabaja mediante un cupo manual definido por el administrador para cada arreglo floral, sin depender del inventario. Cada vez que se confirma un pedido, el sistema descuenta automáticamente del cupo disponible y valida que no se supere el límite establecido.
El sistema muestra en tiempo real la información del arreglo, incluyendo:
Cupo máximo: Cantidad total permitida para vender.
Reservados: Unidades comprometidas en pedidos confirmados.
Disponibles: Unidades que aún pueden venderse.
Estado: Disponible, Cupo Bajo o Agotado.

Además, la función está integrada con el Módulo de Pedidos/Ventas, donde antes de confirmar un pedido el sistema verifica automáticamente la disponibilidad. Si la cantidad solicitada supera el cupo disponible, bloquea la venta e informa al asesor cuántas unidades pueden venderse.
El administrador puede reiniciar o ajustar los cupos de forma manual o mediante reglas configurables (diarias, semanales o por campañas especiales), manteniendo un historial de cambios para garantizar el control y la trazabilidad.
Beneficios
Evita vender más arreglos de los permitidos.
Reduce errores y sobreventas.
Facilita el control de campañas y promociones.
Permite que varios asesores vendan simultáneamente sin conflictos.
Es una solución sencilla de implementar y preparada para evolucionar, permitiendo en el futuro reemplazar el cupo manual por un cálculo automático basado en el inventario, sin modificar el funcionamiento de los módulos de ventas y pedidos.

















MEJOR EXPLICADO LA FUNCION PARA TEMPORADA

Función principal:  Crear y administrar los arreglos florales que vende la floristería para temporadas.
Crear Arreglo: Permite crear un nuevo producto floral con nombre, descripción, precio e imagen.
 Composición (Receta): Define los materiales necesarios para fabricar un arreglo.
Ejemplo:
24 Rosas
1 Caja Corazón
2 Papeles Coreanos
1 Cinta
1 Ferrero

Precio de Venta:  Valor que paga el cliente por el arreglo.
Costo de Producción:  Costo total de todos los materiales utilizados para fabricar el arreglo.
 Utilidad: Ganancia obtenida por cada arreglo vendido.
Fórmula:  Precio de Venta - Costo de Producción
Capacidad de Fabricación: Calcula automáticamente O manual cuántos arreglos puedes fabricar con el inventario actual.
Componente Limitante: Muestra qué producto está limitando la fabricación.  
Ejemplo:
 Solo puedes fabricar 20 arreglos porque solo tienes rosas para 20 unidades.
Disponibles: Cantidad real de arreglos que puedes vender en este momento.
Reservados: Arreglos comprometidos en pedidos aún no entregados.
Vendidos Hoy: Cantidad de arreglos vendidos durante el día.
Simulador de Pedido opcional: Permite verificar si puedes fabricar una cantidad específica antes de confirmar la venta.
Ejemplo:
 Cliente solicita 15 arreglos.
 El sistema valida si hay inventario suficiente.
Pedido Permitido: Confirma que existe inventario suficiente para producir el pedido solicitado.
Inventario insuficiente: Advierte cuando no hay suficientes materiales para cumplir el pedido.
Impacto en Inventario: Muestra exactamente qué productos se descontarán al vender el arreglo.
Ejemplo:
Rosas: -24
Caja: -1
Papel: -2
Ferrero: -1
Historial de Ventas :  Registro de todas las ventas realizadas de ese arreglo.
Estados: 
🟢 Estado Activo: El arreglo está disponible para la venta. 
🔴 Estado Inactivo: El arreglo no aparece en el catálogo ni puede venderse.

Función: Control de Cupos o Producción Disponible


Permite definir cuántos arreglos de un mismo diseño pueden venderse.

Caja Romance Premium
Cantidad disponible: 50
Vendidos: 12
Disponibles: 38
Cada vez que se registra una venta:
Venta realizada:  Caja Romance Premium

Disponible antes: 38
Disponible ahora: 37

Vista dentro del módulo de Arreglos:

💐 Caja Romance Premium

Precio: $120.000

Disponibles:
38 / 50

████████░░ 76%

🟢 Disponible


Alertas
Cuando el stock de arreglos esté bajo:
⚠️ Caja Romance Premium

Disponibles: 5

Se acerca al límite de producción.
Cuando llegue a cero:
❌ Caja Romance Premium

Disponibles: 0

No disponible para venta.






Opción 1: Cupo Manual
El administrador define:
Cantidad inicial: 50
Y el sistema solo descuenta ventas.
Ideal para campañas como:
Día de la Madre
San Valentín
Amor y Amistad
Navidad

Cómo se vería en el sistema
Caja Romance Premium
Precio Venta: $120.000

Capacidad de fabricación:
20 unidades

Vendidos hoy:
5

Disponibles:
15

🟢 Disponible

Cuando entra un pedido
Pedido:
Caja Romance Premium

Cantidad: 8
El sistema valida:
Disponibles: 15

Pedido: 8

Resultado:

✅ Pedido permitido

Si intentan vender más
Pedido:
Caja Romance Premium

Cantidad: 18
Sistema:
Disponibles: 15

❌ No es posible confirmar el pedido.

Capacidad disponible:
15 arreglos

Producto limitante:
Rosa Roja Premium

Alerta para los vendedores
Antes de confirmar un pedido:
⚠️ Inventario insuficiente

Caja Romance Premium

Disponibles para fabricar:
15

Solicitados:
18

Faltan:
72 Rosas Rojas

Vista recomendada para FLORA
Dentro de cada arreglo mostrar:
💐 Caja Romance Premium

Capacidad actual:
20

Reservados:
5

Disponibles:
15

Estado:
🟢 Disponible





Y cuando llegue a:
Disponibles: 3
mostrar:
🟡 Stock bajo


Y cuando llegue a:
Disponibles: 0
mostrar:
🔴 Agotado
No disponible para venta




