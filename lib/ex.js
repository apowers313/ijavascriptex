const path = require("path");

const {cleanStr, msg, errmsg, varSubst} = require("./util");
const {transpileEcho, transpileExec} = require("./builtin")

// our list of commands
let cmdMap = new Map();
transpileAddCmd("%addcmd", "%addcmd", {fn: transpileAddCmd}); // XXX: %addcmd twice since the first one will get dropped
transpileAddCmd("%load_magic", {fn: transpileLoadMagic});
transpileAddCmd("%echo", {fn: transpileEcho});
transpileAddCmd("!cmd", {
    fn: transpileExec,
    matcher: /^!/,
});

// Magic Interpreter
function exTranspile(kernel, str) {
    // Split string into lines
    let lines = str.split("\n");

    // See if any line is a magic or command
    for(let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let found = false;

        // split the line into arguments
        let args = line.trim().replace(/\s+/g, " ").split(" ");

        // See if string matches command
        for(let cmdObj of cmdMap.values()) {
            if(cmdObj.matcher.test(line)) {
                found = true;

                // Replace string with command function
                if(typeof cmdObj.fn === "function") {
                    let ctx = {
                        exec: transpileExec.bind("(jupyter exec)", "!"),
                        cmdMap: cmdMap,
                        varSubst: varSubst,
                        cleanStr: cleanStr,
                        errmsg: errmsg,
                        msg: msg,
                        kernel: kernel
                    };

                    // built-in commands are a function
                    lines[i] = cmdObj.fn.call(ctx, ... args);
                } else {
                    // added commands are a string with {var} replaced
                    args = args.map(varSubst).join(",");
                    lines[i] = `${cmdObj.fn}(${args});`
                }
            }
        }

        // looks like a cell magic but wasn't found
        if(/^%%/.test(args[0]) && !found) {
            throw new TypeError(`UsageError: Cell magic '${args[0]}' not found.`)
        }

        // looks like a line magic but wasn't found
        if(/^%/.test(args[0]) && !found) {
            throw new TypeError(`UsageError: Line magic function '${args[0]}' not found.`)
        }
    }

    // Reassemble string and return new code
    return lines.join("\n");
}

// expects a args like: "%addcmd", "%magic", "functionName"
// or: "%magic", {fn: Function, [matcher: RegExp], [help: String]}
function transpileAddCmd(... args) {
    if (args[0] === "%addcmd") {
        args.shift();
    }

    if(args.length !== 2) {
        throw new TypeError(`addcmd expected exactly two arguments but got: '${args}'`);
    }

    let cmdName = args[0];
    if(!(/^\W/.test(cmdName))) {
        throw new TypeError(`addcmd expected new command to start with a symbol like '%' or '.' but got '${cmdName}'`)
    }

    // create the object that describes this command
    let cmdObj = {};
    if(typeof args[1] === "string") {
        // TODO: should check that 'fn' exists in the context, otherwise trying to call it later will fail
        cmdObj.fn = args[1];
    } else {
        // TODO: check object properties
        cmdObj = args[1];
    }

    // if a matcher doesn't already exist create one from cmdName
    if(typeof cmdObj.matcher !== "object" || !(cmdObj.matcher instanceof RegExp)) {
        cmdObj.matcher = new RegExp(`^${cmdName}\\b`);
    }

    cmdMap.set(cmdName, cmdObj);

    return msg(`[ added command: '${args[0]}' which will call function '${args[1]}' ]`);
}

function transpileLoadMagic(... args) {
    if (args.length === 3 && args[0] === "%load") {
        args.shift();
    }

    if(args.length !== 2) {
        throw new TypeError(`load expected exactly one arguments but got: '${args}'`);
    }

    let instructionList;
    let mod = args[1];
    if (mod[0] === ".") {
        mod = path.join(process.cwd(), args[1]);
    }

    try {
        instructionList = require(mod);
    } catch(err) {
        console.error(err);
        throw new TypeError("couldn't load module: " + err.message);
    }

    // instructionList should be array
    if(!Array.isArray(instructionList)) {
        throw new TypeError(`load expected module to export an array of instructions, got: '${instructionList}'`);
    }

    for(let inst of instructionList) {
        switch(inst.cmd) {
            case "add":
                transpileAddCmd(inst.name, inst);
                break;
            default: throw new TypeError(`load: unknown command: '${inst.cmd}' in object ${inst}`);
        }
    }

    return msg(`[ load complete: ${instructionList.length} instructions performed ]`);
}

module.exports = exTranspile;