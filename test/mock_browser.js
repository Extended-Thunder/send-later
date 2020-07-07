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
      return key + args.join(" ");
    }
  }
};
