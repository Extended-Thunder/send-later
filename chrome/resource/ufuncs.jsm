var EXPORTED_SYMBOLS = ["sl3uf"];

const Cc = Components.classes, Ci = Components.interfaces;

sl3uf = {
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
        obj = JSON.parse(data);
        return [obj.name, obj.help, obj.body];
    },
    
    export: function(name, help, body, file) {
        // "file" is an nsIFile object
        // Returns nothing
        var obj = {
            version: 1,
            name: name,
            help: help,
            body: body
        };
        var data = JSON.stringify(obj);
        var foStream = Cc["@mozilla.org/network/file-output-stream;1"].
            createInstance(Ci.nsIFileOutputStream);
        foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0); 
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

    directory: function() {
        // Returns an nsIFile for the ufuncs storage directory
        var directoryService =
            Cc["@mozilla.org/file/directory_service;1"].
            getService(Ci.nsIProperties);
        // this is a reference to the profile dir (ProfD) now.
        var localDir = directoryService.get("ProfD", Ci.nsIFile);

        localDir.append("sendlater3");
        if (!localDir.exists() || !localDir.isDirectory()) {
            localDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0774);
        }

        localDir.append("ufuncs");
        if (!localDir.exists() || !localDir.isDirectory()) {
            localDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0774);
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
