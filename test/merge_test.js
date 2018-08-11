const JSZip = require("jszip");
const globby = require('globby');
const fs = require("fs");
const path = require("path");
const index = require("../src/index.js");
const Utils = require("./test_utils.js");
let chai = require('chai');
let assert = chai.assert;


suite('Merge', function() {

    suite('Merge tar.gz Artifacts with subfolder mapping and revisions', function() {
        let expected_a = fs.readFileSync(path.join('test', 'a.zip'));

        //random test folder name to ensure unused
        let seed = Date.now();
        let test_tar_path = path.join('test', 'tar'+seed);
        let expacted_path = path.join('test', 'extracted'+seed);
        
        suiteSetup(function(done) {
            //init folder for test
            Utils.mkdirSync(test_tar_path);
            Utils.mkdirSync(expacted_path);

            //init extracted of expected_a
            let zip = new JSZip();
            zip.loadAsync(expected_a).then(content => {
                return Utils.extractZip(content, expacted_path);
            }).then(() => {
                done();
            }).catch(err => {
                console.log(err);
            });
        });

        test('convert tar.gz file', async function() {
            const stream_a = fs.createReadStream(path.join('test', 'a.tar.gz')); 
            let zip = new JSZip();

            let content = await index.getTarArtifact(stream_a, 'a');

            await zip.loadAsync(content.Body);
            await Utils.extractZip(zip, test_tar_path);
        });

        test('each file inside tar file should be identical with zipped file', function() {
            const testFiles = globby.sync(test_tar_path);

            testFiles.forEach(filePath => {
                let pathInfo = path.parse(filePath);

                //get path of expected
                let pathArray = pathInfo.dir.split('/');
                let expextedPathArray = expacted_path.split('/');
                let expectedPathStr = "";
                pathArray.forEach((value, index) => {
                    if((typeof expextedPathArray[index] === 'string')&&(expextedPathArray[index] !== '')) {
                        expectedPathStr = path.join(expectedPathStr, expextedPathArray[index]);
                    }
                    else {
                        expectedPathStr = path.join(expectedPathStr, pathArray[index]);
                    }
                });

                //read test and expect item
                let testContent = fs.readFileSync(filePath);
                let expectContent = fs.readFileSync(path.join(expectedPathStr, pathInfo.base));

                assert.isTrue(testContent.equals(expectContent));
            });   
        });

        suiteTeardown(function(done) {
            let cleanTest = function(folderName) {
                const testFiles = globby.sync(folderName, {
                    expandDirectories: true,
                    nodir: false
                });
                testFiles.reverse().forEach(item => {
                    let isFolder = fs.lstatSync(item).isDirectory();
                    if(isFolder) {
                        fs.rmdirSync(item);
                    }
                    else {
                        fs.unlinkSync(item);
                    }
                });
            }

            //clean
            cleanTest(test_tar_path);
            cleanTest(expacted_path);
            done();
        });
    })


    
    suite('Merge Artifacts with root merge and without revisions', function() {

        let content_a = fs.readFileSync('test/a.zip');
        let content_b = fs.readFileSync('test/b.zip');
        let revision_a = 'lev28301xf2'
        let revision_b = null;
        let combinedZipPath = "test/generated/reference_root.zip";

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
            let input_artifacts = [
                {'data': content_a, 'name':'a', 'revision':revision_a},
                {'data': content_b, 'name':'b', 'revision':revision_b}
            ];
            let outputZipPath = "test/generated/output_root.zip";
            let expected = fs.readFileSync(combinedZipPath);

            let options = {
                "subfolder": false,
                "revisions": false
            }

            index.mergeArtifacts(new_zip, input_artifacts, 0, options).then(merged_zip => {

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

    suite('Merge Artifacts with root merge and revisions', function() {

        let content_a = fs.readFileSync('test/a.zip');
        let content_b = fs.readFileSync('test/b.zip');
        let revision_a = 'lev28301xf2'
        let revision_b = null;
        let combinedZipPath = "test/generated/reference_root_revision.zip";

        setup(function(done) {
            let zip = new JSZip();
            zip.file(".revision-id-a", revision_a);
            zip.loadAsync(content_a).then((zip) => {
                zip.file(".revision-id-b", revision_b);
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
            let input_artifacts = [
                {'data': content_a, 'name':'a', 'revision':revision_a},
                {'data': content_b, 'name':'b', 'revision':revision_b}
            ];
            let outputZipPath = "test/generated/output_root_revision.zip";
            let expected = fs.readFileSync(combinedZipPath);

            let options = {
                "subfolder": false,
                "revisions": true
            }

            index.mergeArtifacts(new_zip, input_artifacts, 0, options).then(merged_zip => {

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

    suite('Merge Artifacts with subfolder mapping and without revisions', function() {

        let content_a = fs.readFileSync('test/a.zip');
        let content_b = fs.readFileSync('test/b.zip');
        let revision_a = 'lev28301xf2'
        let revision_b = null;
        let combinedZipPath = "test/generated/reference_subfolder.zip";

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
            let input_artifacts = [
                {'data': content_a, 'name':'a', 'revision':revision_a},
                {'data': content_b, 'name':'b', 'revision':revision_b}
            ];
            let outputZipPath = "test/generated/output_subfolder.zip";
            let expected = fs.readFileSync(combinedZipPath);

            let options = {
                "subfolder": true,
                "revisions": false
            }

            index.mergeArtifacts(new_zip, input_artifacts, 0, options).then(merged_zip => {

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

    suite('Merge Artifacts with subfolder mapping and revisions', function() {

        let content_a = fs.readFileSync('test/a.zip');
        let content_b = fs.readFileSync('test/b.zip');
        let revision_a = 'lev28301xf2'
        let revision_b = null;
        let combinedZipPath = "test/generated/reference_subfolder_revisions.zip";

        setup(function(done) {
            let zip = new JSZip();
            inner_folder_a = zip.folder('a');
            inner_folder_a.file(".revision-id", revision_a);

            inner_folder_a.loadAsync(content_a).then(() => {
                inner_folder_b = zip.folder('b');
                inner_folder_b.file(".revision-id", revision_b);
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
            let input_artifacts = [
                {'data': content_a, 'name':'a', 'revision':revision_a},
                {'data': content_b, 'name':'b', 'revision':revision_b}
            ];
            let outputZipPath = "test/generated/output_subfolder_revisions.zip";
            let expected = fs.readFileSync(combinedZipPath);

            let options = {
                "subfolder": true,
                "revisions": true
            }

            index.mergeArtifacts(new_zip, input_artifacts, 0, options).then(merged_zip => {

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
