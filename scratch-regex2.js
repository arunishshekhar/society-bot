const answers = [
  "2024-05-28 12:34:56",
  "8295278852",
  "+91 8295278852",
  "Contact me at 12345 67890"
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
  console.log(formattedAnswer);
});
