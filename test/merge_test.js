var JSZip = require("jszip");
var fs = require("fs");
let chai = require('chai');
let assert = chai.assert;
var index = require("../src/index.js");


suite('Merge', function() {

    suite('Merge Artifacts with default options', function() {

        let content_a = fs.readFileSync('test/a.zip');
        let content_b = fs.readFileSync('test/b.zip');
        let combinedZipPath = "test/generated/combined_default.zip";

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


        test('should return a zipped file with the correct contents', function(done) {
            let new_zip = new JSZip();
            let input_artifacts = [{'data': content_a, 'name':'a'}, {'data': content_b, 'name':'b'}];
            let outputZipPath = "test/generated/output_default.zip";
            let expected = fs.readFileSync(combinedZipPath);

            index.mergeArtifacts(new_zip, input_artifacts, 0).then(merged_zip => {

                merged_zip.generateAsync({ type: "nodebuffer" }).then((content) => {
                    require("fs").writeFile(outputZipPath, content, function (error) {
                        if (error){
                            console.log("JSZip error: " + error);
                        }
                        let output = fs.readFileSync(outputZipPath);

                        assert.isTrue(output.equals(expected));
                        done();
                    });
                })
            }).catch((error) => {
                console.log("JSZip error: " + error);
            });

        });
    })

    suite('Merge Artifacts with subfolder mapping', function() {

        let content_a = fs.readFileSync('test/a.zip');
        let content_b = fs.readFileSync('test/b.zip');
        let combinedZipPath = "test/generated/combined_subfolder.zip";

        setup(function(done) {
            let zip = new JSZip();
            inner_folder_a = zip.folder('a');

            inner_folder_a.loadAsync(content_a).then(() => {
                inner_folder_b = zip.folder('b');
                inner_folder_b.loadAsync(content_b).then(() => {
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


        test('should return a zipped file with the correct contents', function(done) {
            let new_zip = new JSZip();
            let input_artifacts = [{'data': content_a, 'name':'a'}, {'data': content_b, 'name':'b'}];
            let outputZipPath = "test/generated/output_subfolder.zip";
            let expected = fs.readFileSync(combinedZipPath);

            index.mergeArtifactsWithSubFolder(new_zip, input_artifacts, 0).then(merged_zip => {

                merged_zip.generateAsync({ type: "nodebuffer" }).then((content) => {
                    require("fs").writeFile(outputZipPath, content, function (error) {
                        if (error){
                            console.log("JSZip error: " + error);
                        }
                        let output = fs.readFileSync(outputZipPath);

                        assert.isTrue(output.equals(expected));
                        done();
                    });
                })
            }).catch((error) => {
                console.log("JSZip error: " + error);
            });

        });
    })

    suite('Parsing parameter string', function() {


        test('should throw an error when an invalid json is entered', function() {
            assert.throws(function(){ index.parseParametersString('not a json') });
            assert.throws(function(){ index.parseParametersString('{"subfolder": true }}') });
        });


        test('should not throw an error when an valid json or empty value is entered', function() {
            assert.doesNotThrow(function(){ index.parseParametersString('{ "subfolder": true }') });
            assert.doesNotThrow(function(){ index.parseParametersString('') });
            assert.doesNotThrow(function(){ index.parseParametersString(null) });
        });
    })
})
