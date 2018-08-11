const tarToZip = require('tar-to-zip');
const fs = require('fs');

const isTar = function(key) {
  if( key.endsWith('.tgz') || 
      key.endsWith('.tar') || 
      key.endsWith('.bz2') ||
      key.endsWith('.gz') ) {
      return true;
  }
  return false;
}

const convert = function (input_stream, name) {
  let output_file = '/tmp/'+ name + '.zip';
   
  const zip = fs.createWriteStream(output_file);

  return new Promise((resolve, reject) => {
    const onFinish = (e) => {
      resolve(output_file);
    };
    
    const onError = ({message}) => {
      console.log('tarToZip convert fail');
      console.error(message);
      reject();
    };

    tarToZip(input_stream)
    .on('error', onError)
    .getStream()
    .pipe(zip)
    .on('finish', onFinish);
  });

}

exports.isTar = isTar;
exports.convert = convert;