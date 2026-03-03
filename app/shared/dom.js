export function getById(id) {
  return document.getElementById(id);
}

export function on(element, eventName, handler, key = "bound") {
  if (!element || typeof element.addEventListener !== "function") return;
  if (element.dataset && element.dataset[key]) return;
  element.addEventListener(eventName, handler);
  if (element.dataset) element.dataset[key] = "1";
}

export function setHtml(element, html) {
  if (!element) return;
  element.innerHTML = html;
}

export function setText(element, value) {
  if (!element) return;
  element.textContent = String(value ?? "");
}

export function getValue(element) {
  return String(element?.value || "").trim();
}

export function toggleClass(element, className, enabled) {
  if (!element) return;
  if (enabled) element.classList.add(className);
  else element.classList.remove(className);
}

export function setDisabled(element, disabled) {
  if (!element) return;
  element.disabled = Boolean(disabled);
}
