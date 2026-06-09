import { useState } from "react";
import {
  IconBrandGoogle,
  IconChartBar,
  IconCloud,
  IconCreditCard,
  IconEye,
  IconEyeOff,
  IconLock,
  IconPackage,
  IconShieldCheck,
  IconTrendingUp,
  IconTruck,
  IconUser,
} from "@tabler/icons-react";

export function LoginPage({ onSubmit, error, loading }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async event => {
    event.preventDefault();
    await onSubmit({
      login: String(usuario || "").trim().toLowerCase(),
      password,
    });
  };

  return (
    <main className="auth-view">
      <section className="auth-shell">
        <aside className="auth-brand-panel" aria-label="PetalOps">
          <div className="auth-brand-lockup">
            <img src="/logo.png" alt="PetalOps" className="auth-brand-logo" />
            <div>
              <strong>PetalOps</strong>
              <span>Plataforma de Gestion Empresarial</span>
            </div>
          </div>

          <div className="auth-brand-copy">
            <span className="auth-brand-rule" aria-hidden="true" />
            <h1>Opera tu negocio. <strong>Crecemos contigo.</strong></h1>
            <p>PetalOps centraliza ventas, operaciones y administracion en un solo lugar para que tu empresa sea mas eficiente cada dia.</p>
          </div>

          <div className="auth-product-preview" aria-hidden="true">
            <div className="auth-preview-rail">
              <span className="is-active"><IconChartBar size={15} stroke={2} /></span>
              <span><IconPackage size={15} stroke={2} /></span>
              <span><IconTruck size={15} stroke={2} /></span>
              <span><IconCreditCard size={15} stroke={2} /></span>
              <span><IconUser size={15} stroke={2} /></span>
            </div>
            <div className="auth-preview-board">
              <h2>Hola, Ana</h2>
              <p>Resumen de tu negocio</p>
              <div className="auth-preview-kpis">
                <span><b>24</b><small>Pedidos hoy</small></span>
                <span><b>8</b><small>Pendientes</small></span>
                <span><b>12</b><small>Entrega hoy</small></span>
                <span><b>156</b><small>Productos</small></span>
              </div>
              <div className="auth-preview-list">
                <span><IconPackage size={16} stroke={2} /><b>Pedido #1024</b><small>Nuevo pedido recibido</small></span>
                <span><IconTruck size={16} stroke={2} /><b>Entrega #834</b><small>En camino</small></span>
                <span><IconCreditCard size={16} stroke={2} /><b>Pago recibido</b><small>Pedido #1023</small></span>
              </div>
            </div>
          </div>

          <div className="auth-benefits">
            <span><IconShieldCheck size={24} stroke={1.8} /><b>Acceso seguro</b><small>Tus datos siempre protegidos</small></span>
            <span><IconCloud size={24} stroke={1.8} /><b>En la nube</b><small>Accede desde cualquier lugar</small></span>
            <span><IconTrendingUp size={24} stroke={1.8} /><b>Escalable</b><small>Crece tu negocio con PetalOps</small></span>
          </div>
        </aside>

        <section className="auth-card">
          <header className="auth-hero">
            <img src="/logo.png" alt="PetalOps" className="auth-logo" />
            <h1 className="auth-title">Bienvenido a <span>PetalOps</span></h1>
            <p className="auth-subtitle">Accede a tu plataforma de gestion empresarial e inicia sesion para continuar.</p>
          </header>

          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="usuario">Usuario o correo electronico</label>
            <div className="auth-input-field">
              <IconUser size={22} stroke={1.8} aria-hidden="true" />
              <input
                id="usuario"
                type="text"
                value={usuario}
                onChange={event => setUsuario(event.target.value)}
                placeholder="Ingresa tu usuario o correo"
                required
              />
            </div>

            <label htmlFor="password">Contrasena</label>
            <div className="auth-password-field auth-input-field">
              <IconLock size={22} stroke={1.8} aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Ingresa tu contrasena"
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(current => !current)}
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                title={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
              >
                {showPassword ? <IconEyeOff size={20} stroke={1.8} /> : <IconEye size={20} stroke={1.8} />}
              </button>
            </div>

            <button type="button" className="auth-forgot-link">Olvidaste tu contrasena?</button>

            {error ? <p className="auth-error">{error}</p> : null}

            <button type="submit" className="btn-primary" disabled={loading}>
              <IconLock size={20} stroke={2} aria-hidden="true" />
              {loading ? "Ingresando..." : "Ingresar a PetalOps"}
            </button>

            <div className="auth-divider"><span>o</span></div>

            <button type="button" className="auth-google-btn">
              <IconBrandGoogle size={22} stroke={1.8} aria-hidden="true" />
              Continuar con Google
            </button>

            <p className="auth-security-note"><IconShieldCheck size={18} stroke={1.8} /> Acceso seguro y cifrado</p>
          </form>
        </section>
      </section>
    </main>
  );
}
