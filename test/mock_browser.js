global.browser = {
  storage: {
    local: {
      async get(key) {
        ret = {};
        ret[key] = { foo: "bar" };
        return ret;
      },
      async set (item) {
        return item;
      }
    }
  },
  i18n: {
    getMessage(key, ...args) {
      const msg = global.localeMessages[key].message;
      return msg.replace(/\$\d/g, (i) => args[--i[1]] );
    }
  }
};

const fs = require('fs'),
      path = require('path'),
      filePath = path.join(__dirname, '..', '_locales','en','messages.json');;
const contents = fs.readFileSync(filePath, {encoding: 'utf-8'});
global.localeMessages = JSON.parse(contents);
