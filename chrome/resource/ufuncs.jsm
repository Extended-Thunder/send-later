var EXPORTED_SYMBOLS = ["list", "load", "save", "remove", "exists", "_import",
                        "_export", "call", "callByName", "nameOk", "bodyOk",
                        "parseArgs", "unparseArgs", "directory", "file"];

const Cc = Components.classes, Ci = Components.interfaces;

// Compatibility with before Thunderbird 17. Ugh.
if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(searchString, position) {
      var subjectString = this.toString();
      if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
        position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
  };
}

function list() {
    // Return sorted array of function names
    var entries = directory().directoryEntries;
    var array = [];
    while (entries.hasMoreElements()) {
        var entry = entries.getNext();
        entry.QueryInterface(Ci.nsIFile);
        if (entry.leafName.endsWith(".slj")) {
            array.push(entry.leafName.slice(0, -4));
        }
    }
    return array.sort();
};

function load(name) {
    // Returns [name, help, body]
    var file = directory();
    file.append(name + ".slj");
    return _import(file);
};

function save(name, help, body) {
    // Returns nothing
    var fh = file(name);
    _export(name, help, body, fh);
};

function remove(name) {
    // Returns nothing
    var fh = file(name);
    fh.remove(false);
};

function exists(name) {
    // Returns true or false
    return file(name).exists();
};

function _import(file) {
    // "file" is an nsIFile object
    // Returns [name, help, body]
    var data = "";
    var fstream = Cc["@mozilla.org/network/file-input-stream;1"].
        createInstance(Ci.nsIFileInputStream);
    var cstream = Cc["@mozilla.org/intl/converter-input-stream;1"].
        createInstance(Ci.nsIConverterInputStream);
    fstream.init(file, -1, 0, 0);
    cstream.init(fstream, "UTF-8", 0, 0);

    var read = 1;
    while (read != 0) {
        var str = {};
        read = cstream.readString(0xffffffff, str);
        data += str.value;
    }
    cstream.close();
    data = data.replace(/\s+$/, "");
    if (! data.match(/"version":1,/)) {
        data = data.replace(/\n/g, "\\n");
    }
    var obj = JSON.parse(data.replace(/\n/g, "\\n"));
    return [obj.name, obj.help, obj.body];
};

function _export(name, help, body, file) {
    // "file" is an nsIFile object
    // Returns nothing
    var obj = {
        version: 2,
        name: name,
        help: help,
        body: body
    };
    var data = JSON.stringify(obj).replace(/\\n/g, "\n");
    var foStream = Cc["@mozilla.org/network/file-output-stream;1"].
        createInstance(Ci.nsIFileOutputStream);
    foStream.init(file, 0x02 | 0x08 | 0x20, 0o666, 0); 
    var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].
        createInstance(Ci.nsIConverterOutputStream);
    converter.init(foStream, "UTF-8", 0, 0);
    converter.writeString(data);
    converter.close();
};

function call(name, body, time, args) {
    body = "var next, nextspec, nextargs;" + body +
        "; return([next, nextspec, nextargs]);"
    var f = Function.apply(null, ["specname", "prev", "args", body]);
    var next, nextspec, nextargs;
    [next, nextspec, nextargs] = f("ufunc:" + name, time, args);
    if (! nextspec)
        return next;
    if (! nextargs)
        return [next, nextspec];
    nextargs.splice(0, 0, next, nextspec);
    return nextargs;
};

function callByName(name, time, args) {
    // Returns whatever the function returns
    var help, body;
    [name, help, body] = load(name);
    return call(name, body, time, args);
};

function nameOk(name) {
    // Returns true or false
    return /^\w+$/.test(name);
};

function bodyOk(body) {
    // Returns true or false
    try {
        return !!Function.apply(null, ["specname", "prev", "args", body]);
    } catch (ex) {
        return false;
    }
};

function parseArgs(argstring) {
    if (argstring === "")
        return [];
    try {
        var args = JSON.parse("[" + argstring + "]");
        unparseArgs(args); // throws exception on bad args
        return args;
    }
    catch (ex) {
        return false;
    }
};

function unparseArgs(args) {
    // Convert a list into its string representation, WITHOUT the square
    // braces around the entire list.
    //
    // We stringify the individual elements of the list and then join them
    // because we want spaces after the commas for readability, and JSON.
    // stringify won't do that, and when you try to make it do that by
    // specifying its "space" argument, it inserts newlines as well, which
    // we obviously don't want.
    if (! args.length)
        return "";
    var arglist = [];
    for (var i in args) {
        var val = args[i];
        if (val && val.splice)
            arglist.push('[' + unparseArgs(val) + ']');
        else if (! (/^(?:number|boolean|string)$/.test(typeof(val)) ||
                    val === null))
            throw new Error("Function arguments can only contain arrays " +
                            "numbers, booleans, strings, and null.");
        arglist.push(JSON.stringify(val));
    }
    return arglist.join(', ');
};

function directory() {
    // Returns an nsIFile for the ufuncs storage directory
    var directoryService =
        Cc["@mozilla.org/file/directory_service;1"].
        getService(Ci.nsIProperties);
    // this is a reference to the profile dir (ProfD) now.
    var localDir = directoryService.get("ProfD", Ci.nsIFile);

    localDir.append("sendlater3");
    if (!localDir.exists() || !localDir.isDirectory()) {
        localDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o774);
    }

    localDir.append("ufuncs");
    if (!localDir.exists() || !localDir.isDirectory()) {
        localDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o774);
    }

    return localDir;
};

function file(name) {
    // Returns an nsIFile for a ufunc file within the storage directory
    var file = directory();
    file.append(name + ".slj");
    return file;
};
