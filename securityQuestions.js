/** Keep in sync with `fifamyplayer-frontend/src/config/securityQuestions.ts`. */
const SECURITY_QUESTIONS = [
  "What city were you born in?",
  "What was your childhood nickname?",
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What was the make of your first car?",
  "What elementary school did you attend?",
  "What is the name of your favorite fictional character?",
  "In what city did your parents meet?",
];

function normalizeSecurityAnswer(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD");
}

function isAllowedQuestion(q) {
  const t = String(q ?? "").trim();
  return SECURITY_QUESTIONS.includes(t);
}

module.exports = {
  SECURITY_QUESTIONS,
  normalizeSecurityAnswer,
  isAllowedQuestion,
};
