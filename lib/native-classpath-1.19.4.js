// The model animation builders additionally use a client-only library omitted
// from the dedicated server bundler. Its artifact is pinned in the target file.
const {nativeClasspath}=require('./native-classpath');const path=require('path');
exports.nativeClasspath=cache=>nativeClasspath(cache)+path.delimiter+path.join(cache,'client-libraries/commons-compress.jar');
