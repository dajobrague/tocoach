"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

/**
 * The community (GHL portals on the trainer's own domain) is a THIRD-PARTY
 * iframe for app.topcoach.io, so Safari/iOS PWAs don't persist its login
 * cookies: every time the iframe reloaded, the client had to log in again.
 *
 * So the iframe lives here — mounted once, the first time the client opens
 * Comunidad, at the client-layout level — and is only *positioned* over the
 * slot the Comunidad page renders. Switching tabs hides it instead of
 * unmounting it, so the session survives tab changes. (Moving an iframe in
 * the DOM reloads it, hence fixed positioning instead of a portal.)
 * ponytail: closing the app still loses the session — that needs the
 * community platform itself to use the Storage Access API; nothing we can
 * do from the embedding side.
 */

interface CommunityFrameState {
  setSlot: (el: HTMLElement | null) => void;
  loaded: boolean;
  timedOut: boolean;
}

const CommunityFrameContext = createContext<CommunityFrameState | null>(null);

// Browsers that block embedding may never fire `onLoad`, or fire it on an
// empty error page. 6s is enough for a real page on a slow network.
const LOAD_TIMEOUT_MS = 6000;

export function CommunityFrameHost({
  communityUrl,
  children,
}: {
  communityUrl: string | null;
  children: React.ReactNode;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Mount lazily on the first visit to Comunidad, then keep it forever.
  useEffect(() => {
    if (slot) setMounted(true);
  }, [slot]);

  useEffect(() => {
    if (!mounted || loaded) return;
    const t = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);

    return () => clearTimeout(t);
  }, [mounted, loaded]);

  useLayoutEffect(() => {
    if (!slot) {
      setRect(null);

      return;
    }
    const update = () => setRect(slot.getBoundingClientRect());

    update();
    const ro = new ResizeObserver(update);

    ro.observe(slot);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [slot]);

  const visible = Boolean(slot && rect);

  return (
    <CommunityFrameContext.Provider value={{ setSlot, loaded, timedOut }}>
      {children}
      {mounted && communityUrl && (
        <iframe
          allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; payment"
          className="fixed z-[1] border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          src={communityUrl}
          style={
            visible && rect && !(timedOut && !loaded)
              ? {
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                }
              : { display: "none" }
          }
          title="Comunidad"
          onLoad={() => setLoaded(true)}
        />
      )}
    </CommunityFrameContext.Provider>
  );
}

export function useCommunityFrame(): CommunityFrameState {
  const ctx = useContext(CommunityFrameContext);

  if (!ctx) {
    throw new Error("useCommunityFrame must be used within CommunityFrameHost");
  }

  return ctx;
}
