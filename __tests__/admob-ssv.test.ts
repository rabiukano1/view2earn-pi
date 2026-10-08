// AdMob SSV signature verification depends on two fiddly steps:
//   1. signing exactly the query string BEFORE "&signature="
//   2. converting Google's DER ECDSA signature to the raw r||s Web Crypto wants
// Both fail silently — a wrong result just looks like "Google never calls us",
// and every rewarded ad would be treated as unverified. Hence these tests.

function signedContentOf(query: string): string {
  const i = query.indexOf('&signature=');
  return i < 0 ? '' : query.slice(0, i);
}

function derToRawEcdsa(der: Uint8Array): Uint8Array {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error('bad DER');
  if (der[i] & 0x80) i += 1 + (der[i] & 0x7f);
  else i += 1;
  const readInt = (): Uint8Array => {
    if (der[i++] !== 0x02) throw new Error('bad DER int');
    const len = der[i++];
    let val = der.slice(i, i + len);
    i += len;
    while (val.length > 32 && val[0] === 0x00) val = val.slice(1);
    const padded = new Uint8Array(32);
    padded.set(val, 32 - val.length);
    return padded;
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

describe('AdMob SSV', () => {
  it('signs everything before &signature=, excluding signature and key_id', () => {
    const q =
      'ad_network=5450213213286189855&ad_unit=1234&custom_data=abc-123' +
      '&reward_amount=1&reward_item=points&timestamp=1700000000000' +
      '&transaction_id=TX1&user_id=u1&signature=MEUCIQ&key_id=3335741209';
    expect(signedContentOf(q)).toBe(
      'ad_network=5450213213286189855&ad_unit=1234&custom_data=abc-123' +
        '&reward_amount=1&reward_item=points&timestamp=1700000000000' +
        '&transaction_id=TX1&user_id=u1',
    );
    expect(signedContentOf(q)).not.toContain('signature=');
    expect(signedContentOf(q)).not.toContain('key_id=');
  });

  it('returns empty when there is no signature parameter', () => {
    expect(signedContentOf('transaction_id=TX1&user_id=u1')).toBe('');
  });

  it('converts a DER signature to 64-byte raw r||s', () => {
    // SEQUENCE { INTEGER r(32 bytes of 0x01), INTEGER s(32 bytes of 0x02) }
    const r = new Uint8Array(32).fill(0x01);
    const s = new Uint8Array(32).fill(0x02);
    const der = new Uint8Array([0x30, 0x44, 0x02, 0x20, ...r, 0x02, 0x20, ...s]);
    const raw = derToRawEcdsa(der);
    expect(raw.length).toBe(64);
    expect(Array.from(raw.slice(0, 32))).toEqual(Array.from(r));
    expect(Array.from(raw.slice(32))).toEqual(Array.from(s));
  });

  it('strips the DER leading zero pad and left-pads short integers to 32 bytes', () => {
    // r is 33 bytes with a leading 0x00 (DER sign padding); s is only 31 bytes.
    const rPadded = new Uint8Array([0x00, ...new Uint8Array(32).fill(0xff)]);
    const sShort = new Uint8Array(31).fill(0x09);
    const der = new Uint8Array([
      0x30, 0x44, 0x02, 0x21, ...rPadded, 0x02, 0x1f, ...sShort,
    ]);
    const raw = derToRawEcdsa(der);
    expect(raw.length).toBe(64);
    expect(raw[0]).toBe(0xff); // leading zero removed
    expect(raw[32]).toBe(0x00); // short s left-padded
    expect(raw[33]).toBe(0x09);
  });

  it('rejects malformed DER rather than returning a wrong signature', () => {
    expect(() => derToRawEcdsa(new Uint8Array([0x02, 0x01, 0x00]))).toThrow();
  });
});
