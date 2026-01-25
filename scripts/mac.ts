const args = process.argv.slice(2);
const rawPort = args[0];
const port = rawPort && /^\d+$/.test(rawPort) ? rawPort : undefined;

if (rawPort && !port) {
    console.error("Expected a numeric port like `bun mac 8089`.");
    process.exit(1);
}

const env = port ? { ...process.env, RCT_METRO_PORT: port } : process.env;

const processHandle = Bun.spawn({
    cmd: ["react-native", "run-macos"],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env,
});

const exitCode = await processHandle.exited;
process.exit(exitCode ?? 1);
