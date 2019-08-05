#!/bin/bash -ex

commitish=4adba2e6ef8c8734a693af3141461dec6d674d50

cd /tmp
rm -rf Sugar-$commitish
wget -q https://github.com/andrewplummer/Sugar/archive/$commitish.zip
unzip -q $commitish.zip
rm $commitish.zip
cd Sugar-$commitish
patch -p1 -s <<\EOF
commit 9bc728a3efab8e4d49f7ffac1c047eb70cfeb391
Author: Jonathan Kamens <jik@kamens.us>
Date:   Mon Aug 5 09:45:01 2019 -0400

    Fix for getting global context in recent Firefox and Thunderbird
    
    If we can't get the global contest from either `global` or `window`
    and `Cu.getGlobalForObject` exists, then use that.
    
    See https://developer.mozilla.org/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.utils.getGlobalForObject.
    
    Fixes andrewplummer/Sugar#627.

diff --git a/lib/core.js b/lib/core.js
index 9b28df75..7734598d 100644
--- a/lib/core.js
+++ b/lib/core.js
@@ -50,8 +50,13 @@ var DefaultChainable = getNewChainableClass('Chainable');
 function getGlobal() {
   // Get global context by keyword here to avoid issues with libraries
   // that can potentially alter this script's context object.
-  return testGlobal(typeof global !== 'undefined' && global) ||
-         testGlobal(typeof window !== 'undefined' && window);
+  var ret = testGlobal(typeof global !== 'undefined' && global) ||
+            testGlobal(typeof window !== 'undefined' && window);
+  if (ret) return ret;
+  // Firefox / Thunderbird specific
+  if (typeof Cu != 'undefined' && typeof Cu.getGlobalForObject != 'undefined')
+    ret = testGlobal(Cu.getGlobalForObject(getGlobal));
+  return ret;
 }
 
 function testGlobal(obj) {

commit 1aa90d738fa590bb26687c26356980fec706b8c5
Author: Jonathan Kamens <jik@kamens.us>
Date:   Mon Aug 5 09:30:00 2019 -0400

    Don't convert locale directory names to lower case
    
    Fixes andrewplummer/Sugar#654

diff --git a/gulpfile.js b/gulpfile.js
index ee3c7aa4..9b9d2e63 100644
--- a/gulpfile.js
+++ b/gulpfile.js
@@ -793,7 +793,7 @@ function getLocalePaths(l) {
   var codes = getLocaleCodes(l);
 
   function getPath(l) {
-    return path.join('lib', 'locales', l.toLowerCase() + '.js');
+    return path.join('lib', 'locales', l + '.js');
   }
 
   codes.forEach(function(n) {

EOF
npm -s install
./node_modules/.bin/gulp build:dev --silent -m all -l all

test -f sugar-custom.js
echo "The build file sugar-custom.js is what's in Send Later."
