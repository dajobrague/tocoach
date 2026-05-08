"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { MorePanel } from "@/components/client-dashboard/more-panel";
import { buildInitials, thumbnailUrl } from "@/lib/utils/avatar";

const AUTO_HIDE_ROUTES = ["/ejercicio", "/nutricion", "/calendar"];
const SCROLL_DOWN_THRESHOLD = 12;
const SCROLL_DELTA_WINDOW_MS = 200;
const IDLE_REVEAL_MS = 1500;
const SCROLL_TOP_LOCK_PX = 80;
const AVATAR_THUMBNAIL_PX = 96;

export function ClientBottomNav() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
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
  const subPath = `/${pathname.split("/").slice(2).join("/")}`;
  const eligibleForAutoHide = AUTO_HIDE_ROUTES.some((route) =>
    subPath.startsWith(route)
  );

  const navItems = useMemo(() => {
    const items: { href: string; icon: string; label: string }[] = [
      {
        href: `/${slug}/dashboard`,
        icon: "material-symbols:home-rounded",
        label: "Inicio",
      },
      {
        href: `/${slug}/ejercicio`,
        icon: "solar:dumbbell-bold",
        label: "Entrenamiento",
      },
      {
        href: `/${slug}/nutricion`,
        icon: "fluent:food-20-filled",
        label: "Nutrición",
      },
    ];

    if (communityUrl) {
      items.push({
        href: `/${slug}/comunidad`,
        icon: "solar:users-group-rounded-bold",
        label: "Comunidad",
      });
    }

    return items;
  }, [slug, communityUrl]);

  // Auto-hide on long-feed routes; respects prefers-reduced-motion.
  useEffect(() => {
    if (!eligibleForAutoHide) {
      setIsHidden(false);

      return;
    }
    if (typeof window === "undefined") return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) {
      setIsHidden(false);

      return;
    }

    let lastY = window.scrollY;
    let lastTs = performance.now();
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const onScroll = () => {
      const y = window.scrollY;
      const ts = performance.now();
      const dy = y - lastY;
      const dt = ts - lastTs;

      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setIsHidden(false), IDLE_REVEAL_MS);

      if (
        dy > SCROLL_DOWN_THRESHOLD &&
        dt < SCROLL_DELTA_WINDOW_MS &&
        y > SCROLL_TOP_LOCK_PX
      ) {
        setIsHidden(true);
      } else if (dy < -4) {
        setIsHidden(false);
      }
      lastY = y;
      lastTs = ts;
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [eligibleForAutoHide, pathname]);

  // While the MorePanel is open we keep the nav fully visible so the avatar
  // ring/glow remains anchored as the visual source of the panel.
  const hidden = isHidden && !isMoreOpen;

  return (
    <>
      <div
        className={`fixed inset-x-0 bottom-0 z-50 pointer-events-none flex justify-center transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          hidden ? "translate-y-6 opacity-0" : "translate-y-0 opacity-100"
        }`}
        style={{
          paddingBottom: "max(16px, calc(env(safe-area-inset-bottom) + 16px))",
        }}
      >
        <div className="pointer-events-auto flex w-full max-w-[440px] items-center gap-2.5 px-4">
          <nav
            aria-label="Navegación principal"
            className="relative flex h-[60px] flex-1 items-center justify-around gap-1 rounded-full border border-black/[0.06] bg-content1/70 px-1.5 backdrop-blur-[28px] backdrop-saturate-150 dark:border-white/[0.08] dark:bg-content1/60"
            style={{
              boxShadow:
                "0 8px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.45)",
            }}
          >
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  className={
                    isActive
                      ? "flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-primary-foreground transition-all duration-200 ease-out active:scale-[0.97]"
                      : "flex h-12 w-11 flex-none items-center justify-center rounded-full text-default-500 transition-all duration-200 ease-out hover:text-foreground active:scale-[0.97]"
                  }
                  href={item.href}
                >
                  <Icon className="shrink-0 text-2xl" icon={item.icon} />
                  {isActive && (
                    <span
                      className="truncate text-[13px] font-extrabold"
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 800,
                      }}
                    >
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <button
            aria-expanded={isMoreOpen}
            aria-label="Más opciones"
            className={`flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border bg-content1/70 backdrop-blur-[28px] backdrop-saturate-150 transition-all duration-200 active:scale-[0.94] dark:bg-content1/60 ${
              isMoreOpen
                ? "border-primary/60 ring-4 ring-primary/10"
                : "border-black/[0.06] dark:border-white/[0.08]"
            }`}
            style={{
              boxShadow:
                "0 8px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.45)",
            }}
            type="button"
            onClick={() => setIsMoreOpen(true)}
          >
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary-50">
              {showAvatarImage ? (
                <img
                  alt={firstName || "Perfil"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  sizes="48px"
                  src={thumbnailUrl(clientProfilePicture, AVATAR_THUMBNAIL_PX)}
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <span
                  className="text-sm text-primary"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 800,
                  }}
                >
                  {initials}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      <MorePanel isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </>
  );
}
