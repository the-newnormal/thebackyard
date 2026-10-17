// Country codes offered next to the mobile number. Singapore comes first and
// is the default.
export const COUNTRIES = [
  { flag: "🇸🇬", code: "+65", name: "Singapore" },
  { flag: "🇲🇾", code: "+60", name: "Malaysia" },
  { flag: "🇮🇩", code: "+62", name: "Indonesia" },
  { flag: "🇵🇭", code: "+63", name: "Philippines" },
  { flag: "🇹🇭", code: "+66", name: "Thailand" },
  { flag: "🇻🇳", code: "+84", name: "Vietnam" },
  { flag: "🇲🇲", code: "+95", name: "Myanmar" },
  { flag: "🇰🇭", code: "+855", name: "Cambodia" },
  { flag: "🇧🇳", code: "+673", name: "Brunei" },
  { flag: "🇱🇦", code: "+856", name: "Laos" },
  { flag: "🇨🇳", code: "+86", name: "China" },
  { flag: "🇯🇵", code: "+81", name: "Japan" },
  { flag: "🇰🇷", code: "+82", name: "South Korea" },
  { flag: "🇮🇳", code: "+91", name: "India" },
  { flag: "🇦🇺", code: "+61", name: "Australia" },
  { flag: "🇳🇿", code: "+64", name: "New Zealand" },
  { flag: "🇬🇧", code: "+44", name: "United Kingdom" },
  { flag: "🇺🇸", code: "+1", name: "United States" },
  { flag: "🇨🇦", code: "+1", name: "Canada" },
  { flag: "🇩🇪", code: "+49", name: "Germany" },
  { flag: "🇫🇷", code: "+33", name: "France" },
] as const;

export type Country = (typeof COUNTRIES)[number];
