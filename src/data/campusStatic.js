// Static campus data + small embedded assets that don't change at runtime.

export const CAMPUS_CENTER = {lat:22.2905,lng:73.3643};

// Real traced campus perimeter (56 points), used to mask out everything
// outside the actual campus shape — not just a rough rectangle. See
// CAMPUS_MAP_BOUNDS below for the looser rectangle used by Leaflet's
// maxBounds (panning/zoom-out limit), which is intentionally a bit larger
// than this exact outline.
export const CAMPUS_OUTLINE = [
  [22.284962,73.363296],
  [22.284964,73.363312],
  [22.284999,73.364025],
  [22.285164,73.364288],
  [22.285519,73.364905],
  [22.285551,73.364910],
  [22.285689,73.365251],
  [22.286160,73.365316],
  [22.287314,73.365344],
  [22.287481,73.365543],
  [22.287654,73.366582],
  [22.288470,73.366395],
  [22.290004,73.366432],
  [22.290861,73.366985],
  [22.292244,73.367553],
  [22.292507,73.368464],
  [22.293343,73.368763],
  [22.294955,73.369641],
  [22.295584,73.369965],
  [22.296253,73.370174],
  [22.296876,73.371095],
  [22.297751,73.369933],
  [22.298321,73.369045],
  [22.297857,73.367654],
  [22.297062,73.363795],
  [22.297207,73.361886],
  [22.297185,73.359963],
  [22.296421,73.359890],
  [22.295949,73.359796],
  [22.295555,73.358920],
  [22.295691,73.358366],
  [22.294985,73.358430],
  [22.294194,73.358598],
  [22.293079,73.358783],
  [22.292413,73.359076],
  [22.291680,73.359414],
  [22.290839,73.360049],
  [22.290257,73.360946],
  [22.290396,73.361005],
  [22.290404,73.361307],
  [22.290493,73.361526],
  [22.290552,73.361811],
  [22.291266,73.361874],
  [22.292084,73.361685],
  [22.292965,73.361396],
  [22.291365,73.362576],
  [22.290754,73.362717],
  [22.290711,73.362390],
  [22.290664,73.362360],
  [22.289242,73.361553],
  [22.288469,73.362412],
  [22.287814,73.362769],
  [22.286686,73.363348],
  [22.285774,73.363642],
  [22.285340,73.363466],
  [22.285263,73.363231],
];

// A giant box covering the whole visible world, used as the OUTER ring of
// the mask polygon — the campus outline above is its inner ring (a "hole"),
// so the filled area is everything EXCEPT campus.
export const WORLD_OUTER_RING = [[-90,-180],[-90,180],[90,180],[90,-180]];

// Loose rectangle around the traced outline (with a small buffer) for
// Leaflet's maxBounds — this limits panning/zooming, while CAMPUS_OUTLINE
// (above) handles the exact visual mask. Kept slightly larger than the
// outline on purpose so the mask's edge is never right at the pan limit.
export const CAMPUS_MAP_BOUNDS = [
  [22.284162,73.357566],
  [22.299121,73.371895],
];

export const EXPLORE_SPOTS = [
  {key:'library',label:'Library',icon:'books',dist:'120m'},
  {key:'central canteen',label:'Canteen',icon:'kitchen',dist:'230m'},
  {key:'gym',label:'GYM',icon:'barbell',dist:'340m'},
  {key:'dominos',label:'Dominos',icon:'pizza',dist:'410m'},
  {key:'shree sai temple',label:'Temple',icon:'om',dist:'380m'},
  {key:'d block',label:'D Block',icon:'school',dist:'180m'},
  {key:'pu gate-3',label:'Gate-3',icon:'doorExit',dist:'290m'},
  {key:'greenzy',label:'Greenzy',icon:'trees',dist:'520m'},
  {key:'central bank atm',label:'ATM',icon:'creditCard',dist:'80m'},
  {key:'auditorium',label:'Auditorium',icon:'masksTheater',dist:'160m'},
];

export const SAFE_ZONES = [
  { key: 'parul admin cell', name: 'Admin Office', type: 'security', icon: 'shield' },
  { key: 'pu ayurved hospital', name: 'Hospital', type: 'medical', icon: 'hospital' },
  { key: 'library', name: 'Library', type: 'shelter', icon: 'books' },
  { key: 'central canteen', name: 'Canteen', type: 'populated', icon: 'kitchen' },
  { key: 'auditorium', name: 'Auditorium', type: 'shelter', icon: 'masksTheater' },
];

export const SOS_ICON_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E";

export const SHARE_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z'/%3E%3C/svg%3E";
// Baby footprint — shown as the walking trail behind the player
export const FOOTPRINT_ICON = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAyADIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AIyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//9k=";