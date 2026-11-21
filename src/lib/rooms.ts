export type Pal = "a" | "b" | "c" | "d" | "e";

export type RoomDef = {
  id: string;
  cat: string;
  title: string;
  host: string;
  when: string; // recurring schedule text, e.g. "Tue & Thu · 8:00 PM"
  next?: string; // next dated session, formatted in Lagos time
  nextAt?: string; // the same moment as an ISO time, for the countdown
  about: string;
  women: boolean;
  men: boolean;
  pal: Pal;
};

export const ROOM_COLS = "id,cat,title,host_name,schedule_text,women_only,men_only,pal,about";

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
    about: String(r.about ?? ""),
  };
}

export const fmtLagos = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

export const MAX_SPEAKERS = 4; // host + 3 guests
export const MAX_LISTENERS = 200;

/** Groups with no facilitator assigned yet are saved as "To be assigned". */
export const UNASSIGNED = "To be assigned";
export const hostLabel = (h: string) => (h === UNASSIGNED ? "Facilitator to be announced" : `Hosted by ${h}`);
