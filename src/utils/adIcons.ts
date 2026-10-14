import {
  LayoutGrid,
  Monitor,
  MoveHorizontal,
  PanelBottom,
  PanelRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdPlacement } from "../types/ads";

/**
 * Icono por ubicación publicitaria: dibuja dónde va el anuncio sin leer.
 * Compartido entre el asistente de carga y el tarifario del panel.
 */
export const PLACEMENT_ICONS: Record<AdPlacement, LucideIcon> = {
  TOP_BILLBOARD: Monitor,
  IN_FEED_LEADERBOARD: MoveHorizontal,
  ARTICLE_SIDEBAR: PanelRight,
  ARTICLE_FOOTER: PanelBottom,
  GRID_CARD: LayoutGrid,
};

/** Etiqueta legible de la orientación de la creatividad. */
export const ORIENTATION_LABEL: Record<
  "horizontal" | "vertical" | "card",
  string
> = {
  horizontal: "Horizontal",
  vertical: "Vertical",
  card: "Card 4:5",
};
