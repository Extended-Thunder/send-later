var EXPORTED_SYMBOLS = ["SLModule"];

var SLModule = {
    value : 0,
    saveDraft: function() {
        console.log("TRYING TO SAVE!!!");
        return this.getValue();
    },
    incValue: function() {
        this.value++;
    },
    getValue: function() {
        return 899; //this.value;
    },
};

console.log("Loading SLModule.jsm");