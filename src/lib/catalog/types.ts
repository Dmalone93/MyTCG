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
  cardText: string;     // effect text
  subTypes: string;     // traits e.g. "Straw Hat Crew Supernovas"
  life: string;         // for leaders
  counterAmount: string; // counter power
  imageUrl: string;
  marketPrice: number | null;
  inventoryPrice: number | null;
};
