// Site copy, adapted from the Backyard brand guide. Edit freely.

import { series } from "./series";

export const brand = {
  // Browser tab titles, link previews and search results.
  siteName: "Backyard SG",
  line: "a shared home where we eat, serve and love",
  personality: ["homely", "welcoming", "informal", "playful", "hosting-minded"],
};

export const whyBackyard = {
  kicker: "Why Backyard",
  title: "what does “backyard” mean?",
  body: "Backyards are places for friends and family to turn up and feel welcomed home — to play, and to dwell beyond the meal.",
  idea: {
    title: "the idea",
    body: "We’re bringing the backyard into shared spaces, built around BBQs — taking “home is where the heart is” much further. Anyone can be part of this, as long as they’re open to eat, serve and love.",
  },
};

export const whyBbq = {
  kicker: "Why BBQs",
  title: "what do BBQs mean to people?",
  answers: ["a celebration?", "a reunion?", "family?", "cohesion?"],
  foodFirst: {
    title: "why food first?",
    quote:
      "The belly comes before the soul, not in the scale of values, but in point of time.",
    quoteBy: "George Orwell",
    body: [
      "In a society where food is easily accessible, the reasons youth don’t eat out — and don’t eat together often — are more evident: expenses, time, climate, space. Going out for a meal becomes an added privilege.",
      "Removing that barrier is one thing. But we want to show that it’s more than a gathering.",
    ],
  },
};

export const model = {
  kicker: "Our model",
  title: "two prongs",
  prongs: [
    {
      name: "Feast",
      // Wrap words in **double asterisks** to bold them.
      body: "Food is the pull factor — local fare mixed with a western flair. An **alternative to your usual Friday dinner**, and a highlight of the area.",
    },
    {
      name: "Facilitate",
      body: "Love and service are woven through the whole event. It stays informal and natural, but it’s built with intention.",
    },
  ],
};

export const moreThan = {
  title: "more than a gathering",
  body: "We aim to be more than a place to dwell or a means to gather — a hub that pulls people in, just to be. Friendships will form, people will feel welcomed and hosted, and it will grow organically.",
};

// The consent on the last registration step, above its button. Pressing it
// agrees to this and to the Terms (content/terms.ts), which `terms` links to.
export const signUpConsent = {
  body: "By submitting this form, I consent to Backyard SG and its Affiliated Parties collecting, using and disclosing my personal data for operational planning, security, communications and research, and to using my contact details so they can text/email me information about events, programmes, products or services, handled in accordance with Singapore’s Personal Data Protection Act 2012. I can opt out of marketing at any time by emailing Backyard SG, as set out in the Terms.",
  terms: { before: "Full Terms & Conditions:", link: "Click Here" },
  // Ticked as well by anyone under 18 when they sign up (Terms 2.2).
  guardian: {
    label: "My parent or guardian has agreed to me signing up, and to these Terms.",
    missing: "Ask your parent or guardian first, then tick this to sign up.",
  },
  button: "Agree to proceed",
};

export const faqs = [
  {
    q: "Is it really free?",
    a: "Backyard is free for everyone, with no fixed fee and no expectation of payment. We’re a volunteer-run community that keeps going because people pay it forward. If Backyard has meant something to you, a contribution of any size helps keep it open for the next person.",
  },
  {
    q: "Can I bring friends?",
    a: "Please do! Send them the link so they can sign up too. Everyone registers for themselves, so we know how much food to prep.",
  },
  {
    q: "I have dietary needs.",
    a: "Tell us in the form — vegetarian, halal, no beef, allergies — and we’ll do our best to cater for you.",
  },
  {
    q: "Is the food halal?",
    a: "We’re halal-friendly, but not halal-certified.",
  },
  {
    q: "Do I need to know anyone?",
    a: "Not at all. Come alone, come as you are. Leaving with new friends is kind of the point.",
  },
  {
    q: "How often is Backyard?",
    a: `Every month, usually on a Friday evening. Follow @${series.contact.instagram} on Instagram to hear when the next date opens. Once you’ve registered, we’ll keep you posted too, unless you opt out.`,
  },
  {
    q: "How do I get there?",
    a: "The venue and directions for each Backyard are under “The night” above, and on your pass.",
  },
  {
    q: "What if there’s haze?",
    a: `The BBQ may be called off if the PSI forecast reaches the “unhealthy” range. We’ll post any updates on Instagram at @${series.contact.instagram}.`,
  },
  {
    q: "Plans changed?",
    a: "No stress. Open the pass link from your registration and release your spot so someone else can come.",
  },
];
