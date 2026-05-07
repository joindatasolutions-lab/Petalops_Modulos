import { useEffect, useState } from "react";

const SIDEBAR_STORAGE_KEY = "petalops.sidebar.pinned";

function readSidebarPinnedPreference() {
  try {
    const raw = globalThis.localStorage?.getItem(SIDEBAR_STORAGE_KEY);
    return raw === "true";
  } catch {
    return false;
  }
}

export function useSidebarState() {
  const [sidebarPinned, setSidebarPinned] = useState(() => readSidebarPinnedPreference());
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(SIDEBAR_STORAGE_KEY, String(sidebarPinned));
    } catch {
      // Ignorar storage no disponible.
    }
  }, [sidebarPinned]);

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia("(max-width: 980px)");
    const handleChange = event => {
      if (!event.matches) {
        setSidebarMobileOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleSidebar = () => {
    const isMobile = globalThis.matchMedia("(max-width: 980px)").matches;
    if (isMobile) {
      setSidebarMobileOpen(current => !current);
      return;
    }

    setSidebarPinned(current => !current);
  };

  return {
    sidebarPinned,
    sidebarMobileOpen,
    setSidebarMobileOpen,
    toggleSidebar,
  };
}
