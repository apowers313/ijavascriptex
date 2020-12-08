const {spawn} = require("child_process");

// prints anything passed to it
function transpileEcho(cmd, ... args) {
    console.log(... args);
}

// converts the __ijavascriptex_sh_exec function a string and sends it to the client
function transpileExec(cmd, ... args) {
    if (/^!$/.test(cmd)) {
        // cmd was "! foo bar", drop the first "!"
        cmd = args.shift();
    } else {
        // strip leading "!"
        cmd = cmd.substring(1);
    }

    return new Promise((resolve, reject) => {
        let opts = {
            shell: true,
            argv0: "(ijavascriptex exec)",
            // stdio: "inherit",
            // timeout: 60000,
        };

        let proc = spawn(cmd, args, opts);

        proc.stdout.on("data", (data) => {
            console.log(`${data}`);
        });

        proc.stderr.on("data", (data) => {
            console.error(`${data}`);
        });

        proc.on("exit", (code) => {
            console.log(`[ process '${cmd}${args.length ? " " : ""}${args.join(" ")}' exited with code ${code} ]`);
            if (code === 0) {
                resolve(code);
            } else {
                reject(code);
            }
        });
    });
}

module.exports = {
    transpileEcho,
    transpileExec,
};
