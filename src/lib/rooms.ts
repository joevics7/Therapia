export type Pal = "a" | "b" | "c" | "d" | "e";

export type RoomDef = {
  id: string;
  cat: string;
  title: string;
  host: string;
  when: string; // recurring schedule text, e.g. "Tue & Thu · 8:00 PM"
  next?: string; // next dated session, formatted in Lagos time
  women: boolean;
  men: boolean;
  pal: Pal;
};

export const ROOM_COLS = "id,cat,title,host_name,schedule_text,women_only,men_only,pal";

export function toRoom(r: Record<string, unknown>): RoomDef {
  return {
    id: String(r.id),
    cat: String(r.cat),
    title: String(r.title),
    host: String(r.host_name),
    when: String(r.schedule_text ?? ""),
    women: !!r.women_only,
    men: !!r.men_only,
    pal: (r.pal as Pal) ?? "a",
  };
}

export const fmtLagos = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

export const MAX_SPEAKERS = 4; // host + 3 guests
export const MAX_LISTENERS = 200;
