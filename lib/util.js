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

module.exports = {
    cleanStr,
    msg,
    errmsg,
    varSubst,
};