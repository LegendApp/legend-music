const args = process.argv.slice(2);
const rawPort = args[0];
const port = rawPort && /^\d+$/.test(rawPort) ? rawPort : undefined;

if (rawPort && !port) {
    console.error("Expected a numeric port like `bun start 8089`.");
    process.exit(1);
}

const command = ["react-native", "start", "--client-logs"];
if (port) {
    command.push("--port", port);
}

const processHandle = Bun.spawn({
    cmd: command,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
});

const exitCode = await processHandle.exited;
process.exit(exitCode ?? 1);
