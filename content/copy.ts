// Site copy, adapted from the Backyard brand guide. Edit freely.

import { event } from "./event";

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
      body: "Food is the pull factor — local fare mixed with a western flair. An alternative to your usual Friday dinner, and a highlight of the area.",
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

export const faqs = [
  {
    q: "Is it really free?",
    a: "Yep. The BBQ is on us — we just ask you to register so we know how much food to prep.",
  },
  {
    q: "Can I bring friends?",
    a: "Please do. Add them when you register, or send them the link so they can sign up themselves.",
  },
  {
    q: "I have dietary needs.",
    a: "Tell us in the form — vegetarian, halal, no beef, allergies — and we’ll do our best to cater for you.",
  },
  {
    q: "Do I need to know anyone?",
    a: "Not at all. Come alone, come as you are. Leaving with new friends is kind of the point.",
  },
  {
    q: "How do I get there?",
    a: "Head to *SCAPE Plaza on Level 1 of *SCAPE, 2 Orchard Link — a short walk from Somerset MRT.",
  },
  {
    q: "What if there’s haze?",
    a: `The BBQ may be called off if the PSI forecast reaches the “unhealthy” range. We’ll post any updates on Instagram at @${event.contact.instagram}.`,
  },
  {
    q: "Plans changed?",
    a: "No stress. Open the pass link from your registration and release your spot so someone else can come.",
  },
];
