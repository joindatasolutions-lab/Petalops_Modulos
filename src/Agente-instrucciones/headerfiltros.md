Necesito corregir el diseño del módulo Pipeline para que reutilice EXACTAMENTE el mismo sistema visual que utiliza actualmente el módulo Producción.

NO crear un nuevo diseño.

NO reinterpretar el diseño.

NO aproximarlo.

Tomar Producción como referencia visual única.

------------------------------------------------
HEADER
------------------------------------------------

El header de Pipeline debe utilizar exactamente la misma estructura que Producción:

- mismo alto
- mismo border-radius
- mismo padding
- misma sombra
- misma separación respecto al sidebar
- misma alineación vertical
- misma alineación horizontal

El componente debe ser idéntico.

Solo cambia:

Título:
Pipeline

Descripción:
Centro de control de pedidos, producción y entrega

Botón:
Actualizar

Badge:
Usuario: Flora Empresa Admin

La estructura visual debe ser un componente compartido entre módulos.

------------------------------------------------
CONTENEDOR PRINCIPAL
------------------------------------------------

Actualmente Pipeline tiene un contenedor diferente.

Quiero exactamente:

- mismo ancho
- mismo padding
- mismo spacing
- mismo borde
- mismo radio

que utiliza Producción.

Pipeline debe sentirse parte del mismo sistema de diseño.

------------------------------------------------
FILTROS
------------------------------------------------

Corregir completamente los filtros.

Actualmente existen contenedores duplicados y bordes sobrepuestos.

Problemas visibles:

- input dentro de otro input
- doble borde
- doble padding
- iconos encerrados en cajas separadas
- apariencia de componentes apilados

Eliminar toda esa estructura.

------------------------------------------------
DISEÑO CORRECTO
------------------------------------------------

Cada filtro debe ser:

[ icono | contenido ]

Un solo contenedor.

Un solo borde.

Un solo nivel visual.

Sin cajas internas.

Sin bordes duplicados.

Sin wrappers innecesarios.

------------------------------------------------
ESTRUCTURA ESPERADA
------------------------------------------------

Buscar pedido

Fecha

Sucursal

Florista

Estado

Todos con:

- misma altura
- mismo radio
- mismo borde
- mismo padding
- misma tipografía

idénticos a Producción.

------------------------------------------------
CONSISTENCIA
------------------------------------------------

Comparar Pipeline contra Producción y reutilizar:

- clases
- tokens
- variables
- componentes

si ya existen.

Evitar duplicar estilos.

Objetivo:

Que un usuario perciba que Producción y Pipeline fueron diseñados por el mismo equipo y pertenecen exactamente al mismo sistema visual.