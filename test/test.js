var JSZip = require("jszip");
var fs = require("fs");
var zip = new JSZip();

var content_a = fs.readFileSync('a.zip');
var content_b = fs.readFileSync('b.zip');

zip.loadAsync(content_a).then((zip) => {
    zip.loadAsync(content_b).then((zip) => {
        zip.generateAsync({ type: "nodebuffer" }).then((content) => {
            require("fs").writeFile("hello.zip", content, function (err) {/*...*/ });
        })
    })
});