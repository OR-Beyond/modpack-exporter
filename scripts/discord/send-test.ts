const execute = process.argv.includes('--execute');
const url = process.env.DISCORD_TEST_WEBHOOK_URL;
if (execute) {
  if (!url) { console.error('Set DISCORD_TEST_WEBHOOK_URL to a TEST webhook (never production).'); process.exit(2); }
  console.log('Would send to redacted host. Aborting: implement sending in main service; this script is a stub.');
  process.exit(0);
} else {
  console.log('Dry run: prints payload only. Use --execute with DISCORD_TEST_WEBHOOK_URL to send.');
}
