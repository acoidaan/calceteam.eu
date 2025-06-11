// Header.jsx
import React from "react";
import "./Header.css";

const Header = ({
  onBack,
  titleImage, // PNG del título (ej: "EQUIPOS", "TORNEOS")
  logoImage, // PNG del logo del equipo
  showBackButton = true,
}) => {
  return (
    <div className="common-header">
      <div className="header-content">
        {/* Botón volver a la izquierda */}
        {showBackButton && (
          <button onClick={onBack} className="header-back-button">
            ← Volver
          </button>
        )}

        {/* Contenido del centro/derecha */}
        <div className="header-right-content">
          {/* PNG del título */}
          {titleImage && (
            <img
              src={titleImage}
              alt="Título de sección"
              className="header-title-image"
            />
          )}

          {/* PNG del logo del equipo */}
          {logoImage && (
            <img
              src={logoImage}
              alt="Logo del equipo"
              className="header-logo-image"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
