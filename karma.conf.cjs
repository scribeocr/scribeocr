// Karma configuration
// Generated on Mon Jul 29 2024 13:28:28 GMT-0700 (Pacific Daylight Time)

module.exports = function (config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://www.npmjs.com/search?q=keywords:karma-adapter
    frameworks: ['mocha'],

    // list of files / patterns to load in the browser
    files: [
      { pattern: 'tests/module/*spec.js', type: 'module' },
      // Non-test files are not served by default, even if referenced in the test files.
      // Using '**/*' or 'scribe-ui/**' causes OOM, so list patterns explicitly.
      { pattern: 'node_modules/chai/*', included: false, served: true },
      { pattern: 'tests/**', included: false, served: true },
      { pattern: 'app/**', included: false, served: true },
      // scribe-ui viewer and supporting JS
      { pattern: 'scribe-ui/*.js', included: false, served: true },
      { pattern: 'scribe-ui/js/**', included: false, served: true },
      // scribe.js core
      { pattern: 'scribe-ui/scribe.js/scribe.js', included: false, served: true },
      { pattern: 'scribe-ui/scribe.js/js/**', included: false, served: true },
      { pattern: 'scribe-ui/scribe.js/lib/**', included: false, served: true },
      { pattern: 'scribe-ui/scribe.js/fonts/**', included: false, served: true },
      { pattern: 'scribe-ui/scribe.js/mupdf/**', included: false, served: true },
      { pattern: 'scribe-ui/scribe.js/tests/assets/**', included: false, served: true },
      { pattern: 'scribe-ui/scribe.js/tesseract.js/src/**', included: false, served: true },
      { pattern: 'scribe-ui/scribe.js/tesseract.js/package.json', included: false, served: true },
    ],

    // list of files / patterns to exclude
    exclude: [
    ],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://www.npmjs.com/search?q=keywords:karma-preprocessor
    preprocessors: {
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://www.npmjs.com/search?q=keywords:karma-reporter
    reporters: ['mocha'],

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,

    // start these browsers
    // available browser launchers: https://www.npmjs.com/search?q=keywords:karma-launcher
    browsers: [process.env.KARMA_BROWSER || 'ChromeHeadless'],

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // Concurrency level
    // how many browser instances should be started simultaneously
    concurrency: Infinity,
  });
};
