import { accountKeyOf } from "../linked-profiles";

// One account must produce ONE key however its URL is written — that is what
// stops a completed task reappearing under a different link.
describe("accountKeyOf", () => {
  it("collapses URL variants of the same account", () => {
    for (const u of [
      "https://youtube.com/@MyChannel",
      "https://www.youtube.com/@mychannel",
      "https://m.youtube.com/@MyChannel/videos",
      "http://youtube.com/@mychannel/",
      "https://youtube.com/c/MyChannel",
      "https://www.youtube.com/user/mychannel?sub_confirmation=1",
    ]) {
      expect(accountKeyOf("youtube", u)).toBe("youtube:mychannel");
    }
  });

  it("handles tiktok, telegram, instagram and x", () => {
    expect(accountKeyOf("tiktok", "https://vm.tiktok.com/@Foo")).toBe("tiktok:foo");
    expect(accountKeyOf("telegram", "https://t.me/MyGroup")).toBe("telegram:mygroup");
    expect(accountKeyOf("telegram", "https://telegram.me/mygroup")).toBe("telegram:mygroup");
    expect(accountKeyOf("instagram", "https://instagram.com/Someone/")).toBe("instagram:someone");
    expect(accountKeyOf("x", "https://twitter.com/Handle")).toBe("x:handle");
  });

  it("keeps facebook numeric profile ids, which live in the query string", () => {
    expect(accountKeyOf("facebook", "https://facebook.com/profile.php?id=123456")).toBe(
      "facebook:123456",
    );
  });

  it("infers the platform from the host when none is given (backfill path)", () => {
    expect(accountKeyOf(undefined, "https://tiktok.com/@foo")).toBe("tiktok:foo");
  });

  it("returns null for post URLs and unknown hosts, so callers fall back to the URL", () => {
    expect(accountKeyOf("instagram", "https://instagram.com/p/AbCdEf")).toBeNull();
    expect(accountKeyOf("youtube", "https://youtube.com/shorts")).toBeNull();
    expect(accountKeyOf(undefined, "https://example.com/foo")).toBeNull();
    expect(accountKeyOf("tiktok", "")).toBeNull();
  });

  it("treats different accounts as different", () => {
    expect(accountKeyOf("tiktok", "https://tiktok.com/@a")).not.toBe(
      accountKeyOf("tiktok", "https://tiktok.com/@b"),
    );
  });
});
