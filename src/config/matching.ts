export const MATCH_WEIGHTS = Object.freeze({
  semantic: 0.3,
  skills: 0.25,
  title: 0.15,
  experience: 0.1,
  location: 0.08,
  employment: 0.05,
  workplace: 0.03,
  recency: 0.04,
});

export const MATCH_BANDS = Object.freeze([
  { minimum: 90, label: "Excellent Match" },
  { minimum: 80, label: "Strong Match" },
  { minimum: 70, label: "Good Match" },
  { minimum: 55, label: "Moderate Match" },
  { minimum: 0, label: "Low Match" },
]);

