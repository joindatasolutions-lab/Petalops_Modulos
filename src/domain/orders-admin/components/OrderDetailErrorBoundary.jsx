import { Component } from "react";

/**
 * Limite de error local del drawer.
 *
 * Evita que un payload incompleto del detalle tumbe toda la pagina de Pedidos.
 * Si algo falla al pintar el detalle, el usuario conserva la pantalla y puede
 * cerrar/recargar el panel.
 */
export class OrderDetailErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Error renderizando detalle de pedido:", error);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <p className="order-drawer-empty">
          No fue posible renderizar el detalle. Intenta recargar el pedido.
        </p>
      );
    }

    return this.props.children;
  }
}
