export type RoomDef = {
  id: string;
  cat: string;
  title: string;
  host: string;
  when: string;
  women?: boolean;
  men?: boolean;
  pal: "a" | "b" | "c" | "d" | "e";
};

// Static list for the MVP. Later this moves to a database managed by facilitators.
export const ROOMS: RoomDef[] = [
  { id: "bet", cat: "Betting", title: "Betting: Day One, Again", host: "Coach Tunde", when: "Daily · 7:00 PM", pal: "a" },
  { id: "safe", cat: "Marriage & abuse", title: "Safe Corner for Women", host: "Sister Ada", when: "Tue & Thu · 8:00 PM", women: true, pal: "b" },
  { id: "men", cat: "Marriage & abuse", title: "Husbands, Anger and Home", host: "Mr Bayo", when: "Wed · 8:00 PM", men: true, pal: "c" },
  { id: "grief", cat: "Grief", title: "Grief Dey Heavy", host: "Mama Ngozi", when: "Fri · 7:30 PM", pal: "d" },
  { id: "bottle", cat: "Addiction", title: "Free From the Bottle", host: "Dr Halima", when: "Sat · 6:00 PM", pal: "e" },
  { id: "naira", cat: "Stress & money", title: "Naira Pressure: Breathe First", host: "Coach Kemi", when: "Sun · 5:00 PM", pal: "a" },
];

export const getRoom = (id: string) => ROOMS.find((r) => r.id === id);

export const MAX_SPEAKERS = 4; // host + 3 guests
export const MAX_LISTENERS = 200;
