// One-off: send App-to-User Test-Pi from the paired Testnet app to N users.
// Satisfies the Dev Portal rule "Testnet app needs A2U transactions to 5 unique wallets".
//
//   set PI_TESTNET_API_KEY=...        (Testnet app -> Get API key)
//   set PI_TESTNET_WALLET_SEED=S...   (Testnet app wallet secret key)
//   node scripts/testnet-a2u.js <uid1> <uid2> <uid3> <uid4> <uid5>
//
// UIDs come from users signing in at https://testnet.view2earn.org/
const PiNetwork = require("pi-backend");

const apiKey = process.env.PI_TESTNET_API_KEY;
const seed = process.env.PI_TESTNET_WALLET_SEED;
const uids = process.argv.slice(2);
if (!apiKey || !seed || uids.length === 0) {
  console.error("Usage: PI_TESTNET_API_KEY, PI_TESTNET_WALLET_SEED env + uids as args");
  process.exit(1);
}

(async () => {
  const pi = new PiNetwork(apiKey, seed);
  // Pi allows one A2U in flight; cancel leftovers or createPayment fails.
  for (const p of await pi.getIncompleteServerPayments().catch(() => [])) {
    await pi.cancelPayment(p.identifier).catch(() => {});
  }
  for (const uid of uids) {
    try {
      const paymentId = await pi.createPayment({ amount: 0.01, memo: "View2Earn testnet check", metadata: { uid }, uid });
      const txid = await pi.submitPayment(paymentId);
      await pi.completePayment(paymentId, txid);
      console.log(`OK   ${uid}  payment=${paymentId} tx=${txid}`);
    } catch (e) {
      console.log(`FAIL ${uid}  ${e && e.message || e}`);
    }
  }
})();
