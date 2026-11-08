const P: Record<string, string> = {
  mail: "M4 6h16v12H4z M4 7l8 6 8-6",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4",
  send: "M21 3L3 11l7 3 3 7 8-18z M10 14L21 3",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18z M3 12h18 M12 3c3 3.5 3 14.5 0 18 M12 3c-3 3.5-3 14.5 0 18",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14z M20 20l-4-4",
  file: "M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6",
  plug: "M9 3v5 M15 3v5 M7 8h10v4a5 5 0 01-10 0z M12 17v4",
  cpu: "M7 7h10v10H7z M10 3v4 M14 3v4 M10 17v4 M14 17v4 M3 10h4 M3 14h4 M17 10h4 M17 14h4",
  grid: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  bot: "M5 8h14v11H5z M12 4v4 M9 13v1 M15 13v1",
  chat: "M4 5h16v11H8l-4 4z",
  key: "M15 4a5 5 0 100 10 5 5 0 000-10z M11.5 12.5L3 21 M6 18l2 2 M8 16l2 2",
  check: "M5 12l5 5 9-10",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  history: "M3 12a9 9 0 109-9 9 9 0 00-7 3.5 M3 4v4h4 M12 7v5l3 3",
  logout: "M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10",
  plus: "M12 5v14 M5 12h14",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13",
  graph: "M6 5a2 2 0 100 4 2 2 0 000-4z M18 5a2 2 0 100 4 2 2 0 000-4z M12 15a2 2 0 100 4 2 2 0 000-4z M7.5 8.5l3.5 6.5 M16.5 8.5L13 15",
  copy: "M8 8h12v12H8z M4 16V4h12",
  paperclip: "M20 11l-8 8a5 5 0 01-7-7l8-8a3.5 3.5 0 015 5l-8 8a2 2 0 01-3-3l7-7",
  stop: "M7 7h10v10H7z",
  retry: "M4 12a8 8 0 0114-5.3 M18 3v4h-4 M20 12a8 8 0 01-14 5.3 M6 21v-4h4",
  x: "M6 6l12 12 M18 6L6 18",
  arrow: "M5 12h14 M13 6l6 6-6 6",
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] || P.plug} />
    </svg>
  );
}
