// Identità anonima e persistente del visitatore (solo localStorage, nessun tracking).
const ID_KEY = "whychat:vid";
const NAME_KEY = "whychat:name";

export function visitorId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = "v_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function setName(name: string): void {
  if (name.trim()) localStorage.setItem(NAME_KEY, name.trim().slice(0, 80));
}
