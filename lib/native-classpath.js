// The 1.18+ server launcher is a bundler, not a classpath containing game classes.
const fs=require('fs'),path=require('path');
function jars(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?jars(path.join(dir,e.name)):e.name.endsWith('.jar')?[path.join(dir,e.name)]:[]);}
exports.nativeClasspath=cache=>[path.join(cache,'client.jar'),...jars(path.join(cache,'bundler/META-INF/libraries')),...jars(path.join(cache,'bundler/META-INF/versions'))].join(path.delimiter);
