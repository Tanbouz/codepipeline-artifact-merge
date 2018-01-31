var JSZip = require("jszip");
var fs = require("fs");
let chai = require('chai');
let assert = chai.assert;
var index = require("../src/index.js");


suite('Merge', function() {

    suite('Merge Artifacts', function() {

        let content_a = fs.readFileSync('test/a.zip');
        let content_b = fs.readFileSync('test/b.zip');
        let combinedZipPath = "test/generated/combined.zip";

        setup(function(done) {
            let zip = new JSZip();
            zip.loadAsync(content_a).then((zip) => {
                zip.loadAsync(content_b).then((zip) => {
                    zip.generateAsync({ type: "nodebuffer" }).then((content) => {
                        require("fs").writeFile(combinedZipPath, content, function (error) {
                            if (error){
                                console.log("JSZip error: " + error);
                            }
                            done();
                        });
                    })
                })
            });
        });


        test('should accept and return string `value`', function(done) {
            let new_zip = new JSZip();
            let input_artifacts = [content_a, content_b];
            let outputZipPath = "test/generated/output.zip";
            let expected = fs.readFileSync(combinedZipPath);

            // just call mergeArtifacts
            index.mergeArtifacts(new_zip, input_artifacts, 0).then(merged_zip => {

                merged_zip.generateAsync({ type: "nodebuffer" }).then((content) => {
                    require("fs").writeFile(outputZipPath, content, function (error) {
                        if (error){
                            console.log("JSZip error: " + error);
                        }
                        let output = fs.readFileSync(outputZipPath);

                        assert.deepEqual(output, expected);
                        done();
                    });
                })
            }).catch((error) => {
                console.log("JSZip error: " + error);
            });

        });
    })
})
