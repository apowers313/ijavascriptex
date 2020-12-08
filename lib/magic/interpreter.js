/*
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

8b        d8  8b        d8  8b        d8
 Y8,    ,8P    Y8,    ,8P    Y8,    ,8P
  `8b  d8'      `8b  d8'      `8b  d8'
    Y88P          Y88P          Y88P
    d88b          d88b          d88b
  ,8P  Y8,      ,8P  Y8,      ,8P  Y8,
 d8'    `8b    d8'    `8b    d8'    `8b
8P        Y8  8P        Y8  8P        Y8

XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

This monkey patches vm.runInThisContext with our own interpreter.
*/
function vmMonkeyPatch() {
    const origVmRunInThisContext = global.vm.runInThisContext;
    global.vm.runInThisContext = function ijavascriptexMonkeyPatch(code, ... args) {
        // if we are re-loading the kernel, we may be executing code before
        // kernelDir path has been set
        const {kernelDir} = global.__ijavascriptexInternal;
        if (kernelDir) {
            // yep, we load modules for every code execution
            // don't worry, module caching makes the performance
            // impact negligable
            code = magicInterpreter(code);
        }

        return origVmRunInThisContext(code, ... args);
    };

    Object.defineProperty(global, "__ijavascriptexInternal", {
        value: global.__ijavascriptexInternal || {},
        writable: true,
        configurable: true,
        enumerable: false,
    });

    global.__ijavascriptexInternal.initialized = true;
    global.__ijavascriptexInternal.kernelDir = __dirname;
    global.__ijavascriptexInternal.origVmRunInThisContext = origVmRunInThisContext;
}
vmMonkeyPatch();
/* XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX */

const path = require("path");
const {echo, exec} = require("./builtin");

// our list of commands
let cmdMap = new Map();
addCmd("%addcmd", "%addcmd", {fn: addCmd}); // XXX: %addcmd twice since the first one will get dropped
addCmd("%load_magic", {fn: loadMagic});
addCmd("%echo", {fn: echo});
addCmd("!cmd", {
    fn: exec,
    matcher: /^!/,
});

// Magic Interpreter
function magicInterpreter(str) {
    // Split string into lines
    let lines = str.split("\n");
    let outputLines = [];

    // See if any line is a magic or command
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let found = false;

        // split the line into arguments
        let args = line.trim().replace(/\s+/g, " ").split(" ");

        // See if string matches a magic command
        for (let cmdObj of cmdMap.values()) {
            if (cmdObj.matcher.test(line)) {
                found = true;

                let ctx = {
                    exec: exec.bind("(jupyter exec)", "!"),
                    cmdMap: cmdMap,
                };

                // built-in commands are a function, may return a promise
                try {
                    lines[i] = cmdObj.fn.call(ctx, ... args);
                } catch (err) {
                    console.error(err.message);
                    return "";
                }
            }
        }

        // looks like a cell magic but wasn't found
        if (/^%%/.test(args[0]) && !found) {
            console.error(`UsageError: Cell magic '${args[0]}' not found.`);
            return "";
        }

        // looks like a line magic but wasn't found
        if (/^%/.test(args[0]) && !found) {
            console.error(`UsageError: Line magic function '${args[0]}' not found.`);
            return "";
        }

        if (!found) {
            outputLines.push(line);
        }
    }

    // Reassemble string and return new code
    return outputLines.join("\n");
}

// expects a args like: "%addcmd", "%magic", "functionName"
// or: "%magic", {fn: Function, [matcher: RegExp], [help: String]}
function addCmd(... args) {
    if (args[0] === "%addcmd") {
        args.shift();
    }

    if (args.length !== 2) {
        throw new TypeError(`addcmd expected exactly two arguments but got: '${args}'`);
    }

    let cmdName = args[0];
    if (!(/^\W/.test(cmdName))) {
        throw new TypeError(`addcmd expected new command to start with a symbol like '%' or '.' but got '${cmdName}'`);
    }

    // create the object that describes this command
    let cmdObj = {};
    if (typeof cmdObj === "string") {
        // TODO: should check that 'fn' exists in the context, otherwise trying to call it later will fail
        cmdObj.fn = args[1];
    } else if (typeof cmdObj === "object") {
        cmdObj = args[1];

        // // check object properties
        if (typeof cmdObj.name !== "string") {
            cmdObj.name = cmdName;
        }

        if (typeof cmdObj.fn !== "function") {
            throw new TypeError(`addcmd expected object '${cmdObj.name}' to have 'fn' property`);
        }
    } else {
        throw new TypeError("addcmd expected first argument to be string or object");
    }

    // if a matcher doesn't already exist create one from cmdName
    if (typeof cmdObj.matcher !== "object" || !(cmdObj.matcher instanceof RegExp)) {
        cmdObj.matcher = new RegExp(`^${cmdName}\\b`);
    }

    cmdMap.set(cmdName, cmdObj);

    console.log(`[ added command: '${args[0]}' which will call function '${args[1]}' ]`);
}

function loadMagic(... args) {
    if (args.length === 3 && args[0] === "%load") {
        args.shift();
    }

    if (args.length !== 2) {
        throw new TypeError(`load expected exactly one arguments but got: '${args}'`);
    }

    let instructionList;
    let mod = args[1];
    if (mod[0] === ".") {
        mod = path.join(process.cwd(), args[1]);
    }

    try {
        instructionList = require(mod);
    } catch (err) {
        console.error(err);
        throw new TypeError(`couldn't load module: ${err.message}`);
    }

    // instructionList should be array
    if (!Array.isArray(instructionList)) {
        throw new TypeError(`load expected module to export an array of instructions, got: '${instructionList}'`);
    }

    for (let inst of instructionList) {
        switch (inst.cmd) {
        case "add":
            addCmd(inst.name, inst);
            break;
        default: throw new TypeError(`load: unknown command: '${inst.cmd}' in object ${inst}`);
        }
    }

    console.log(`[ load complete: ${instructionList.length} instructions performed ]`);
}
