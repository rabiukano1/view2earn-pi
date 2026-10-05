// Guards the email linkifier in PolicyPage: policy text is plain strings, and a
// broken split silently turns every published address back into dead text.
const EMAIL = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

test("splits text into alternating text and address parts", () => {
  const parts = "Write to support@view2earn.org or legal@view2earn.org today.".split(EMAIL);
  // Odd indexes are the captured addresses.
  expect(parts.filter((_, i) => i % 2 === 1)).toEqual([
    "support@view2earn.org",
    "legal@view2earn.org",
  ]);
  expect(parts.join("")).toBe("Write to support@view2earn.org or legal@view2earn.org today.");
});

test("text with no address survives untouched", () => {
  const parts = "No address here.".split(EMAIL);
  expect(parts).toEqual(["No address here."]);
});
