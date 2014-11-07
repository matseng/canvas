// https://blog.codecentric.de/en/2014/02/cross-platform-javascript/
// https://github.com/basti1302/browserify-grunt-mocha-template/blob/master/Gruntfile.js

'use strict';
 
module.exports = function(grunt) {
 
  // configure grunt
  grunt.initConfig({
 
    pkg: grunt.file.readJSON('package.json'),

    jshint: {
      files: [
        'src/**/*.js',
        '!node_modules/**/*',
        '!browser/dist/**/*',
        '!browser/test/**/*', 
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },

    browserify: {
      js: {
        src: [ 'src/main/*.js' ],
        dest: './dist/bundle.js',
        options: {
          browserifyOptions: {
            debug: true
          }
        }
      },

      tests: {
        src: [ 'src/**/tests/spec/*.js' ],
        dest: './dist/bundleTests.js',
        options: {
          external: [ './<%= pkg.name %>.js' ],
          // Embed source map for tests
          debug: true
        }
      },
    },

    mochaTest: {
      test: {
        options: {
          reporter: 'spec'
        },
        src: ['src/**/tests/**/*.js']
      }
    },

    watch: {
      files: ['<%= jshint.files %>'],
      tasks: ['default']
    },

  });
 
  // Load plug-ins
  // grunt.loadNpmTasks('grunt-contrib-whatever');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // define tasks
  grunt.registerTask('default', [
    // 'jshint',
    'browserify:js',
    // 'mochaTest',
  ]);

  // grunt.registerTask('watch', ['watch']);

};



// module.exports = function (grunt) {

//     mountFolder = function(connect,dir) {
//         return connect.static(require('path').resolve(dir));
//     };

//     grunt.initConfig({
//         pkg: grunt.file.readJSON('package.json'),
//         build_directory: './dist',

//         clean: {
//             preprocess: ["dist/*", "lib/<%= pkg.name %>.js", "dev"],
//             postprocess: ["lib/<%= pkg.name %>.js"]
//         },
//         jshint: {
//             all: ['Gruntfile.js', 'dist/<%= pkg.name %>.js', 'test/spec/*.js'],
//             options: {
//                 indent : 4,
//                 browser: true,
//                 // reporter: 'checkstyle',
//                 // reporterOutput: 'out/report.xml'
//             }
//         },
//         uglify: {
//           sugr: {
//             files: {
//             'dist/<%= pkg.name %>.min.js': ['dist/<%= pkg.name %>.js']
//             }
//           },
//           creative: {
//             files: {
//             'dist/creative.min.js': ['dist/creative.js']
//             }
//           }
//         },
//         removelogging: {
//           dist: {
//             src: "dist/<%= pkg.name %>.js" // Each file will be overwritten with the output!
//           }
//         },
//         coffee: {
//             compile: {
//                 options: {
//                     join: true,
//                     bare: true
//                 },
//                 files: {
//                   'lib/<%= pkg.name %>.js': ['src/<%= pkg.name %>.coffee']
//                 }
//             },
//             tests: {
//                 options: {
//                 },
//                 files: {
//                   'dev/test/sugrSpec.js': ['test/spec/sugrSpec.coffee']
//                 }
//             }
//         },

//         concat: {
//             sugr: {
//                 src: [ 'src/support/global.js',
//                        'src/sugr/sugr.js',
//                        'src/support/sugr.debug.js',
//                        'src/networking/sugr.networking.js',
//                        'src/notification/sugr.notification.js',
//                        'src/parser/sugr.parser.js',
//                        // 'src/player/sugr.player.js', // removing player to focus on pure VPAID support
//                        'src/support/sugr.support.vast.js',
//                        'src/tracking/sugr.tracking.js',
//                        'src/vpaid/sugr.vpaid.js',
//                        'src/mraid/sugr.mraid.js',
//                        'src/runtime/sugr.runtime.js' ],
//                 dest: 'dist/<%= pkg.name %>.js'
//             },
//             creative: {
//                 src: [ 'src/support/global.js',
//                        'src/sugr/sugr.js',
//                        'src/support/sugr.debug.js',
//                        'src/networking/sugr.networking.js',
//                        'src/notification/sugr.notification.js',
//                        'src/parser/sugr.parser.js',
//                        // 'src/player/sugr.player.js', // removing player to focus on pure VPAID support
//                        'src/support/sugr.support.vast.js',
//                        'src/tracking/sugr.tracking.js',
//                        'src/vpaid/sugr.vpaid.js',
//                        'src/vpaid/units/SocialDock-AA.js',  // choose unit here
//                        // 'src/vpaid/units/SocialDock.js',
//                        'src/runtime/sugr.runtime.js' ],
//                 dest: 'dist/creative.js'
//             },
//             tests: {
//               // src: ['lib/networking/tests/spec/networkingSpec.js', 'dev/test/sugrSpec.js'],
//               // src: ['lib/**/**/**/*Spec.js', 'dev/test/sugrSpec.js'],
//               src: ['src/notification/tests/**/*Spec.js', 'src/networking/tests/**/*Spec.js', 'src/parser/tests/**/*Spec.js', 'src/tracking/tests/**/*Spec.js', 'src/support/tests/**/*Spec.js'],
//               // src: ['lib/networking/tests/spec/networkingSpec.js'],
//               // src: ['lib/VASTParser/tests/spec/appSpec.js'],

//               dest: 'dev/test/<%= pkg.name %>Concat.js'
//             }
//         },

//         watch2: {
//             options: {
//                 livereload: true,
//                 interrupt: true
//             },
//             sugr: {
//               files: 'src/**/*',
//               tasks: 'test'
//             },
//             lib: {
//               files: ['lib/**/VASTParser.js', 'lib/**/networking.js'],
//               // files: 'lib/**/*.js',
//               tasks: 'test'
//             },
//             test: {
//               files: ['test/**/*', 'lib/**/**/**/*Spec.js'],
//               tasks: 'test'
//             },
//             units: {
//               files: ['src/**/**/*.js', 'Gruntfile.js'],
//               tasks: 'dev'
//             }
//         },

//         blanket_mocha: {
//           all: {
//             src: ['test/testrunner.html'],
//           },
//           jenkins: {
//             options: {
//                 reporter: 'mocha-jenkins-reporter'
//             },
//             src: ['test/testrunner.html']
//           },
//           options: {
//             reporter: 'Spec',
//             // threshold : 75,
//             threshold : 5,
//             logErrors: true,
//             run: true,
//             log : true
//           }
//         },

//         connect: {
//             dev: {
//                 options: {
//                     port: 8090,
//                     hostname: '*',
//                     base: '.',
//                     keepalive: true,
//                     middleware: function(connect) {
//                         return [
//                             mountFolder(connect, '.')
//                         ];
//                     }
//                 }
//             }
//         }

//     });

//     grunt.loadNpmTasks('grunt-contrib-concat');
//     grunt.loadNpmTasks('grunt-contrib-coffee');
//     grunt.loadNpmTasks('grunt-contrib-clean');
//     grunt.loadNpmTasks('grunt-contrib-watch');
//     grunt.loadNpmTasks('grunt-blanket-mocha');
//     grunt.loadNpmTasks('grunt-contrib-connect');
//     grunt.loadNpmTasks('grunt-contrib-uglify');
//     grunt.loadNpmTasks("grunt-remove-logging");

//     // We want to build it before we watch, so can one-line it
//     grunt.renameTask('watch', 'watch2');

//     grunt.registerTask('dev', ["concat:sugr", "concat:creative"]);
//     grunt.registerTask('prod', ["concat:sugr", "removelogging", "uglify"]);
//     //grunt.registerTask('prod', [ "uglify"]);
//     grunt.registerTask('crev', ["concat:creative", "removelogging", "uglify:creative"]);

//     grunt.registerTask('watchDev', ["watch2:units"]);

//     grunt.registerTask('build', ["clean:preprocess", "coffee:compile"]);
//     grunt.registerTask('default', ["build", "concat:sugr", "clean:postprocess"]);
//     grunt.registerTask('unconcat', ["clean:preprocess", "coffee:compile"]);
//     grunt.registerTask('watch', ['test', 'watch2' ]);
//     grunt.registerTask('test', ['build', 'coffee:tests', 'concat:sugr', 'concat:tests', 'blanket_mocha:all' ]);
//     grunt.registerTask('host', ['connect:dev']);
//     grunt.registerTask('jenkins', ['build', 'coffee:tests', 'concat:sugr', 'blanket_mocha:jenkins' ]);
//     // grunt.registerTask('concat', ['coffee:tests', 'concat:sugr', 'concat:tests']);

// };
