var EXPORTED_SYMBOLS = ["sl3uf"];

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

function octal(num) {
    // Takes an integer and returns the value of that integer as if its base-10
    // digits were actually base-8 digits.
    // For example, an input of 10 will return the base-10 value 8.
    // This is a helper function to cope with the fact that versions of
    // Thunderbird prior to 25 didn't support the 0o syntax, and I want to
    // support back to Thunderbird 20. We can just get rid of this and Use 0o
    // syntax directly once we're only supporting Thunderbird 25 or newer.
    return parseInt(String(num), 8);
}

var sl3uf = {
    list: function() {
        // Return sorted array of function names
        var entries = this.directory().directoryEntries;
        var array = [];
        while (entries.hasMoreElements()) {
            var entry = entries.getNext();
            entry.QueryInterface(Ci.nsIFile);
            if (entry.leafName.endsWith(".slj")) {
                array.push(entry.leafName.slice(0, -4));
            }
        }
        return array.sort();
    },

    load: function(name) {
        // Returns [name, help, body]
        var file = this.directory();
        file.append(name + ".slj");
        return this.import(file);
    },

    save: function(name, help, body) {
        // Returns nothing
        var file = this.file(name);
        this.export(name, help, body, file);
    },

    remove: function(name) {
        // Returns nothing
        var file = this.file(name);
        file.remove(false);
    },

    exists: function(name) {
        // Returns true or false
        return this.file(name).exists();
    },

    import: function(file) {
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
    },
    
    export: function(name, help, body, file) {
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
        foStream.init(file, 0x02 | 0x08 | 0x20, octal(666), 0); 
        var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].
            createInstance(Ci.nsIConverterOutputStream);
        converter.init(foStream, "UTF-8", 0, 0);
        converter.writeString(data);
        converter.close();
    },

    call: function(name, body, time, args) {
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
    },

    callByName: function(name, time, args) {
        // Returns whatever the function returns
        var help, body;
        [name, help, body] = this.load(name);
        return this.call(name, body, time, args);
    },

    nameOk: function(name) {
        // Returns true or false
        return /^\w+$/.test(name);
    },

    bodyOk: function(body) {
        // Returns true or false
        try {
            return !!Function.apply(null, ["specname", "prev", "args", body]);
        } catch (ex) {
            return false;
        }
    },

    parseArgs: function(argstring) {
        if (argstring === "")
            return [];
        try {
            var args = JSON.parse("[" + argstring + "]");
            this.unparseArgs(args); // throws exception on bad args
            return args;
        }
        catch (ex) {
            return false;
        }
    },

    unparseArgs: function(args) {
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
                arglist.push('[' + this.unparseArgs(val) + ']');
            else if (! (/^(?:number|boolean|string)$/.test(typeof(val)) ||
                        val === null))
                throw new Error("Function arguments can only contain arrays " +
                                "numbers, booleans, strings, and null.");
            arglist.push(JSON.stringify(val));
        }
        return arglist.join(', ');
    },

    directory: function() {
        // Returns an nsIFile for the ufuncs storage directory
        var directoryService =
            Cc["@mozilla.org/file/directory_service;1"].
            getService(Ci.nsIProperties);
        // this is a reference to the profile dir (ProfD) now.
        var localDir = directoryService.get("ProfD", Ci.nsIFile);

        localDir.append("sendlater3");
        if (!localDir.exists() || !localDir.isDirectory()) {
            localDir.create(Ci.nsIFile.DIRECTORY_TYPE, octal(774));
        }

        localDir.append("ufuncs");
        if (!localDir.exists() || !localDir.isDirectory()) {
            localDir.create(Ci.nsIFile.DIRECTORY_TYPE, octal(774));
        }

        return localDir;
    },

    file: function(name) {
        // Returns an nsIFile for a ufunc file within the storage directory
        var file = this.directory();
        file.append(name + ".slj");
        return file;
    }
};
