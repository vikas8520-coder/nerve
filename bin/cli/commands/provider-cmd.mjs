export function registerProvider(program) {
  program
    .command("provider [subcommand]")
    .description("Manage provider connections (use 'providers' for the full interface)")
    .allowUnknownOption()
    .allowExcessArguments()
    .action(() => {
      console.log(`
  Use \`nerve providers\` for the full provider management interface:

    nerve providers available   — show provider catalog
    nerve providers list        — list configured connections
    nerve providers test <name> — test a provider connection
    nerve providers test-all    — test all active connections
    nerve providers validate    — validate local configuration
`);
    });
}
