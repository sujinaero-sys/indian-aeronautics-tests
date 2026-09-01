// Master catalog of the 15 mock tests.
// `available:true` tests have a matching JSON file in /data/<discipline>/.
// Add more entries here (and drop in the matching JSON file) to extend the series.

const TEST_CATALOG = [
  // ---------------- Electronics & Communication (BE001) ----------------
  { id: "electronics-1", discipline: "electronics", label: "Electronics & Communication", num: 1, file: "data/electronics/mock1.json", available: true },
  { id: "electronics-2", discipline: "electronics", label: "Electronics & Communication", num: 2, file: "data/electronics/mock2.json", available: false },
  { id: "electronics-3", discipline: "electronics", label: "Electronics & Communication", num: 3, file: "data/electronics/mock3.json", available: false },
  { id: "electronics-4", discipline: "electronics", label: "Electronics & Communication", num: 4, file: "data/electronics/mock4.json", available: false },
  { id: "electronics-5", discipline: "electronics", label: "Electronics & Communication", num: 5, file: "data/electronics/mock5.json", available: false },

  // ---------------- Mechanical (BE002) ----------------
  { id: "mechanical-1", discipline: "mechanical", label: "Mechanical Engineering", num: 1, file: "data/mechanical/mock1.json", available: true },
  { id: "mechanical-2", discipline: "mechanical", label: "Mechanical Engineering", num: 2, file: "data/mechanical/mock2.json", available: false },
  { id: "mechanical-3", discipline: "mechanical", label: "Mechanical Engineering", num: 3, file: "data/mechanical/mock3.json", available: false },
  { id: "mechanical-4", discipline: "mechanical", label: "Mechanical Engineering", num: 4, file: "data/mechanical/mock4.json", available: false },
  { id: "mechanical-5", discipline: "mechanical", label: "Mechanical Engineering", num: 5, file: "data/mechanical/mock5.json", available: false },

  // ---------------- Computer Science (BE003) ----------------
  { id: "cs-1", discipline: "cs", label: "Computer Science Engineering", num: 1, file: "data/cs/mock1.json", available: true },
  { id: "cs-2", discipline: "cs", label: "Computer Science Engineering", num: 2, file: "data/cs/mock2.json", available: false },
  { id: "cs-3", discipline: "cs", label: "Computer Science Engineering", num: 3, file: "data/cs/mock3.json", available: false },
  { id: "cs-4", discipline: "cs", label: "Computer Science Engineering", num: 4, file: "data/cs/mock4.json", available: false },
  { id: "cs-5", discipline: "cs", label: "Computer Science Engineering", num: 5, file: "data/cs/mock5.json", available: false },
];
