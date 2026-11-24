// TODO: Replace this fake location data with real database data.

export type PollingUnit = {
  name: string;
  code: string;
};

export type Ward = {
  name: string;
  units: PollingUnit[];
};

export type LGA = {
  name: string;
  wards: Ward[];
};

export type State = {
  name: string;
  lgas: LGA[];
};

export const fakeLocations: State[] = [
  {
    name: "Lagos",
    lgas: [
      {
        name: "Ikeja",
        wards: [
          {
            name: "Ward 01",
            units: [
              { name: "Ikeja Primary School I", code: "24-01-01-001" },
              { name: "Ikeja Primary School II", code: "24-01-01-002" },
            ],
          },
          {
            name: "Ward 02",
            units: [
              { name: "Local Government Hall I", code: "24-01-02-001" },
              { name: "Local Government Hall II", code: "24-01-02-002" },
            ],
          },
        ],
      },
      {
        name: "Epe",
        wards: [
          {
            name: "Ward 01",
            units: [
              { name: "Epe Town Hall I", code: "24-02-01-001" },
              { name: "Epe Town Hall II", code: "24-02-01-002" },
            ],
          },
          {
            name: "Ward 02",
            units: [
              { name: "Epe Community School I", code: "24-02-02-001" },
              { name: "Epe Community School II", code: "24-02-02-002" },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "FCT",
    lgas: [
      {
        name: "Abuja Municipal",
        wards: [
          {
            name: "Wuse Ward",
            units: [
              { name: "Wuse Primary School I", code: "15-01-01-001" },
              { name: "Wuse Primary School II", code: "15-01-01-002" },
            ],
          },
          {
            name: "Garki Ward",
            units: [
              { name: "Garki Secretariat I", code: "15-01-02-001" },
              { name: "Garki Secretariat II", code: "15-01-02-002" },
            ],
          },
        ],
      },
      {
        name: "Bwari",
        wards: [
          {
            name: "Bwari Central",
            units: [
              { name: "Bwari Central School I", code: "15-02-01-001" },
              { name: "Bwari Central School II", code: "15-02-01-002" },
            ],
          },
          {
            name: "Byazhin",
            units: [
              { name: "Byazhin Community Hall I", code: "15-02-02-001" },
              { name: "Byazhin Community Hall II", code: "15-02-02-002" },
            ],
          },
        ],
      },
    ],
  },
];
