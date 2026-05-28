const answers = [
  "Tilak — 9561750259",
  "Nirmal — 7022684582",
  "Call +91 95617 50259 or 080-12345678",
  "Date is 2024-05-28 and 12345",
  "A 10 digit number like 1234567890",
  "Already formatted [9876543210](tel:9876543210)"
];

answers.forEach(answer => {
  const formattedAnswer = answer.replace(
    /(\+?[\d][\d\s-]{8,14}[\d])/g,
    (match) => {
      const digits = match.replace(/[^0-9+]/g, '');
      if (digits.length >= 10 && digits.length <= 15) {
        return `[${match.trim()}](tel:${digits})`;
      }
      return match;
    }
  );
  console.log("Original: ", answer);
  console.log("Formatted:", formattedAnswer);
  console.log("---");
});
