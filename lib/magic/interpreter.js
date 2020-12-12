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
const origVmRunInThisContext = global.vm.runInThisContext;
function vmMonkeyPatch() {
    global.vm.runInThisContext = function ijavascriptexMonkeyPatch(code, ... args) {
        // if we are re-loading the kernel, we may be executing code before initialization
        if (global.__ijavascriptexInternal.initialized) {
            try {
                return magicInterpreter(code);
            } catch (err) {
                console.error(err.message);
                return undefined;
            }
        }

        return origVmRunInThisContext(code, ... args);
    };

    Object.defineProperty(global, "__ijavascriptexInternal", {
        value: global.__ijavascriptexInternal || {},
        writable: true,
        configurable: true,
        enumerable: false,
    });
    global.__ijavascriptexInternal.$$ = global.$$;
    global.__ijavascriptexInternal.addMagic = addMagic;
    global.__ijavascriptexInternal.initialized = true;
    global.__ijavascriptexInternal.kernelDir = __dirname;
    global.__ijavascriptexInternal.origVmRunInThisContext = origVmRunInThisContext;
}
vmMonkeyPatch();
/* XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX */

/* global $$ */

// our list of commands
let cmdMap = new Map();
global.$$.addMagic = addMagic;

// add our built-ins
const {exec} = require("./builtin");
$$.addMagic("%addmagic", {fn: addMagic});

// Note: history not implemented in protocol
// https://github.com/n-riesco/jp-kernel/blob/0bc2665470bfd2350ef8d0450b4a4c48f865904c/lib/handlers_v5.js#L340
// That's okay, I think we can implement it here just fine
let history = [];

// Magic Interpreter
function magicInterpreter(code) {
    // Split string into lines
    let lines = code.split("\n");
    let codeLines = [];
    let ret;

    // save the command to history
    history.push(code.trimEnd());

    // the $$ global gets rebuilt on every 'execute' call, so we have to reassign it
    // see also: https://github.com/n-riesco/nel/blob/ea42faf8170813b89eadbf00d4696cdd8adbc51b/lib/server/context.js#L322
    global.$$.addMagic = addMagic;

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

                // if there is any code that hasn't been executed, run it now
                ret = runCode(codeLines, ret);

                // run the magic
                ret = runMagic(cmdObj, args, ret);
            }
        }

        // looks like a cell magic but wasn't found
        if (/^%%/.test(args[0]) && !found) {
            throw new TypeError(`UsageError: Cell magic '${args[0]}' not found.`);
        }

        // looks like a line magic but wasn't found
        if (/^%/.test(args[0]) && !found) {
            throw new TypeError(`UsageError: Line magic function '${args[0]}' not found.`);
        }

        // if it's not a magic, it must be code...
        if (!found) {
            codeLines.push(line);
        }
    }

    // if there is still code that hasn't been run, run it now
    ret = runCode(codeLines, ret);

    // Reassemble string and return new code
    return ret;
}

function runMagic(cmdObj, args, ret) {
    // build the 'this' context
    let ctx = {
        exec: exec.bind("(ijavascriptex exec)", "!"),
        cmdMap: cmdMap,
        interpreter: magicInterpreter,
        history: history,
    };

    args = args.map(varSubst);

    // if the return value is a Promise, finish the Promise then run this magic
    if (ret instanceof Promise) {
        return ret.then(() => {
            return cmdObj.fn.call(ctx, ... args);
        });
    }

    // run the magic!
    return cmdObj.fn.call(ctx, ... args);
}

function runCode(codeLines, ret) {
    // make sure there is code to run
    if (!codeLines.length) {
        return ret;
    }

    // re-assemble the array of code lines into a code string
    let code = codeLines.join("\n");

    // clear out / consume the code lines
    codeLines.length = 0;

    // if the return value is a Promise, finish the Promise then run this code
    if (ret instanceof Promise) {
        return ret.then(() => {
            return origVmRunInThisContext(code);
        });
    }

    // run the code!
    return origVmRunInThisContext(code);
}

function varSubst(str) {
    let ret;
    let varOnlyRegExp = /^{(?<varName>[^{}])}$/; // looks like "{var}"
    let varOnly = str.match(varOnlyRegExp);
    if (varOnly) {
        // console.log("varOnly", varOnly);
        ret = eval(`${varOnly.groups.varName}`);
    } else {
        let varMatch = /{[^{}]}/g; // looks like "something{var1}something{var2}{var3}something..."
        ret = str.replace(varMatch, (v) => {
            return `${eval(v)}`;
        });
    }

    return ret;
}

// expects a args like: "%addmagic", "%magic", "functionName"
// or: "%magic", {fn: Function, [matcher: RegExp], [help: String]}
function addMagic(... args) {
    if (args.length === 3 && args[0] === "%addmagic") {
        args.shift();
    }

    if (args.length !== 2) {
        throw new TypeError(`addmagic expected exactly two arguments but got: '${args}'`);
    }

    let cmdName = args[0];
    if (!(/^\W/.test(cmdName))) {
        throw new TypeError(`addmagic expected new command to start with a symbol like '%' or '.' but got '${cmdName}'`);
    }

    // create the object that describes this command
    let cmdObj = {};
    if (typeof args[1] === "string") {
        // TODO: should check that 'fn' exists in the context, otherwise trying to call it later will fail
        cmdObj.fn = eval(args[1]);
    } else if (typeof args[1] === "object") {
        cmdObj = args[1];
    } else {
        throw new TypeError("addmagic expected first argument to be string or object");
    }

    // // check object properties
    if (typeof cmdObj.name !== "string") {
        cmdObj.name = cmdName;
    }

    if (typeof cmdObj.fn !== "function") {
        throw new TypeError(`addmagic expected object '${cmdObj.name}' to have 'fn' property`);
    }

    // if a matcher doesn't already exist create one from cmdName
    if (typeof cmdObj.matcher !== "object" || !(cmdObj.matcher instanceof RegExp)) {
        cmdObj.matcher = new RegExp(`^${cmdName}\\b`);
    }

    // save the magic
    cmdMap.set(cmdName, cmdObj);

    console.log(`[ added magic: '${args[0]}' which will call function '${args[1]}' ]`);
}
