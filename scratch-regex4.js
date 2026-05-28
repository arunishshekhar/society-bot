const answers = [
  "2024-05-28 12:34:56",
  "8295278852",
  "+91 8295278852",
  "+918295278852",
  "Contact me at 12345 67890",
  "0801234567"
];
answers.forEach(answer => {
  const formattedAnswer = answer.replace(
    /(?:(?:\+|00)91[\s-]?)?\b\d{10}\b/g,
    (match) => {
      const digits = match.replace(/[^0-9+]/g, '');
      return `[${match.trim()}](tel:${digits})`;
    }
  );
  console.log(formattedAnswer);
});
