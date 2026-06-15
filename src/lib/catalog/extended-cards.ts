import rawCards from "./cards-extended.json";

export type ExtendedCard = {
  cid: string;          // Card ID e.g. "OP01-077"
  name: string;
  type: string;         // Leader, Character, Event, Stage, DON
  color: string;        // Red, Green, Blue, Purple, Black, Yellow, multi
  colorId: number;
  cost: number | null;
  traits: string;       // e.g. "Supernovas/Straw Hat Crew"
  power: number | null;
  life: number | null;
  rarity: string;       // C, UC, R, SR, SEC, L, Promo, DON
  rarityId: number;
  altArt: string | null;  // Artist name for alt art
  imageUrl: string;
  effect: string;       // Card effect text
  setName: string;
  setDate: string | null;
  counterPower: number | null;
};

const COLOR_MAP: Record<string, string> = {
  "1": "Red", "4": "Purple", "5": "Red/Green", "6": "Blue",
  "7": "Green", "8": "Red/Purple", "9": "Blue/Purple", "10": "Red/Blue",
  "11": "Green/Purple", "12": "Black", "13": "Green/Blue",
  "14": "Red/Black", "15": "Blue/Black", "16": "Yellow",
  "17": "Green/Black", "18": "Green/Yellow", "19": "Purple/Yellow",
  "20": "Black/Yellow", "21": "Blue/Yellow", "22": "Red/Yellow",
  "23": "Purple/Black", "24": "Red/Green/Yellow", "25": "Blue/Purple/Black",
};

const RARITY_MAP: Record<string, string> = {
  "0": "DON", "1": "L", "2": "C", "3": "UC",
  "4": "R", "5": "SR", "6": "SEC", "7": "Promo",
  "8": "SP", "9": "Treasure",
};

const TYPE_MAP: Record<string, string> = {
  "1": "Leader", "2": "Character", "3": "Event", "4": "Stage", "5": "DON",
};

let _cache: ExtendedCard[] | null = null;

export function getExtendedCards(): ExtendedCard[] {
  if (_cache) return _cache;

  _cache = (rawCards as Array<Record<string, unknown>>).map((raw) => ({
    cid: String(raw.cid ?? ""),
    name: String(raw.n ?? ""),
    type: TYPE_MAP[String(raw.t ?? "")] ?? "Unknown",
    color: COLOR_MAP[String(raw.col ?? "")] ?? "Unknown",
    colorId: Number(raw.col ?? 0),
    cost: raw.cs != null ? Number(raw.cs) : null,
    traits: String(raw.tr ?? ""),
    power: raw.p != null ? Number(raw.p) : null,
    life: raw.l != null ? Number(raw.l) : null,
    rarity: RARITY_MAP[String(raw.r ?? "")] ?? "Unknown",
    rarityId: Number(raw.r ?? 0),
    altArt: raw.ar ? String(raw.ar) : null,
    imageUrl: String(raw.iu ?? ""),
    effect: String(raw.e ?? ""),
    setName: String(raw.srcN ?? ""),
    setDate: raw.srcD ? String(raw.srcD) : null,
    counterPower: raw.cp != null ? Number(raw.cp) : null,
  }));

  return _cache;
}

/** Find extended data for a card by ID */
export function findExtended(cardCode: string): ExtendedCard | undefined {
  return getExtendedCards().find(
    (c) => c.cid.toUpperCase() === cardCode.toUpperCase()
  );
}

/** Find cards that synergize with a given card (same color, shared traits) */
export function findSynergies(card: ExtendedCard, limit = 10): ExtendedCard[] {
  const cards = getExtendedCards();
  const cardTraits = new Set(
    card.traits.split(/[/,]/).map((t) => t.trim().toLowerCase()).filter(Boolean)
  );

  const scored = cards
    .filter((c) => c.cid !== card.cid && c.type !== "DON" && c.type !== "Leader")
    .map((c) => {
      let score = 0;

      // Same color = strong synergy
      if (c.colorId === card.colorId) score += 10;
      // Multi-color including this color
      if (c.color.includes(card.color.split("/")[0])) score += 5;

      // Shared traits
      const cTraits = c.traits.split(/[/,]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
      for (const t of cTraits) {
        if (cardTraits.has(t)) score += 8;
      }

      // Effect mentions same trait keywords
      const effectLower = c.effect.toLowerCase();
      for (const t of cardTraits) {
        if (t.length > 3 && effectLower.includes(t)) score += 4;
      }

      // Higher rarity = more interesting recommendation
      if (c.rarityId >= 5) score += 3;
      if (c.rarityId >= 6) score += 5;

      return { card: c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.card);
}

/** Recommend cards for a collection based on all cards' traits and colors */
export function recommendForCollection(
  collectionCardCodes: string[],
  limit = 10
): ExtendedCard[] {
  const cards = getExtendedCards();
  const ownedCodes = new Set(collectionCardCodes.map((c) => c.toUpperCase()));

  // Gather traits and colors from owned cards
  const traitCounts = new Map<string, number>();
  const colorCounts = new Map<number, number>();
  const ownedExtended: ExtendedCard[] = [];

  for (const code of collectionCardCodes) {
    const ext = findExtended(code);
    if (!ext) continue;
    ownedExtended.push(ext);

    colorCounts.set(ext.colorId, (colorCounts.get(ext.colorId) ?? 0) + 1);

    for (const t of ext.traits.split(/[/,]/).map((s) => s.trim().toLowerCase()).filter(Boolean)) {
      traitCounts.set(t, (traitCounts.get(t) ?? 0) + 1);
    }
  }

  if (ownedExtended.length === 0) return [];

  // Dominant color and traits
  const dominantColor = [...colorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topTraits = [...traitCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  // Score all cards not owned
  const scored = cards
    .filter((c) => !ownedCodes.has(c.cid.toUpperCase()) && c.type !== "DON")
    .map((c) => {
      let score = 0;

      // Same dominant color
      if (c.colorId === dominantColor) score += 10;

      // Shared traits with collection
      const cTraits = c.traits.split(/[/,]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
      for (const t of cTraits) {
        const count = traitCounts.get(t) ?? 0;
        if (count > 0) score += count * 3;
      }

      // Effect synergy — mentions top traits
      const effectLower = c.effect.toLowerCase();
      for (const t of topTraits) {
        if (t.length > 3 && effectLower.includes(t)) score += 5;
      }

      // Prefer higher rarity for recommendations
      if (c.rarityId >= 5) score += 2;
      if (c.rarityId >= 6) score += 4;

      // Prefer characters and events over stages
      if (c.type === "Character") score += 1;

      return { card: c, score };
    })
    .filter((s) => s.score > 5)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.card);
}
