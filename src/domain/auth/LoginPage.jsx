import { useState } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";

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
      <section className="auth-card">
        <div className="auth-glow" aria-hidden="true" />
        <header className="auth-hero">
          <img src="/petalops-logo-full.png" alt="PetalOps" className="auth-logo" />
          <p className="auth-kicker">Acceso seguro para equipos de floristeria</p>
          <h1 className="auth-title">Ingreso por Empresa</h1>
          <p className="auth-subtitle">Accede con tu usuario unico y contrasena. Tu empresa y sucursal se detectan automaticamente.</p>
        </header>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="usuario">Usuario</label>
          <input
            id="usuario"
            type="text"
            value={usuario}
            onChange={event => setUsuario(event.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <div className="auth-password-field">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword(current => !current)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <IconEyeOff size={18} stroke={1.8} /> : <IconEye size={18} stroke={1.8} />}
            </button>
          </div>

          {error ? <p className="auth-error">{error}</p> : null}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}
