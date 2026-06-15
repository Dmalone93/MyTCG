export type CatalogCard = {
  cardSetId: string;    // e.g. "OP01-077"
  cardName: string;
  setName: string;
  setId: string;        // e.g. "OP-01"
  rarity: string;
  cardColor: string;
  cardType: string;
  cardCost: string;
  cardPower: string;
  imageUrl: string;
  marketPrice: number | null;
  inventoryPrice: number | null;
};
