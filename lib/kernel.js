#!/usr/bin/env node

/*
 * BSD 3-Clause License
 *
 * Copyright (c) 2015, Nicolas Riesco and others as credited in the AUTHORS file
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

var console = require("console");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var Kernel = require("jp-kernel");


// Parse command arguments
var config = parseCommandArguments();


// Setup logging helpers
var log;
var dontLog = function dontLog() {};
var doLog = function doLog() {
    process.stderr.write("KERNEL: ");
    console.error.apply(this, arguments);
};

if (process.env.DEBUG) {
    global.DEBUG = true;

    try {
        doLog = require("debug")("KERNEL:");
    } catch (err) {}
}

log = global.DEBUG ? doLog : dontLog;

// Setup transpiler
config.transpile = function transpile(code) {
    return replaceCmds(code);
};

// Command Interpreter
function replaceCmds(str) {
    // Split string into lines
    let lines = str.split("\n");

    // See if any line is a magic or command
    for(let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // See if string matches command
        for(let cmd of cmdMap.entries()) {
            let cmdRegExp = cmd[0];
            let cmdFn = cmd[1];
            if(cmdRegExp.test(line)) {
                // split the line into arguments
                args = line.trim().replace(/\s+/g, " ").split(" ");

                // TODO: do variable substitution of {var} in string

                // Replace string with command function
                if(typeof cmdFn === "function") {
                    // built-in commands are a function
                    lines[i] = cmdFn(... args);
                } else {
                    // added commands are a string
                    args = args.map((arg) => `"${arg}"`).join(",");
                    lines[i] = `${cmdFn}(${args});`
                }
            }
        }
    }

    // Reassemble string and return new code
    return lines.join("\n");
}

// our list of commands
let cmdMap = new Map([
    [/^%echo\b/, echo],
    [/^%addcmd\b/, addCmd],
    [/^!/, insertExec]
]);

// prints anything passed to it
function echo(cmd, ... args) {
    // escape " and \ in str
    let str = args.join(" ");
    str = str.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");

    return `console.log("${str}");`
}

// expects a string like "%magic functionName"
function addCmd(cmd, ... args) {
    if(args.length !== 2) {
        return `console.error("addcmd expected exactly two arguments but got: '${args}'");`;
    }

    let cmdName = args[0];
    if(!(/^\W/.test(cmdName))) {
        return `console.error("addcmd expected new command to start with a symbol like '%' or '.' but got '${cmdName}'");`;
    }
    let matcher = new RegExp(`^${cmdName}\\b`);
    let fn = args[1];

    // TODO: should check that 'fn' exists in the context, otherwise trying to call it later will fail

    cmdMap.set(matcher, fn);

    return (`console.log("added command: '${args[0]}' which will call function '${args[1]}'");`);
}

// converts the __jupyter_sh_exec function a string and sends it to the client
function insertExec(cmd, ... args) {
    // TODO: check to see if this is being called by a npm module (and disallow)
    if(/^!$/.test(cmd)) {
        // cmd was "! foo bar", drop the first "!"
        cmd = args.shift();
    } else {
        // strip leading "!"
        cmd = cmd.substring(1);
    }

    let ret = __jupyter_sh_exec.toString() + "\n";
    args = args.map((arg) => `"${arg}"`).join(",");
    ret += `__jupyter_sh_exec("(jupyter)", "${cmd}"${args.length>0?", ":""}${args});`
    return ret;
}

// run a shell command
function __jupyter_sh_exec(argv0, cmd, ... args) {
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
            console.log(`[ process '${cmd} ${args.join(" ")}' exited with code ${code} ]`);
            if(code === 0) {
                resolve(code);
            } else {
                reject(code);
            }
        });
    });
}

// Start kernel
var kernel = new Kernel(config);

// WORKAROUND: Fixes https://github.com/n-riesco/ijavascript/issues/97
kernel.handlers.is_complete_request = function is_complete_request(request) {
    request.respond(this.iopubSocket, "status", {
        execution_state: "busy"
    });

    var content;
    try {
        new vm.Script(kernel.session.transpile(request.content.code));
        content = {
            status: "complete",
        };
    } catch (err) {
        content = {
            status: "incomplete",
            indent: "",
        };
    }

    request.respond(
        this.shellSocket,
        "is_complete_reply",
        content,
        {},
        this.protocolVersion
    );

    request.respond(this.iopubSocket, "status", {
        execution_state: "idle"
    });
};

// Interpret a SIGINT signal as a request to interrupt the kernel
process.on("SIGINT", function() {
    log("Interrupting kernel");
    kernel.restart(); // TODO(NR) Implement kernel interruption
});


/**
 * Parse command arguments
 *
 * @returns {module:jp-kernel~Config} Kernel config
 */
function parseCommandArguments() {
    var config = {
        cwd: process.cwd(),
        hideExecutionResult: false,
        hideUndefined: false,
        protocolVersion: "5.1",
        startupCallback: function() {
            log("startupCallback:", this.startupCallback);
        },
    };

    var usage = (
        "Usage: node kernel.js " +
        "[--debug] " +
        "[--hide-execution-result] " +
        "[--hide-undefined] " +
        "[--protocol=Major[.minor[.patch]]] " +
        "[--session-working-dir=path] " +
        "[--show-undefined] " +
        "[--startup-script=path] " +
        "connection_file"
    );

    var FLAGS = [
        ["--debug", function() {
            config.debug = true;
        }],
        ["--hide-execution-result", function() {
            config.hideExecutionResult = true;
        }],
        ["--hide-undefined", function() {
            config.hideUndefined = true;
        }],
        ["--protocol=", function(setting) {
            config.protocolVersion = setting;
        }],
        ["--session-working-dir=", function(setting) {
            config.cwd = setting;
        }],
        ["--show-undefined", function() {
            config.hideUndefined = false;
        }],
        ["--startup-script=", function(setting) {
            config.startupScript = setting;
        }],
    ];

    try {
        var connectionFile;

        process.argv.slice(2).forEach(function(arg) {
            for (var i = 0; i < FLAGS.length; i++) {
                var flag = FLAGS[i];
                var label = flag[0];
                var action = flag[1];

                var matchesFlag = (arg.indexOf(label) === 0);
                if (matchesFlag) {
                    var setting = arg.slice(label.length);
                    action(setting);
                    return;
                }
            }

            if (connectionFile) {
                throw new Error("Error: too many arguments");
            }

            connectionFile = arg;
        });

        if (!connectionFile) {
            throw new Error("Error: missing connection_file");
        }

        config.connection = JSON.parse(fs.readFileSync(connectionFile));

    } catch (e) {
        console.error("KERNEL: ARGV:", process.argv);
        console.error(usage);
        throw e;
    }

    var nodeVersion;
    var protocolVersion;
    var ijsVersion;
    var majorVersion = parseInt(config.protocolVersion.split(".")[0]);
    if (majorVersion <= 4) {
        nodeVersion = process.versions.node.split(".")
            .map(function(v) {
                return parseInt(v, 10);
            });
        protocolVersion = config.protocolVersion.split(".")
            .map(function(v) {
                return parseInt(v, 10);
            });
        config.kernelInfoReply = {
            "language": "javascript",
            "language_version": nodeVersion,
            "protocol_version": protocolVersion,
        };
    } else {
        nodeVersion = process.versions.node;
        protocolVersion = config.protocolVersion;
        ijsVersion = JSON.parse(
            fs.readFileSync(path.join(__dirname, "..", "package.json"))
        ).version;
        config.kernelInfoReply = {
            "protocol_version": protocolVersion,
            "implementation": "ijavascriptex",
            "implementation_version": ijsVersion,
            "language_info": {
                "name": "javascript",
                "version": nodeVersion,
                "mimetype": "application/javascript",
                "file_extension": ".js",
            },
            "banner": (
                "IJavascriptEX v" + ijsVersion + "\n" +
                "https://github.com/apowers313/ijavascriptex\n"
            ),
            "help_links": [{
                "text": "IJavascript Homepage",
                "url": "https://github.com/apowers313/ijavascriptex",
            }],
        };
    }

    return config;
}
