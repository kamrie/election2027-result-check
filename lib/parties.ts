export type Party = {
  id: number;
  name: string;
  abbreviation: string;
};

// Source: INEC final list of presidential candidates, 12 September 2026. Confirm against the official document before launch.
export const fallbackParties: Party[] = [
  { id: 1, name: "Accord", abbreviation: "A" },
  { id: 2, name: "Action Alliance", abbreviation: "AA" },
  { id: 3, name: "African Action Congress", abbreviation: "AAC" },
  { id: 4, name: "African Democratic Congress", abbreviation: "ADC" },
  { id: 5, name: "Action Democratic Party", abbreviation: "ADP" },
  { id: 6, name: "All Progressives Congress", abbreviation: "APC" },
  { id: 7, name: "Allied Peoples Movement", abbreviation: "APM" },
  { id: 8, name: "Action Peoples Party", abbreviation: "APP" },
  { id: 9, name: "Boot Party", abbreviation: "BP" },
  { id: 10, name: "Democratic Leadership Alliance", abbreviation: "DLA" },
  { id: 11, name: "Labour Party", abbreviation: "LP" },
  { id: 12, name: "Nigeria Democratic Congress", abbreviation: "NDC" },
  { id: 13, name: "National Democratic Party", abbreviation: "NDP" },
  { id: 14, name: "National Rescue Movement", abbreviation: "NRM" },
  { id: 15, name: "Peoples Democratic Party", abbreviation: "PDP" },
  { id: 16, name: "Peoples Redemption Party", abbreviation: "PRP" },
  { id: 17, name: "Social Democratic Party", abbreviation: "SDP" },
  { id: 18, name: "Young Progressives Party", abbreviation: "YPP" },
  { id: 19, name: "Zenith Labour Party", abbreviation: "ZLP" },
];
