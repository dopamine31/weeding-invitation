export const BANKS = [
  { bank: "BCA", number: "5730363186", holder: "Ridho Ikhoirin" },
  { bank: "Mandiri", number: "1430035264256", holder: "Diah Ayu Umami" },
];
export const adminWa = (): string => process.env.ADMIN_WA ?? "";
export const adminName = (): string => process.env.ADMIN_NAME ?? "Admin";
