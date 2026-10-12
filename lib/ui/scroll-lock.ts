/**
 * Bloqueo del scroll del body con contador: varias capas a pantalla completa
 * (sesión → registro → vídeo) pueden abrirse y cerrarse en cualquier orden y
 * el body solo vuelve a hacer scroll cuando se cierra la última. Guardar y
 * restaurar `overflow` por capa dejaba el body bloqueado si se cerraban en
 * otro orden (y la navegación del cliente no lo resetea).
 */
let locks = 0;

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  locks += 1;
  if (locks === 1) document.body.style.overflow = "hidden";
  let released = false;

  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.style.overflow = "";
  };
}
