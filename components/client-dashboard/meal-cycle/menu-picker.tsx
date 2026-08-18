"use client";

import type {
  ClientWeekDay,
  ClientWeekMenu,
} from "@/lib/nutrition/cycles/client-week";

import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { thumbnailUrl } from "@/lib/utils/avatar";

/** "Día de entreno" when named, "Día N" otherwise. */
export function menuLabel(menu: ClientWeekMenu): string {
  return menu.name ?? `Día ${menu.dayIndex + 1}`;
}

/**
 * Small thumbnail that asks Supabase for a server-side resized version and
 * falls back to the original URL when the render endpoint isn't available
 * (local stack / plans without image transformations return an error there).
 */
function Thumb({ className, url }: { className: string; url: string }) {
  const [failed, setFailed] = useState(false);
  const resized = thumbnailUrl(url, 80);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className={className}
      decoding="async"
      loading="lazy"
      src={failed || resized === url ? url : resized}
      onError={() => setFailed(true)}
    />
  );
}

/** Outline chip — border + tinted text over the card background, so it stays
 *  readable on any tenant theme (a filled tint can swallow same-hue text). */
function StatusChip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "primary" | "muted";
}) {
  return (
    <span
      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
        tone === "primary"
          ? "border-primary/50 text-primary"
          : "border-default-300 text-default-500"
      }`}
    >
      {children}
    </span>
  );
}

/** Horizontal photo slide; tapping a photo reveals the dish name. */
function MenuImageSlide({
  images,
}: {
  images: { url: string; name: string }[];
}) {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  if (images.length === 0) return null;

  return (
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1">
      {images.map((image) => {
        const active = activeUrl === image.url;

        return (
          <button
            key={image.url}
            aria-label={image.name.length > 0 ? image.name : "Ver plato"}
            className="relative shrink-0 snap-start overflow-hidden rounded-xl border border-default-200"
            type="button"
            onClick={() =>
              setActiveUrl((current) =>
                current === image.url ? null : image.url
              )
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="h-20 w-28 object-cover"
              decoding="async"
              loading="lazy"
              src={image.url}
            />
            {active && image.name.length > 0 ? (
              <span className="absolute inset-x-0 bottom-0 bg-black/65 px-1.5 py-1 text-left text-[10px] font-medium leading-tight text-white">
                {image.name}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One selectable menu card: tap to expand what it includes (meal by meal),
 * then confirm with the explicit "Elegir" button — nothing is saved until
 * then. The rotation's recommendation carries a badge.
 */
function MenuCard({
  menu,
  isRecommended,
  isCurrent,
  expanded,
  showMacros,
  pending,
  onToggle,
  onChoose,
}: {
  menu: ClientWeekMenu;
  isRecommended: boolean;
  /** The menu the date currently resolves to (recommended or saved choice). */
  isCurrent: boolean;
  expanded: boolean;
  showMacros: boolean;
  pending: boolean;
  onToggle: () => void;
  onChoose: () => void;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border bg-content1 transition-colors ${
        expanded ? "border-primary ring-1 ring-primary" : "border-default-200"
      }`}
      data-expanded={expanded}
      data-testid="menu-card"
    >
      <button
        className="flex w-full items-center gap-3 p-3 text-left"
        data-testid="menu-card-toggle"
        type="button"
        onClick={onToggle}
      >
        {/* Collapsed cards get the photo stack teaser; the expanded card
            already shows the full slide below, so no leading image there. */}
        {expanded === false ? (
          menu.images.length > 0 ? (
            <span className="flex shrink-0 -space-x-3">
              {menu.images.slice(0, 3).map((image) => (
                <Thumb
                  key={image.url}
                  className="h-10 w-10 rounded-xl border-2 border-content1 object-cover"
                  url={image.url}
                />
              ))}
            </span>
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-content2 text-default-400">
              <Icon icon="solar:notes-linear" width={20} />
            </span>
          )
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">
              {menuLabel(menu)}
            </p>
            {isRecommended ? (
              <StatusChip tone="primary">Recomendado</StatusChip>
            ) : null}
          </div>
          <p className="text-xs text-default-500 tabular-nums">
            {menu.meals.length} {menu.meals.length === 1 ? "comida" : "comidas"}
            {showMacros && menu.kcal > 0
              ? ` · ${menu.kcal.toLocaleString("es")} kcal`
              : ""}
            {isCurrent ? " · Menú actual" : ""}
          </p>
        </div>
        <Icon
          className={`shrink-0 text-default-300 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          icon="solar:alt-arrow-down-linear"
          width={18}
        />
      </button>

      {expanded ? (
        <div className="flex flex-col gap-3 border-t border-default-100 p-3">
          <MenuImageSlide images={menu.images} />

          {menu.meals.length === 0 ? (
            <p className="text-xs text-default-400">
              Este menú no tiene comidas aún.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {menu.meals.map((meal, index) => (
                <li
                  key={`${index}-${meal.label}`}
                  className="flex items-baseline gap-2"
                >
                  <span className="shrink-0 text-sm font-medium text-foreground">
                    {meal.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-default-500">
                    {meal.primaryName ?? "Sin opciones"}
                    {meal.optionCount > 1
                      ? ` · ${meal.optionCount - 1} alt.`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Button
            className="w-full font-medium"
            color="primary"
            data-testid="menu-card-choose"
            isLoading={pending}
            startContent={
              pending ? null : (
                <Icon icon="solar:check-circle-linear" width={18} />
              )
            }
            onPress={onChoose}
          >
            Elegir este menú
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The menu chooser — shown on today/future dates until the client confirms a
 * menu. Lists every menu of the plan as expandable cards (recommended first,
 * with its badge); expanding previews the meals; the explicit "Elegir este
 * menú" button saves the choice for that date.
 */
export function MenuChooser({
  day,
  menus,
  showMacros,
  pending,
  onChoose,
}: {
  day: ClientWeekDay;
  menus: ClientWeekMenu[];
  showMacros: boolean;
  pending: boolean;
  onChoose: (dayIndex: number) => void;
}) {
  // Recommended first, then rotation order.
  const ordered = [...menus].sort((a, b) => {
    const aRec = a.dayIndex === day.recommendedDayIndex ? 0 : 1;
    const bRec = b.dayIndex === day.recommendedDayIndex ? 0 : 1;

    return aRec - bRec || a.dayIndex - b.dayIndex;
  });
  const [expanded, setExpanded] = useState<number | null>(
    day.recommendedDayIndex ?? null
  );

  return (
    <div className="flex flex-col gap-2" data-testid="menu-chooser">
      <div className="flex items-center gap-2">
        <Icon className="text-primary" icon="solar:notes-bold" width={18} />
        <h2 className="text-sm font-semibold text-foreground">
          ¿Qué menú vas a seguir?
        </h2>
      </div>
      <p className="text-xs text-default-500">
        Revisa lo que incluye cada menú y elige el tuyo para este día.
      </p>

      {ordered.map((menu) => (
        <MenuCard
          key={menu.dayIndex}
          expanded={expanded === menu.dayIndex}
          isCurrent={menu.dayIndex === day.dayIndex}
          isRecommended={menu.dayIndex === day.recommendedDayIndex}
          menu={menu}
          pending={pending && expanded === menu.dayIndex}
          showMacros={showMacros}
          onChoose={() => onChoose(menu.dayIndex)}
          onToggle={() =>
            setExpanded((current) =>
              current === menu.dayIndex ? null : menu.dayIndex
            )
          }
        />
      ))}
    </div>
  );
}

/**
 * Compact bar shown once the date has a confirmed menu (or when choosing is
 * closed — past dates / single-menu plans): the menu name, its status chip,
 * and an optional "Cambiar" that reopens the chooser.
 */
export function MenuBar({
  day,
  menus,
  onChange,
}: {
  day: ClientWeekDay;
  menus: ClientWeekMenu[];
  /** When set, shows the "Cambiar" action (today/future dates). */
  onChange?: () => void;
}) {
  if (day.started === false || day.dayIndex === null || menus.length < 2) {
    return null;
  }

  const effective = menus.find((menu) => menu.dayIndex === day.dayIndex);
  const confirmed = day.hasMenuChoice === true;

  return (
    <Card data-testid="menu-bar">
      <CardBody className="flex-row items-center gap-3 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-content2 text-default-500">
          <Icon icon="solar:notes-linear" width={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-default-400">
            Menú del día
          </p>
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">
              {effective !== undefined
                ? menuLabel(effective)
                : `Día ${day.dayIndex + 1}`}
            </p>
            <StatusChip tone={confirmed ? "primary" : "muted"}>
              {confirmed ? "Elegido por ti" : "Recomendado"}
            </StatusChip>
          </div>
        </div>
        {onChange !== undefined ? (
          <button
            className="flex shrink-0 items-center gap-1 rounded-large border border-default-200 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-default-300"
            data-testid="menu-bar-change"
            type="button"
            onClick={onChange}
          >
            <Icon icon="solar:refresh-linear" width={14} />
            Cambiar
          </button>
        ) : null}
      </CardBody>
    </Card>
  );
}
