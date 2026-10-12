"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { MorePanel } from "@/components/client-dashboard/more-panel";
import { buildInitials, thumbnailUrl } from "@/lib/utils/avatar";

// La barra se compacta (solo iconos) al bajar y vuelve al subir, como iOS 26.
const COMPACT_MIN_Y = 120;
const SCROLL_DELTA_PX = 6;
const AVATAR_THUMBNAIL_PX = 96;

/**
 * Barra de navegación del portal: una sola pastilla flotante translúcida con
 * las pestañas y, al final, el avatar del cliente que abre "Más". La pestaña
 * activa se marca con una cápsula de marca suave que se desliza; el icono
 * pasa de lineal a relleno. Se compacta al hacer scroll hacia abajo.
 */
export function ClientBottomNav() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const { clientProfilePicture, communityUrl, firstName, lastName } =
    useClientData();

  // Reset broken-image state if the underlying URL changes
  // (e.g. session change, user updates picture).
  useEffect(() => {
    setAvatarFailed(false);
  }, [clientProfilePicture]);

  const showAvatarImage = Boolean(clientProfilePicture) && !avatarFailed;
  const initials = buildInitials(firstName, lastName);

  const slug = pathname.split("/")[1] || "";

  const navItems = useMemo(() => {
    const items: {
      href: string;
      icon: string;
      activeIcon: string;
      label: string;
    }[] = [
      {
        href: `/${slug}/dashboard`,
        icon: "solar:home-2-linear",
        activeIcon: "solar:home-2-bold",
        label: "Inicio",
      },
      {
        href: `/${slug}/ejercicio`,
        icon: "solar:dumbbell-linear",
        activeIcon: "solar:dumbbell-bold",
        label: "Entrenar",
      },
      {
        href: `/${slug}/nutricion`,
        icon: "fluent:food-20-regular",
        activeIcon: "fluent:food-20-filled",
        label: "Nutrición",
      },
    ];

    if (communityUrl) {
      items.push({
        href: `/${slug}/comunidad`,
        icon: "solar:users-group-rounded-linear",
        activeIcon: "solar:users-group-rounded-bold",
        label: "Comunidad",
      });
    }

    return items;
  }, [slug, communityUrl]);

  const activeIndex = navItems.findIndex((item) => pathname === item.href);
  const columns = navItems.length + 1;

  // Compact on scroll-down, full on scroll-up or near the top. Reduced motion
  // keeps the full bar (no size changes while reading).
  useEffect(() => {
    setIsCompact(false);
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let lastY = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;

      if (y > lastY + SCROLL_DELTA_PX && y > COMPACT_MIN_Y) setIsCompact(true);
      else if (y < lastY - SCROLL_DELTA_PX || y < COMPACT_MIN_Y)
        setIsCompact(false);
      lastY = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  const compact = isCompact && !isMoreOpen;
  const ease = "ease-[cubic-bezier(0.32,0.72,0,1)]";

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center"
        style={{
          paddingBottom: "max(14px, calc(env(safe-area-inset-bottom) + 10px))",
        }}
      >
        <nav
          aria-label="Navegación principal"
          className={`pointer-events-auto relative mx-3.5 grid w-full max-w-[440px] rounded-full border border-black/[0.06] bg-background/80 p-[5px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-[24px] backdrop-saturate-150 transition-[height] duration-300 dark:border-white/[0.08] ${ease} ${
            compact ? "h-[50px]" : "h-16"
          }`}
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {activeIndex >= 0 ? (
            <span
              aria-hidden
              className={`absolute bottom-[5px] left-[5px] top-[5px] rounded-full bg-primary/10 transition-transform duration-500 motion-reduce:transition-none ${ease}`}
              style={{
                width: `calc((100% - 10px) / ${columns})`,
                transform: `translateX(${activeIndex * 100}%)`,
              }}
            />
          ) : null}

          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                className={`relative z-[1] flex min-w-0 select-none flex-col items-center justify-center gap-px rounded-full transition-[color,transform] duration-150 active:scale-[0.97] ${
                  isActive
                    ? "text-primary"
                    : "text-default-500 [@media(hover:hover)]:hover:text-foreground"
                }`}
                href={item.href}
              >
                <Icon
                  className="shrink-0 text-[26px]"
                  icon={isActive ? item.activeIcon : item.icon}
                />
                <span
                  className={`max-w-full truncate text-[11px] font-semibold leading-tight transition-[opacity,max-height] duration-300 ${ease} ${
                    compact ? "max-h-0 opacity-0" : "max-h-4 opacity-100"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          <button
            aria-expanded={isMoreOpen}
            aria-label="Más opciones"
            className="relative z-[1] flex select-none items-center justify-center rounded-full transition-transform duration-150 active:scale-[0.94]"
            type="button"
            onClick={() => setIsMoreOpen(true)}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-[1.5px] ring-content1 ${
                isMoreOpen ? "outline outline-2 outline-primary/60" : ""
              }`}
            >
              {showAvatarImage ? (
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  decoding="async"
                  loading="lazy"
                  sizes="36px"
                  src={thumbnailUrl(clientProfilePicture, AVATAR_THUMBNAIL_PX)}
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <span className="font-heading text-[13px] text-primary">
                  {initials}
                </span>
              )}
            </span>
          </button>
        </nav>
      </div>

      <MorePanel isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </>
  );
}
