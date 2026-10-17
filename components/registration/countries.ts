// Country codes offered next to the mobile number. Singapore comes first and
// is the default. `digits` is the longest number there without the country
// code or trunk 0.
export const COUNTRIES = [
  { flag: "🇸🇬", code: "+65", name: "Singapore", digits: 8 },
  { flag: "🇲🇾", code: "+60", name: "Malaysia", digits: 10 },
  { flag: "🇮🇩", code: "+62", name: "Indonesia", digits: 12 },
  { flag: "🇵🇭", code: "+63", name: "Philippines", digits: 10 },
  { flag: "🇹🇭", code: "+66", name: "Thailand", digits: 9 },
  { flag: "🇻🇳", code: "+84", name: "Vietnam", digits: 10 },
  { flag: "🇲🇲", code: "+95", name: "Myanmar", digits: 10 },
  { flag: "🇰🇭", code: "+855", name: "Cambodia", digits: 9 },
  { flag: "🇧🇳", code: "+673", name: "Brunei", digits: 7 },
  { flag: "🇱🇦", code: "+856", name: "Laos", digits: 10 },
  { flag: "🇨🇳", code: "+86", name: "China", digits: 11 },
  { flag: "🇯🇵", code: "+81", name: "Japan", digits: 10 },
  { flag: "🇰🇷", code: "+82", name: "South Korea", digits: 10 },
  { flag: "🇮🇳", code: "+91", name: "India", digits: 10 },
  { flag: "🇦🇺", code: "+61", name: "Australia", digits: 9 },
  { flag: "🇳🇿", code: "+64", name: "New Zealand", digits: 10 },
  { flag: "🇬🇧", code: "+44", name: "United Kingdom", digits: 10 },
  { flag: "🇺🇸", code: "+1", name: "United States", digits: 10 },
  { flag: "🇨🇦", code: "+1", name: "Canada", digits: 10 },
  { flag: "🇩🇪", code: "+49", name: "Germany", digits: 11 },
  { flag: "🇫🇷", code: "+33", name: "France", digits: 9 },
] as const;

export type Country = (typeof COUNTRIES)[number];
