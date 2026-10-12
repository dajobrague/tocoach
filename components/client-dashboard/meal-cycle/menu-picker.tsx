"use client";

import type {
  ClientWeekDay,
  ClientWeekMenu,
} from "@/lib/nutrition/cycles/client-week";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { SectionHeader } from "@/components/client-dashboard/client-page";
import { SoftChip } from "@/components/client-dashboard/meal-cycle/macro-ui";
import { IconTile } from "@/components/shared/icon-tile";
import { mealVisual } from "@/features/trainer/cycles/cycle-format";
import { thumbnailUrl } from "@/lib/utils/avatar";

/** "Día de entreno" when named, "Menú N" otherwise ("Día N" would collide
 *  with the date strip). */
export function menuLabel(menu: ClientWeekMenu): string {
  return menu.name ?? `Menú ${menu.dayIndex + 1}`;
}

/** Shared easing of the portal's expand/collapse motion (iOS-like). */
const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

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

/** Horizontal photo strip; tapping a photo shows the dish name below it. */
function MenuImageSlide({
  images,
}: {
  images: { url: string; name: string }[];
}) {
  const [activeUrl, setActiveUrl] = useState<string | null>(
    images[0]?.url ?? null
  );

  if (images.length === 0) return null;

  const activeName = images.find((image) => image.url === activeUrl)?.name;

  return (
    <div>
      <div className="-mx-4 flex snap-x snap-proximity scroll-px-4 gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {images.map((image) => {
          const active = activeUrl === image.url;

          return (
            <button
              key={image.url}
              aria-label={image.name.length > 0 ? image.name : "Ver plato"}
              aria-pressed={active}
              className={`shrink-0 snap-start overflow-hidden rounded-[14px] transition-transform active:scale-[0.97] motion-reduce:transition-none ${
                active
                  ? "ring-2 ring-foreground ring-offset-2 ring-offset-content1"
                  : ""
              }`}
              type="button"
              onClick={() => setActiveUrl(image.url)}
            >
              <Thumb className="h-16 w-16 object-cover" url={image.url} />
            </button>
          );
        })}
      </div>
      <p
        aria-live="polite"
        className="mt-2 min-h-[18px] truncate text-[13px] font-semibold text-default-500"
      >
        {activeName ?? ""}
      </p>
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
      className="overflow-hidden rounded-large bg-content1 shadow-small"
      data-expanded={expanded}
      data-testid="menu-card"
    >
      <button
        aria-expanded={expanded}
        className="flex min-h-[72px] w-full items-center gap-3 py-3.5 pl-4 pr-3.5 text-left transition-colors [@media(hover:hover)]:hover:bg-default-100"
        data-testid="menu-card-toggle"
        type="button"
        onClick={onToggle}
      >
        {menu.images.length > 0 ? (
          <span className="flex shrink-0 pl-2.5">
            {menu.images.slice(0, 3).map((image) => (
              <Thumb
                key={image.url}
                className="-ml-2.5 h-[34px] w-[34px] rounded-full object-cover ring-[2.5px] ring-content1"
                url={image.url}
              />
            ))}
          </span>
        ) : (
          <IconTile icon="solar:plate-linear" size="sm" tone="default" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold leading-tight text-foreground">
            {menuLabel(menu)}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* One status per card: the current menu wins over the
                recommendation (usually the same menu). */}
            {isCurrent ? (
              <SoftChip>Menú actual</SoftChip>
            ) : isRecommended ? (
              <SoftChip brand>Recomendado</SoftChip>
            ) : null}
            <span className="text-[13px] text-default-500 tabular-nums">
              {menu.meals.length === 0
                ? "Sin comidas aún"
                : `${menu.meals.length} ${menu.meals.length === 1 ? "comida" : "comidas"}`}
              {showMacros && menu.kcal > 0
                ? ` · ${menu.kcal.toLocaleString("es")} kcal`
                : ""}
            </span>
          </span>
        </span>
        <Icon
          className={`shrink-0 text-default-400 transition-transform duration-300 motion-reduce:transition-none ${EASE} ${
            expanded ? "rotate-180" : ""
          }`}
          icon="solar:alt-arrow-down-linear"
          width={20}
        />
      </button>

      {/* Always mounted so it can slide open; `invisible` (after the
          collapse finishes) keeps the hidden buttons out of tab order. */}
      <div
        className={`grid motion-reduce:!transition-none ${
          expanded
            ? `visible grid-rows-[1fr] [transition:grid-template-rows_420ms_cubic-bezier(0.32,0.72,0,1)]`
            : `invisible grid-rows-[0fr] [transition:grid-template-rows_420ms_cubic-bezier(0.32,0.72,0,1),visibility_0s_420ms]`
        }`}
      >
        <div className="min-h-0 overflow-hidden px-4">
          <div className="flex flex-col pb-4">
            <MenuImageSlide images={menu.images} />

            {menu.meals.length === 0 ? (
              <p className="mt-1 rounded-[14px] bg-default-100 p-3.5 text-center text-sm text-default-500">
                Este menú no tiene comidas aún.
              </p>
            ) : (
              <ul className="mt-2.5 divide-y divide-default-100">
                {menu.meals.map((meal, index) => (
                  <li
                    key={`${index}-${meal.label}`}
                    className="flex items-start gap-2.5 py-2 text-sm leading-snug text-default-500"
                  >
                    <Icon
                      className="mt-px shrink-0 text-default-400"
                      icon={mealVisual(meal.label).icon}
                      width={20}
                    />
                    <span className="min-w-0">
                      <span className="font-semibold text-foreground">
                        {meal.label}
                      </span>
                      {" — "}
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
              className="mt-3.5 h-[52px] w-full rounded-medium text-[17px] font-semibold"
              color="primary"
              data-testid="menu-card-choose"
              isLoading={pending}
              onPress={onChoose}
            >
              {pending ? "Guardando…" : "Elegir este menú"}
            </Button>
          </div>
        </div>
      </div>
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
    day.recommendedDayIndex ?? ordered[0]?.dayIndex ?? null
  );

  return (
    <section data-testid="menu-chooser">
      <SectionHeader className="!mb-1" title="¿Qué menú vas a seguir?" />
      <p className="mb-4 text-[15px] leading-snug text-default-500">
        Revisa lo que incluye cada menú y elige el tuyo para este día.
      </p>

      <div className="flex flex-col gap-3">
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
    </section>
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
    <div
      className="flex items-center gap-2.5 rounded-large bg-content1 py-2.5 pl-3 pr-2.5 shadow-small"
      data-testid="menu-bar"
    >
      <IconTile icon="solar:notebook-linear" size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-default-500">Menú del día</span>
          <SoftChip brand={!confirmed} className="h-5 px-[7px] text-[11px]">
            {confirmed ? "Elegido por ti" : "Recomendado"}
          </SoftChip>
        </div>
        <p className="mt-0.5 truncate text-[15px] font-semibold leading-snug text-foreground">
          {effective !== undefined
            ? menuLabel(effective)
            : `Menú ${day.dayIndex + 1}`}
        </p>
      </div>
      {onChange !== undefined ? (
        <Button
          className="h-9 shrink-0 rounded-full bg-default-100 px-3 text-sm font-semibold text-foreground"
          data-testid="menu-bar-change"
          size="sm"
          variant="flat"
          onPress={onChange}
        >
          Cambiar
        </Button>
      ) : null}
    </div>
  );
}
