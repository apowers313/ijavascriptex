const {cleanStr, msg, errmsg, varSubst} = require("./util");

// prints anything passed to it
function transpileEcho(cmd, ... args) {
    let str = args.map(varSubst).join(",");
    return `console.log(${str});`
}

// converts the __ijavascriptex_sh_exec function a string and sends it to the client
function transpileExec(cmd, ... args) {
    if(/^!$/.test(cmd)) {
        // cmd was "! foo bar", drop the first "!"
        cmd = args.shift();
    } else {
        // strip leading "!"
        cmd = cmd.substring(1);
    }

    let ret = __ijavascriptex_sh_exec.toString() + "\n";
    args = args.map((arg) => `"${arg}"`).join(",");
    ret += `__ijavascriptex_sh_exec("(jupyter)", "${cmd}"${args.length>0?", ":""}${args});`
    return ret;
}

// run a shell command
function __ijavascriptex_sh_exec(argv0, cmd, ... args) {
    return new Promise((resolve, reject) => {
        const {spawn} = require("child_process");

        let opts = {
            shell: true,
            argv0: argv0,
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
            console.log(`[ process '${cmd}${args.length?" ":""}${args.join(" ")}' exited with code ${code} ]`);
            if(code === 0) {
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
}