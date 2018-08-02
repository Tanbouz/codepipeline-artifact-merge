const fs = require("fs");
const path = require("path");

let mkdirSync = function(path) {
  try {
      fs.accessSync(path, fs.constants.R_OK | fs.constants.W_OK);
  } catch (err) {
      fs.mkdirSync(path);
  } 
  return;
}

let extractZip = function (zip, base_path) {
  let promises = [];

  zip.forEach((relativePath, file) => {
      if(file.dir === false) {
          let p = new Promise((resolve, reject) => {
              file.nodeStream()
              .pipe(fs.createWriteStream(path.join(base_path, relativePath)))
              .on('finish', function () {
                  resolve();
              })
              .on('error', err => {
                  console.log(err);
                  reject(err);
              });
          });
          promises.push(p);
      }
      else {
          mkdirSync(path.join(base_path, relativePath));
      }
      
  });

  return Promise.all(promises);
}

exports.mkdirSync = mkdirSync;
exports.extractZip = extractZip;