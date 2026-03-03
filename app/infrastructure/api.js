export function createApiClient(config) {
  const baseUrl = config.tenant.apiBaseUrl;

  return {
    async listarPedidos({ empresaId, sucursalId, q, estado, fechaDesde, fechaHasta, page, pageSize }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      if (q) params.set("q", String(q));
      if (estado) params.set("estado", String(estado));
      if (fechaDesde) params.set("fechaDesde", String(fechaDesde));
      if (fechaHasta) params.set("fechaHasta", String(fechaHasta));
      params.set("page", String(page || 1));
      params.set("pageSize", String(pageSize || 20));

      const response = await fetch(`${baseUrl}/pedidos?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },

    async obtenerDetallePedido(pedidoId) {
      const response = await fetch(`${baseUrl}/pedido/${pedidoId}/detalle`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },

    async aprobarPedido(pedidoId) {
      const response = await fetch(`${baseUrl}/pedido/${pedidoId}/aprobar`, {
        method: "PUT"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },

    async rechazarPedido(pedidoId, motivo) {
      const response = await fetch(`${baseUrl}/pedido/${pedidoId}/rechazar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ motivo })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }
  };
}
