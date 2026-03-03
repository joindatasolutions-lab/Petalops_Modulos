export const initialState = {
  ordersAdmin: {
    loading: false,
    error: null,
    items: [],
    total: 0,
    filters: {
      q: "",
      estado: "",
      fechaDesde: "",
      fechaHasta: "",
      page: 1,
      pageSize: 20
    },
    selectedPedidoId: null,
    detalle: null,
    drawerOpen: false
  }
};
