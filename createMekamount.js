// Requires "axios" and "form-data" to be installed (see https://www.npmjs.com/package/axios and https://www.npmjs.com/package/form-data)
const https = require('https'); // or 'https' for https:// URLs
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const mergeImages = require('merge-images');
const sharp = require('sharp');
const { Canvas, Image } = require('canvas');

function downloadIMG(url, outputPath, callback) {
  var file = fs.createWriteStream(outputPath);
  var request = https.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(callback);  // close() is async, call cb after close completes.
    });
  }).on('error', function(err) { // Handle errors
    fs.unlink(outputPath); // Delete the file async. (But we don't check the result)
    if (callback) callback(err.message);
  });
};

function removeBGAPI(inputPath, outputPath, callback){
    const formData = new FormData();
    formData.append('image_file', fs.createReadStream(inputPath), path.basename(inputPath));
    formData.append('size', 'preview');
    formData.append('type', 'auto');
    formData.append('type_level', 'latest');
    formData.append('format', 'png');

    axios({
      method: 'post',
      url: 'https://api.remove.bg/v1.0/removebg',
      data: formData,
      responseType: 'arraybuffer',
      headers: {
        ...formData.getHeaders(),
        'X-Api-Key': 'S73qUka2SUJ1p9KWDEQB4sFk',
    
      },
      encoding: null
    })
    .then((response) => {
      if(response.status != 200) return console.error('Error:', response.status, response.statusText);
      fs.writeFileSync(outputPath, response.data);
      if (callback) callback();
    })
    .catch((error) => {
        return console.error('Request failed:', error);
    });
}

function resizeIMG(inputFile, outputFile, size, callback){

    sharp(inputFile).resize({ height: size }).toFile(outputFile)
    .then(function(newFileInfo) {
        if(callback) callback();
    })
    .catch(function(err) {
        console.log("Error occured");
    });
}

function mergeIMG(backgroundPath, foregroundPath, outputFile, forgroundX, forgroundY, callback){
    mergeImages(
        [{ src: backgroundPath, x: 0, y: 0 },
        { src: foregroundPath, x: forgroundX, y: forgroundY},],
        {Canvas: Canvas, Image: Image}
    ).then(b64 => {
        fs.writeFileSync(outputFile, b64.split(';base64,').pop(), {encoding: 'base64'});
        if(callback) callback();
    })
}

function cleanIMG(files, callback){
    files.forEach((file)=>fs.unlinkSync(file));
    if(callback) callback();
}

//SS
// const pfpURL = 'https://xcsge4ptzkihajfxjtct4d4yzyik3suuiciskya4pwnrzbx4qpsq.arweave.net/uKRicfPKkHAkt0zFPg-YzhCtypRAkSVgHH2bHIb8g-U';
//PP
const pfpURL = 'https://pqyul4skaef6irxou72ihe7ip6kodd5x3mg63wjdjkoheaqhxdnq.arweave.net/fDFF8koBC-RG7qf0g5Pof5Thj7fbDe3ZI0qccgIHuNs';
const bgURL = 'https://d63yr2nutiaxwromer6mae4r46xhplxrjiu2pu26w3lilt3r5l5a.arweave.net/H7eI6bSaAXtFzCR8wBOR5653rvFKKafTXrbWhc9x6vo';

const pfpPath = './img/pfp.png';
const bgPath = './img/mek.png';
const pfpAlphaPath = './img/pfpAlpha.png';
const pfpMiniAlphaPath = './img/pfpMiniAlpha.png';
const finalPath = './img/mekaFinalForm.png';

const mekSize = 2222;
const pfpScale = 0.18;
const pfpCenterX = 355;
const pfpBottomY = 560;

//Helpers 
function getPFPSize(){
    return Math.round((mekSize * pfpScale)) + (2 * (Math.round(mekSize * pfpScale) % 2));
}

//Main

//Steps
function runScript(){     console.log('MekaMount Building....'); downloadPFP();}
function downloadPFP(){   console.log('Downloading PFP...'); downloadIMG(process.argv[3] ?? pfpURL, pfpPath, downloadBG);}
function downloadBG(){    console.log('Downloading Mount...'); downloadIMG(process.argv[2] ?? bgURL, bgPath, removeBG);}
function removeBG(){      console.log('Stripping PFP...'); removeBGAPI(pfpPath, pfpAlphaPath, resizePFP);}
function resizePFP(){     console.log('[ENHANCE]'); resizeIMG(pfpAlphaPath, pfpMiniAlphaPath, getPFPSize(), mergePFPnBG);}
function mergePFPnBG(){   console.log('Merging...'); mergeIMG(bgPath, pfpMiniAlphaPath, finalPath, (pfpCenterX - getPFPSize() / 2), (pfpBottomY - getPFPSize()), cleanUp);}
function cleanUp(){       console.log("Cleaning..."); cleanIMG([bgPath, pfpPath, pfpAlphaPath, pfpMiniAlphaPath], finish);}
function finish(){        console.log("Locked N Loaded!");}

runScript();

