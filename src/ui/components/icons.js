/* Набор инлайновых SVG-иконок: обводка, currentColor, нулевой вес. */
const w = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICON = {
  overview: w('<path d="M3 13h4l2.5-7 4 14L16 13h5"/>'),
  body:     w('<circle cx="12" cy="4.6" r="2.3"/><path d="M12 7.2v7.3M6.4 9.4 12 7.6l5.6 1.8M8.8 21l3.2-6.5 3.2 6.5M6.4 9.4v4.2M17.6 9.4v4.2"/>'),
  journal:  w('<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.8v3.4M16 2.8v3.4"/><circle cx="8.5" cy="13.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12.5" cy="13.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="17" r="1.1" fill="currentColor" stroke="none"/>'),
  chart:    w('<path d="M3.5 20.5V4M3.5 20.5H21M7.5 17v-4.5M12 17V8M16.5 17v-7"/>'),
  arsenal:  w('<path d="M12 2.8 4.5 6v6c0 4.6 3.2 7.9 7.5 9.2 4.3-1.3 7.5-4.6 7.5-9.2V6z"/><path d="M9.2 12.2l2 2 3.6-4"/>'),
  plus:     w('<path d="M12 5.5v13M5.5 12h13"/>'),
  user:     w('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c0-4 3.4-6.6 7.5-6.6s7.5 2.6 7.5 6.6"/>'),
  shield:   w('<path d="M12 2.8 4.5 6v6c0 4.6 3.2 7.9 7.5 9.2 4.3-1.3 7.5-4.6 7.5-9.2V6z"/>'),
  sun:      w('<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>'),
  moon:     w('<path d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4z"/>'),
  bolt:     w('<path d="M13.2 2.8 5 13.4h5.4l-.6 7.8L18 10.6h-5.4z"/>'),
  timer:    w('<circle cx="12" cy="13.4" r="7.6"/><path d="M12 9.6v4l2.6 1.7M9.4 2.6h5.2"/>'),
  flame:    w('<path d="M12 2.8s4.8 4.6 4.8 8.8a4.8 4.8 0 0 1-9.6 0c0-1.8 1-2.9 1-2.9s.1 1.9 1.9 1.9 1.9-3.8 1.9-7.8z"/>'),
  mail:     w('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3.6 6.5 8.4 6.2 8.4-6.2"/>'),
  warn:     w('<path d="M12 3.4 2.4 20.4h19.2z"/><path d="M12 9.6v4.6M12 17.4h.01"/>'),
  check:    w('<path d="m4.5 12.5 5 5 10-11"/>'),
  x:        w('<path d="M6 6l12 12M18 6 6 18"/>'),
  chev:     w('<path d="m9.5 5.5 7 6.5-7 6.5"/>'),
  refresh:  w('<path d="M20.4 11.4a8.4 8.4 0 1 0-2.5 6.1M20.4 5v6.4H14"/>'),
  logout:   w('<path d="M14.5 4.5h-9v15h9M18.5 12h-9M15.5 8.2l3.8 3.8-3.8 3.8"/>'),
  trophy:   w('<path d="M7.2 4.2h9.6v4.6a4.8 4.8 0 0 1-9.6 0z"/><path d="M7.2 6.2H4.4v1.8a3 3 0 0 0 3 3M16.8 6.2h2.8v1.8a3 3 0 0 1-3 3M10.4 19.2h3.2M12 13.6v5.6M8.4 21.2h7.2"/>'),
  terminal: w('<rect x="2.8" y="4.4" width="18.4" height="15.2" rx="3"/><path d="m7.4 9.6 3 2.8-3 2.8M13.4 15.4h4"/>'),
  gear:     w('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/>'),
  target:   w('<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>'),
  swords:   w('<path d="M4.5 4.5h3l9.5 9.5-3 3L4.5 7.5zM19.5 4.5h-3L7 14l3 3 9.5-9.5z"/>'),
};

/**
 * Возвращает готовый SVG-элемент.
 * Размер задаётся атрибутами, а не только CSS: без них svg без правила
 * растягивается на всю ширину родителя. Любое CSS-правило (.btn svg и
 * прочие) перебивает атрибуты, так что точечные размеры продолжают
 * работать как раньше.
 */
export const icon = (name, cls = '', size = 16) => {
  const span = document.createElement('span');
  span.innerHTML = ICON[name] ?? ICON.overview;
  const svg = span.firstElementChild;
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  if (cls) svg.setAttribute('class', cls);
  return svg;
};
