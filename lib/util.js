function cleanStr(str) {
    return str
        .replace(/\\/g, "\\\\")
        .replace(/"/g, "\\\"")
        .replace(/\n/g, "\\n");
}

function msg(str) {
    str = cleanStr(str);
    return `console.log("${str}");`;
}

function errmsg(str) {
    str = cleanStr(str);
    return `console.error("${str}");`;
}

function varSubst(str) {
    let ret;
    let varOnlyRegExp = /^{(?<varName>[^{}])}$/; // looks like "{var}"
    let varOnly = str.match(varOnlyRegExp);
    if (varOnly) {
        // console.log("varOnly", varOnly);
        ret = `eval("${varOnly.groups.varName}")`;
    } else {
        let varMatch = /{[^{}]}/g; // looks like "something{var1}something{var2}{var3}something..."
        ret = str.replace(varMatch, (v) => `$${v}`);
        ret = `\`${ret}\``;
    }

    return ret;
}

function fnCallToScript(fn, ... args) {
    // copy over the function code
    let ret = fn.toString() + "\n\n";

    // convert the args to a string
    args = args.map((arg) => varSubst(arg)).join(",");

    // TODO: maybe we could find a way of adding the function to some other scope or hiding it in an object?
    // for now, just warn if we don't like the way the function is named
    if(!(/^__ijavascriptex_/.test(fn.name))) {
        console.log(`WARNING: while calling '${fn.name}': function name doesn't start with '__ijavascriptex_', which may pollute the global symbol table`);
    }

    // create a string that calls the function
    ret += `${fn.name}(${args});\n\n`;

    return ret;
}

module.exports = {
    cleanStr,
    msg,
    errmsg,
    varSubst,
    fnCallToScript,
};