module.exports = function(config) {
  config.set({
    singleRun: true,
    frameworks: ["mocha"],
    reporters: ["mocha", "coverage"],
    coverageReporter: {
      dir: "build/coverage",
      reporters: [
        {
          type: "lcov",
          subdir: "lcov"
        },
        {
          type: "html",
          subdir(browser) {
            // normalization process to keep a consistent browser name
            // across different OS
            return browser.toLowerCase().split(/[ /-]/)[0];
          }
        }, {type: "text-summary"}
      ]
    },
    files: [
      "node_modules/sinon/pkg/sinon.js",
      "node_modules/sinon-chrome/bundle/sinon-chrome.min.js",
      "utils/static.js",
      "test/*.test.js"
    ],
    preprocessors: {"utils/static.js": ["coverage"]},
    plugins: [
      "karma-coverage",
      "karma-mocha",
      "karma-mocha-reporter"
    ]
  });
};
