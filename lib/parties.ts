export type Party = {
  name: string;
  abbreviation: string;
};

// Source: INEC final list of presidential candidates, 12 September 2026. Confirm against the official document before launch.
// TODO: Load the active parties from the database "parties" table (active = 1) later.
export const parties: Party[] = [
  { name: "Accord", abbreviation: "A" },
  { name: "Action Alliance", abbreviation: "AA" },
  { name: "African Action Congress", abbreviation: "AAC" },
  { name: "African Democratic Congress", abbreviation: "ADC" },
  { name: "Action Democratic Party", abbreviation: "ADP" },
  { name: "All Progressives Congress", abbreviation: "APC" },
  { name: "Allied Peoples Movement", abbreviation: "APM" },
  { name: "Action Peoples Party", abbreviation: "APP" },
  { name: "Boot Party", abbreviation: "BP" },
  { name: "Democratic Leadership Alliance", abbreviation: "DLA" },
  { name: "Labour Party", abbreviation: "LP" },
  { name: "Nigeria Democratic Congress", abbreviation: "NDC" },
  { name: "National Democratic Party", abbreviation: "NDP" },
  { name: "National Rescue Movement", abbreviation: "NRM" },
  { name: "Peoples Democratic Party", abbreviation: "PDP" },
  { name: "Peoples Redemption Party", abbreviation: "PRP" },
  { name: "Social Democratic Party", abbreviation: "SDP" },
  { name: "Young Progressives Party", abbreviation: "YPP" },
  { name: "Zenith Labour Party", abbreviation: "ZLP" },
];
